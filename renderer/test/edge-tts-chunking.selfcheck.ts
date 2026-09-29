// Regressão do bug: texto perto do limite de chunk do edge-tts deixava o CTA final
// ("Curta e comente...") isolado num chunk próprio — sem pausa natural antes dele e,
// às vezes, sem timestamps (edge-tts não manda boundary pra chunk curto isolado),
// fazendo o texto sumir da legenda mesmo estando audível.
import { splitTextIntoChunks, fallbackTimestamps } from "../src/tts/providers/edge.provider";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok: ${msg}`);
}

function main() {
  // Corpo grande o bastante pra passar de 2500 chars sozinho, + CTA curto no fim —
  // reproduz exatamente o cenário relatado (perto do limite de 3min por parte).
  const body = "Isso é uma frase de teste. ".repeat(95); // ~2565 chars
  const cta = "Curta e comente para a parte 3.";
  const text = `${body}${cta}`;

  const chunks = splitTextIntoChunks(text, 2500);
  assert(chunks.length >= 1, "gera pelo menos 1 chunk");
  assert(
    chunks[chunks.length - 1]!.includes("Curta e comente"),
    "o CTA continua presente em algum chunk",
  );
  assert(
    chunks.length === 1 || chunks[chunks.length - 1]!.length >= 300,
    "o último chunk não fica isolado curtinho (foi mesclado no anterior)",
  );

  // fallback: quando o edge-tts não devolve nenhum boundary pro chunk, ainda assim
  // o texto vira timestamps (não desaparece da legenda).
  const fallback = fallbackTimestamps("Curta e comente para a parte 3", 10_000, 2_000);
  assert(fallback.length === 7, "fallbackTimestamps gera 1 entrada por palavra");
  assert(fallback[0]!.startMs === 10_000, "primeiro timestamp começa no offset dado");
  assert(fallback[fallback.length - 1]!.endMs === 12_000, "último timestamp termina no fim da duração do chunk");

  console.log("\nedge-tts-chunking.selfcheck: PASS");
}

main();
