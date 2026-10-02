// Listas fixas pros selects de voz. Os textos dos estilos (presets) ficam no renderer
// (gemini.provider.ts) — aqui só os rótulos.

export const EDGE_VOICES = [
  { value: "pt-BR-AntonioNeural", label: "Antonio (masculina)" },
  { value: "pt-BR-FranciscaNeural", label: "Francisca (feminina)" },
  { value: "pt-BR-ThalitaMultilingualNeural", label: "Thalita (feminina, multilíngue)" },
  { value: "en-US-AndrewMultilingualNeural", label: "Andrew (masculina, multilíngue)" },
  { value: "en-US-BrianMultilingualNeural", label: "Brian (masculina, multilíngue)" },
  { value: "en-US-AvaMultilingualNeural", label: "Ava (feminina, multilíngue)" },
];

export const GEMINI_TTS_MODELS = [
  { value: "gemini-3.8-flash-lite-tts", label: "Gemini 3.8 Flash-Lite TTS (padrão)" },
  { value: "gemini-3.8-flash-tts", label: "Gemini 3.8 Flash TTS (melhor, cota grátis menor)" },
];
export const DEFAULT_GEMINI_TTS_MODEL = GEMINI_TTS_MODELS[0]!.value;

export const GEMINI_VOICES = [
  ["Algenib", "grave, áspera"], ["Charon", "informativa"], ["Zubenelgenubi", "casual"],
  ["Orus", "firme"], ["Enceladus", "soprada"], ["Kore", "firme"], ["Puck", "animada"],
  ["Fenrir", "empolgada"], ["Zephyr", "clara"], ["Leda", "jovem"], ["Aoede", "leve"],
  ["Callirrhoe", "tranquila"], ["Autonoe", "clara"], ["Iapetus", "nítida"], ["Umbriel", "tranquila"],
  ["Algieba", "suave"], ["Despina", "suave"], ["Erinome", "nítida"], ["Rasalgethi", "informativa"],
  ["Laomedeia", "animada"], ["Achernar", "suave"], ["Alnilam", "firme"], ["Schedar", "equilibrada"],
  ["Gacrux", "madura"], ["Pulcherrima", "direta"], ["Achird", "amigável"], ["Vindemiatrix", "gentil"],
  ["Sadachbia", "viva"], ["Sadaltager", "conhecedora"], ["Sulafat", "calorosa"],
].map(([value, desc]) => ({ value: value!, label: `${value} (${desc})` }));
export const DEFAULT_GEMINI_VOICE = "Algenib";

export const STYLE_PRESETS = [
  { value: "rapido", label: "Rápido (storytime Reddit)" },
  { value: "moderado", label: "Moderado" },
  { value: "lento", label: "Lento (mais tenso)" },
] as const;

// speed é um multiplicador (1 = normal); na tela aparece como % em relação ao normal (1.02 -> +2%).
export function formatSpeedPct(speed = 1): string {
  const pct = Math.round((speed - 1) * 100);
  return pct === 0 ? "normal (0%)" : `${pct > 0 ? "+" : ""}${pct}%`;
}
