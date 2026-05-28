import type { Graph, BlueprintNode } from "../graph";
import type { EventTimelineItem } from "./events";

export interface RenderAction {
  nodeId: string;
  type: string;
  startMs: number;
  endMs: number;
  params: Record<string, unknown>;
}

export function resolveActions(graph: Graph, events: EventTimelineItem[]): RenderAction[] {
  const eventsByNode = new Map<string, EventTimelineItem[]>();
  for (const event of events) {
    const list = eventsByNode.get(event.nodeId) ?? [];
    list.push(event);
    eventsByNode.set(event.nodeId, list);
  }

  const actions: RenderAction[] = [];
  for (const edge of graph.edges) {
    const from = graph.nodes.find((n) => n.id === edge.from);
    const to = graph.nodes.find((n) => n.id === edge.to);
    if (!from || !to || from.kind !== "event" || to.kind !== "action") continue;

    for (const event of eventsByNode.get(from.id) ?? []) {
      const durationMs =
        to.type === "ShowOverlay"
          ? ((to as Extract<BlueprintNode, { type: "ShowOverlay" }>).config.durationMs ?? 1000)
          : event.endMs - event.startMs;

      actions.push({
        nodeId: to.id,
        type: to.type,
        startMs: event.startMs,
        endMs: event.startMs + durationMs,
        params: to.config as Record<string, unknown>,
      });
    }
  }

  return actions.sort((a, b) => a.startMs - b.startMs);
}
