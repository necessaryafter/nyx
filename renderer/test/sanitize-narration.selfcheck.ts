// Regressão do bug: TTS falava símbolos de markdown em voz alta (ex.: "*" -> "asterisco")
// quando o roteiro gerado pela IA vinha com marcação mesmo sendo instruída a não usar.
// Cuidado central: só remove DECORAÇÃO markdown, nunca pontuação real — "?"/"!" mudam a
// entonação da fala (edge-tts lê frase interrogativa/exclamativa diferente) e têm que
// sair intactos.
import { sanitizeNarrationText } from "../src/tts/base.provider";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok: ${msg}`);
}

function main() {
  assert(sanitizeNarrationText("isso é *importante*") === "isso é importante", "* itálico");
  assert(sanitizeNarrationText("isso é **importante**") === "isso é importante", "** negrito");
  assert(sanitizeNarrationText("isso é _importante_") === "isso é importante", "_ itálico");
  assert(sanitizeNarrationText("isso é __importante__") === "isso é importante", "__ negrito");
  assert(sanitizeNarrationText("# Título\ncorpo") === "Título\ncorpo", "# header no início de linha");
  assert(sanitizeNarrationText("use `código` aqui") === "use código aqui", "` code");
  assert(sanitizeNarrationText("~~errado~~ certo") === "errado certo", "~~ strikethrough");
  assert(sanitizeNarrationText("> citação\ntexto") === "citação\ntexto", "> blockquote no início de linha");
  assert(sanitizeNarrationText("veja [este link](https://example.com) aqui") === "veja este link aqui", "[texto](url)");

  // Pontuação de entonação real — NUNCA pode ser removida, muda a fala do TTS.
  assert(sanitizeNarrationText("Eu fui babaca?") === "Eu fui babaca?", "? interrogação preservada");
  assert(sanitizeNarrationText("Que loucura!") === "Que loucura!", "! exclamação preservada");
  assert(sanitizeNarrationText("Isso, sim: funcionou.") === "Isso, sim: funcionou.", ", : . preservados");
  assert(sanitizeNarrationText("Espera; depois eu conto.") === "Espera; depois eu conto.", "; preservado");
  assert(
    sanitizeNarrationText("Ele perguntou: *\"você tem certeza?\"*") === 'Ele perguntou: "você tem certeza?"',
    "markdown removido, interrogação e aspas dentro do trecho preservadas",
  );

  assert(
    sanitizeNarrationText("Curta e comente para a parte 3.") === "Curta e comente para a parte 3.",
    "texto normal sem símbolo não muda",
  );

  // Separadores do Gemini em volta do roteiro — eram lidos no áudio e na legenda.
  assert(sanitizeNarrationText("---ROTEIRO---\nOi.\n---FIM---").trim() === "Oi.", "---ROTEIRO--- / ---FIM---");
  assert(sanitizeNarrationText("ROTEIRO ==\nOi.\nFIM ==").trim() === "Oi.", "ROTEIRO == / FIM ==");
  assert(sanitizeNarrationText("== ROTEIRO ==\nOi.\n== FIM ==").trim() === "Oi.", "== ROTEIRO == / == FIM ==");
  assert(sanitizeNarrationText("ROTEIRO:\nOi.\nFIM").trim() === "Oi.", "linha só com ROTEIRO: / FIM");
  assert(sanitizeNarrationText("Esse foi o fim da nossa história.") === "Esse foi o fim da nossa história.", "\"fim\" normal na frase fica");
  assert(sanitizeNarrationText("Fim.") === "Fim.", "\"Fim.\" como frase final fica");

  console.log("\nsanitize-narration.selfcheck: PASS");
}

main();
