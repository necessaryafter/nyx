import { BaseNodeExecutor, type HandleData, type HandleInputs } from "./executor";

// Inputs:  (nenhum)
// Outputs: effect (EffectConfig { type: "zoom", ...ZoomConfig })
export class ZoomExecutor extends BaseNodeExecutor<"Zoom"> {
  async execute(_inputs: HandleInputs): Promise<Record<string, HandleData>> {
    return { effect: { type: "zoom", ...this.config } as unknown as HandleData };
  }
}
