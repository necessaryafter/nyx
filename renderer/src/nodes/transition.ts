import { BaseNodeExecutor, type HandleData, type HandleInputs } from "./executor";

// Inputs:  (nenhum)
// Outputs: effect (EffectConfig { type: "transition", ...TransitionConfig })
export class TransitionExecutor extends BaseNodeExecutor<"Transition"> {
  async execute(_inputs: HandleInputs): Promise<Record<string, HandleData>> {
    return { effect: { type: "transition", ...this.config } as unknown as HandleData };
  }
}
