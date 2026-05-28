import { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, LocateFixed } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import { cn } from "../../lib/cn";

export function ValidationBar() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const validate = useEditorStore((s) => s.validate);
  const setSelectedNodeId = useEditorStore((s) => s.setSelectedNodeId);
  const [expanded, setExpanded] = useState(false);
  const { getNode, setCenter } = useReactFlow();

  const result = validate();
  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const issueCount = result.issues.length;

  const hasErrors = result.errors.length > 0;
  const hasWarnings = result.warnings.length > 0;
  const statusText = hasErrors
    ? result.errors[0]
    : hasWarnings
      ? result.warnings[0]
      : "Pipeline válido";

  function focusIssue(nodeId: string) {
    const node = getNode(nodeId);
    setSelectedNodeId(nodeId);
    if (node) {
      setCenter(node.position.x + (node.width ?? 180) / 2, node.position.y + (node.height ?? 90) / 2, {
        zoom: 1,
        duration: 200,
      });
    }
  }

  return (
    <div className="relative border-t border-nyx-border bg-nyx-deep">
      <AnimatePresence>
        {expanded && issueCount > 0 && (
          <motion.div
            key="validation-issues"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
            className="absolute bottom-9 left-0 right-0 z-30 border-t border-nyx-border bg-nyx-deep shadow-2xl"
          >
            <div className="max-h-56 overflow-y-auto p-2">
              {result.issues.map((issue) => {
                const issueIcon = issue.level === "error" ? XCircle : AlertTriangle;
                const IssueIcon = issueIcon;
                return (
                  <button
                    key={issue.id}
                    onClick={() => issue.nodeId && focusIssue(issue.nodeId)}
                    disabled={!issue.nodeId}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                      issue.nodeId ? "hover:bg-nyx-hover" : "cursor-default",
                    )}
                  >
                    <IssueIcon className={cn("h-3.5 w-3.5 shrink-0", issue.level === "error" ? "text-red-400" : "text-orange-400")} />
                    <span className="min-w-0 flex-1 text-xs text-nyx-text-secondary">{issue.message}</span>
                    {issue.nodeId && (
                      <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-nyx-text-muted">
                        <LocateFixed className="h-3 w-3" />
                        Focar
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex h-9 items-center gap-3 px-4">
        {hasErrors ? (
          <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
        ) : hasWarnings ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-400" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />
        )}

        <span
          className={cn(
            "font-mono text-xs",
            hasErrors
              ? "text-red-400"
              : hasWarnings
                ? "text-orange-400"
                : "text-green-400",
          )}
        >
          {statusText}
        </span>

        {issueCount > 1 && (
          <button
            onClick={() => setExpanded((value) => !value)}
            className="flex items-center gap-1 rounded px-1.5 py-1 font-mono text-[10px] uppercase tracking-wider text-nyx-text-muted hover:bg-nyx-hover hover:text-nyx-text-primary"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            {issueCount} problemas
          </button>
        )}

        <span className="text-nyx-text-muted">·</span>

        <span className="font-mono text-xs text-nyx-text-muted">
          {nodeCount} etapa{nodeCount !== 1 ? "s" : ""}
        </span>

        <span className="text-nyx-text-muted">·</span>

        <span className="font-mono text-xs text-nyx-text-muted">
          {edgeCount} conexão{edgeCount !== 1 ? "ões" : ""}
        </span>
      </div>
    </div>
  );
}
