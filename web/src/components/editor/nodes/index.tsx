import { memo } from "react";
import {
  Captions,
  Clapperboard,
  Clock,
  Database,
  Film,
  Image,
  ImagePlay,
  Mic,
  Music,
  Pilcrow,
  Sparkles,
  StepBack,
  StepForward,
  Volume2,
  VolumeX,
  WholeWord,
} from "lucide-react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode, getNodeCategory } from "./BaseNode";
import { NODE_DEFINITIONS } from "../../../lib/nodeDefaults";
import type { NodeType } from "../../../lib/types";

const ICONS: Record<NodeType, React.ReactNode> = {
  NarrationSource: <Mic className="h-4 w-4" />,
  AssetSource: <Database className="h-4 w-4" />,
  SceneSource: <Film className="h-4 w-4" />,
  MusicSource: <Music className="h-4 w-4" />,
  OnTime: <Clock className="h-4 w-4" />,
  OnWord: <WholeWord className="h-4 w-4" />,
  OnSentence: <Pilcrow className="h-4 w-4" />,
  OnSilence: <VolumeX className="h-4 w-4" />,
  OnSceneStart: <StepForward className="h-4 w-4" />,
  OnSceneEnd: <StepBack className="h-4 w-4" />,
  SetMedia: <ImagePlay className="h-4 w-4" />,
  ShowOverlay: <Image className="h-4 w-4" />,
  SetSubtitleStyle: <Captions className="h-4 w-4" />,
  PlaySfx: <Volume2 className="h-4 w-4" />,
  SetMusic: <Music className="h-4 w-4" />,
  CameraEffect: <Sparkles className="h-4 w-4" />,
  Render: <Clapperboard className="h-4 w-4" />,
};

function describe(type: NodeType, config: Record<string, unknown>) {
  if (type === "AssetSource") return `${config.assetType ?? "video"} · ${((config.assetIds as string[] | undefined) ?? []).length} assets`;
  if (type === "MusicSource") return `${((config.assetIds as string[] | undefined) ?? []).length} tracks`;
  if (type === "NarrationSource") return String(config.provider ?? "talkify");
  if (type === "OnWord") return String(config.word ?? "qualquer palavra");
  if (type === "OnTime") return `${config.atMs ?? 0}ms`;
  if (type === "SetSubtitleStyle") return `${config.wordsPerGroup ?? 3} palavras/grupo`;
  if (type === "ShowOverlay") return `${config.durationMs ?? 1000}ms`;
  if (type === "PlaySfx") return config.assetId ? "sfx selecionado" : "sem sfx";
  if (type === "CameraEffect") return "zoom/shake/transition";
  return "";
}

const V2Node = memo(function V2Node(props: NodeProps) {
  const type = props.data?.type as NodeType;
  const config = (props.data?.config ?? {}) as Record<string, unknown>;
  const kind = String(props.data?.kind ?? "");

  return (
    <BaseNode
      {...props}
      icon={ICONS[type]}
      label={NODE_DEFINITIONS[type]?.label ?? type}
      technicalLabel={type}
      category={getNodeCategory(type)}
      inputs={kind === "source" ? [] : [{ id: "in", label: "in" }]}
      outputs={kind === "output" ? [] : [{ id: "out", label: "out" }]}
      statusBadge={<span className="text-[10px] text-nyx-text-muted">{describe(type, config)}</span>}
    />
  );
});

export const nodeTypes = {
  NarrationSource: V2Node,
  AssetSource: V2Node,
  SceneSource: V2Node,
  MusicSource: V2Node,
  OnTime: V2Node,
  OnWord: V2Node,
  OnSentence: V2Node,
  OnSilence: V2Node,
  OnSceneStart: V2Node,
  OnSceneEnd: V2Node,
  SetMedia: V2Node,
  ShowOverlay: V2Node,
  SetSubtitleStyle: V2Node,
  PlaySfx: V2Node,
  SetMusic: V2Node,
  CameraEffect: V2Node,
  Render: V2Node,
};
