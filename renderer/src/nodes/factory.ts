import type { GraphNode } from "../graph";
import type { BaseNodeExecutor, ExecutionContext } from "./executor";
import { MediaPoolExecutor } from "./mediapool";
import { SceneSlotExecutor } from "./sceneslot";
import { VideoFitExecutor } from "./videofit";
import { TTSExecutor } from "./tts";
import { SubtitleExecutor } from "./subtitle";
import { LayerExecutor } from "./layer";
import { RenderExecutor } from "./render";
import { OverlayExecutor } from "./overlay";
import { TransitionExecutor } from "./transition";
import { ZoomExecutor } from "./zoom";
import { ShakeExecutor } from "./shake";
import { SceneMediaExecutor } from "./scenemedia";

const executors = {
  MediaPool: MediaPoolExecutor,
  SceneSlot: SceneSlotExecutor,
  VideoFit: VideoFitExecutor,
  TTS: TTSExecutor,
  Subtitle: SubtitleExecutor,
  Layer: LayerExecutor,
  Render: RenderExecutor,
  Overlay: OverlayExecutor,
  Transition: TransitionExecutor,
  Zoom: ZoomExecutor,
  Shake: ShakeExecutor,
  SceneMedia: SceneMediaExecutor,
} as const;

export function createExecutor(node: GraphNode, workDir: string, context: ExecutionContext = {}): BaseNodeExecutor {
  const Ctor = executors[node.type];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (Ctor as any)(node.id, node.type, node.config, workDir, context);
}
