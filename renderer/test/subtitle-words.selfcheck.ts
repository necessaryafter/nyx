// Legenda: aspas do roteiro não aparecem na tela e o `",` solto não vira "palavra" própria.
import { cleanSubtitleWords } from "../src/ffmpeg/filters/subtitle";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok: ${msg}`);
}

const out = cleanSubtitleWords([
  { word: "indo?\"", startMs: 0, endMs: 100 },
  { word: "\",", startMs: 100, endMs: 200 },
  { word: "perguntei", startMs: 200, endMs: 300 },
  { word: "“Caio”", startMs: 300, endMs: 400 },
]);
assert(out.map((w) => w.word).join(" ") === "indo? perguntei Caio", "aspas removidas e sobra solta descartada");
assert(out[0]!.endMs === 200, "tempo da sobra fica com a palavra anterior");
assert(out.length === 3, "nenhuma palavra real some");
console.log("subtitle-words selfcheck passed");
