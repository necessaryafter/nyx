import type { Graph, WordTimestamp } from "../graph";
import type { ResolvedSceneSlot } from "../prepare/scenes";

export interface EventTimelineItem {
  id: string;
  nodeId: string;
  type: string;
  startMs: number;
  endMs: number;
  payload: Record<string, unknown>;
}

export function buildEventTimeline(
  graph: Graph,
  timestamps: WordTimestamp[],
  sceneSlots: ResolvedSceneSlot[] = [],
): EventTimelineItem[] {
  const events: EventTimelineItem[] = [];

  for (const node of graph.nodes) {
    if (node.kind !== "event") continue;

    if (node.type === "OnTime") {
      const duration = node.config.durationMs ?? 1;
      events.push({
        id: `${node.id}:time`,
        nodeId: node.id,
        type: node.type,
        startMs: node.config.atMs,
        endMs: node.config.atMs + duration,
        payload: {},
      });
    }

    if (node.type === "OnWord") {
      const needle = node.config.caseSensitive ? node.config.word : node.config.word?.toLowerCase();
      for (let i = 0; i < timestamps.length; i++) {
        const word = timestamps[i]!;
        const hay = node.config.caseSensitive ? word.word : word.word.toLowerCase();
        const matched = !needle || (node.config.match === "exact" ? hay === needle : hay.includes(needle));
        if (matched) {
          events.push({
            id: `${node.id}:word:${i}`,
            nodeId: node.id,
            type: node.type,
            startMs: word.startMs,
            endMs: word.endMs,
            payload: { word: word.word, index: i },
          });
        }
      }
    }

    if (node.type === "OnSentence") {
      let start = timestamps[0]?.startMs ?? 0;
      let words: WordTimestamp[] = [];
      timestamps.forEach((word, i) => {
        words.push(word);
        const ends = /[.!?]$/.test(word.word) || i === timestamps.length - 1;
        if (ends) {
          events.push({
            id: `${node.id}:sentence:${events.length}`,
            nodeId: node.id,
            type: node.type,
            startMs: start,
            endMs: word.endMs,
            payload: { words },
          });
          words = [];
          start = timestamps[i + 1]?.startMs ?? word.endMs;
        }
      });
    }

    if (node.type === "OnSilence") {
      const min = node.config.minDurationMs ?? 500;
      for (let i = 0; i < timestamps.length - 1; i++) {
        const current = timestamps[i]!;
        const next = timestamps[i + 1]!;
        if (next.startMs - current.endMs >= min) {
          events.push({
            id: `${node.id}:silence:${i}`,
            nodeId: node.id,
            type: node.type,
            startMs: current.endMs,
            endMs: next.startMs,
            payload: {},
          });
        }
      }
    }

    if (node.type === "OnSceneStart") {
      for (const slot of sceneSlots) {
        events.push({
          id: `${node.id}:scene-start:${slot.index}`,
          nodeId: node.id,
          type: node.type,
          startMs: slot.startMs,
          endMs: slot.startMs + 1,
          payload: { slot },
        });
      }
    }

    if (node.type === "OnSceneEnd") {
      for (const slot of sceneSlots) {
        events.push({
          id: `${node.id}:scene-end:${slot.index}`,
          nodeId: node.id,
          type: node.type,
          startMs: slot.endMs,
          endMs: slot.endMs + 1,
          payload: { slot },
        });
      }
    }
  }

  return events.sort((a, b) => a.startMs - b.startMs);
}
