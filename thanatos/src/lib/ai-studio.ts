import { GoogleGenAI } from "@google/genai";
import { HOOK_SYSTEM_PROMPT, FULL_SYSTEM_PROMPT } from "./prompts";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_STUDIO_KEY! });

export interface Scene {
  narration: string;
  imagePrompt: string;
}

export interface Script {
  title: string;
  scenes: Scene[];
}

async function callAI(systemPrompt: string, userContent: string): Promise<Script> {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
    },
    contents: userContent,
  });

  const text = response.text;
  if (!text) throw new Error("AI Studio returned empty response");
  return JSON.parse(text) as Script;
}

export async function generateScript(input: string, mode: "hook"): Promise<Script>;
export async function generateScript(input: string, mode: "full", segments: number): Promise<Script[]>;
export async function generateScript(input: string, mode: "hook" | "full", segments?: number): Promise<Script | Script[]> {
  if (mode === "hook") {
    return callAI(HOOK_SYSTEM_PROMPT, input);
  }

  const totalSegments = segments!;
  const result: Script[] = [];

  const hook = await callAI(HOOK_SYSTEM_PROMPT, input);
  result.push(hook);

  for (let i = 1; i < totalSegments; i++) {
    const isLast = i === totalSegments - 1;

    const previousNarration = result
      .map((s, idx) => `--- ${idx === 0 ? "Hook" : `Segment ${idx}`} ---\n${s.scenes.map(sc => sc.narration).join(" ")}`)
      .join("\n\n");

    const userContent = `Topic: ${input}

Previous segments (narration only — do NOT repeat any of this):
${previousNarration}

Position: segment ${i} of ${totalSegments - 1} (after the hook).${isLast ? "\nThis is the FINAL segment. Deliver genre-appropriate resolution." : "\nThis is a MIDDLE segment. Escalate and end on a new hook."}`;

    const segment = await callAI(FULL_SYSTEM_PROMPT, userContent);
    result.push(segment);
  }

  return result;
}