import { join } from "path";
import type { GraphNode, NodeType } from "../graph";

export type HandleData = string | Buffer | number | object;
export type HandleInputs = Record<string, HandleData | HandleData[]>;

export interface ResolvedSceneSlot {
  index: number;
  startMs: number;
  endMs: number;
  assetId: string; // storageKey (já resolvido pelo worker)
}

export interface ExecutionContext {
  talkifyApiKey?: string;
  renderWidth?: number;
  renderHeight?: number;
  sceneSlots?: ResolvedSceneSlot[]; // preenchido quando job tem SceneMedia node
}

type ConfigFor<T extends NodeType> = Extract<GraphNode, { type: T }>["config"];

export abstract class BaseNodeExecutor<T extends NodeType = NodeType> {
  readonly nodeId: string;
  readonly type: T;
  protected readonly config: ConfigFor<T>;
  protected readonly workDir: string;
  protected readonly context: ExecutionContext;

  constructor(nodeId: string, type: T, config: ConfigFor<T>, workDir: string, context: ExecutionContext = {}) {
    this.nodeId = nodeId;
    this.type = type;
    this.config = config;
    this.workDir = workDir;
    this.context = context;
  }

  protected outPath(filename: string): string {
    return join(this.workDir, `${this.type.toLowerCase()}-${this.nodeId}-${filename}`);
  }

  abstract execute(inputs: HandleInputs): Promise<Record<string, HandleData>>;
}
