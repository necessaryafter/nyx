import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import { cn } from "../../lib/cn";

export function ValidationBar() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const validate = useEditorStore((s) => s.validate);

  const result = validate();
  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  const hasErrors = result.errors.length > 0;
  const hasWarnings = result.warnings.length > 0;

  return (
    <div className="flex h-9 items-center gap-3 border-t border-nyx-border bg-nyx-deep px-4">
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
        {hasErrors
          ? result.errors[0]
          : hasWarnings
            ? result.warnings[0]
            : "Grafo válido"}
      </span>

      <span className="text-nyx-text-muted">·</span>

      <span className="font-mono text-xs text-nyx-text-muted">
        {nodeCount} node{nodeCount !== 1 ? "s" : ""}
      </span>

      <span className="text-nyx-text-muted">·</span>

      <span className="font-mono text-xs text-nyx-text-muted">
        {edgeCount} edge{edgeCount !== 1 ? "s" : ""}
      </span>

      {(result.errors.length > 1 || result.warnings.length > 1) && (
        <>
          <span className="text-nyx-text-muted">·</span>
          <span className="font-mono text-xs text-nyx-text-muted">
            {result.errors.length + result.warnings.length} problema
            {result.errors.length + result.warnings.length !== 1 ? "s" : ""}
          </span>
        </>
      )}
    </div>
  );
}
