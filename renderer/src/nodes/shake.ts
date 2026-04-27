import { BaseNodeExecutor, type HandleData, type HandleInputs } from "./executor";

// Inputs:  (nenhum)
// Outputs: effect (EffectConfig { type: "shake", ...ShakeConfig })
export class ShakeExecutor extends BaseNodeExecutor<"Shake"> {
  async execute(_inputs: HandleInputs): Promise<Record<string, HandleData>> {
    return { effect: { type: "shake", ...this.config } as unknown as HandleData };
  }
}
