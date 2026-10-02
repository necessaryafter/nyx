// Gemini TTS sem rede: corpo do pedido (modelo/voz/estilo), leitura do áudio da resposta e
// o filtro final (corte de pausas longas que travavam a legenda + atempo no modo slider).
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { buildGeminiRequest, extractGeminiAudio, finishFilter, pauseCuts, resolveStyle, splitLastSentence, STYLE_PRESETS, DEFAULT_GEMINI_TTS_MODEL } from "../src/tts/providers/gemini.provider";
import { run, ffmpegStderr } from "../src/ffmpeg/runner";
import { frozenTailSec } from "../src/ffmpeg/freeze";
import { probeDuration } from "../src/ffmpeg/probe";
import { sentenceSlots } from "../src/sceneSlots";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok: ${msg}`);
}

async function main() {
  const req = buildGeminiRequest("Oi.", { provider: "gemini", voice: "Charon", model: "gemini-3.8-flash-tts", stylePreset: "rapido" });
  assert(req.model === "gemini-3.8-flash-tts" && req.generation_config.speech_config[0]!.voice === "Charon", "modelo e voz vão no pedido");
  assert((req.input[0]!.content[0] as any).annotations[0].style === STYLE_PRESETS.rapido, "preset rápido vira o estilo");

  const def = buildGeminiRequest("Oi.", { provider: "gemini" });
  assert(def.model === DEFAULT_GEMINI_TTS_MODEL && def.generation_config.speech_config[0]!.voice === "Algenib", "padrão: Flash-Lite + Algenib");
  assert(resolveStyle({ stylePreset: undefined }) === STYLE_PRESETS.moderado, "sem preset = moderado");
  assert(resolveStyle({ stylePreset: "custom", style: "  sussurrado  " }) === "sussurrado", "personalizado usa o texto livre");
  assert(resolveStyle({ stylePreset: "custom", style: " " }) === undefined, "personalizado vazio = sem estilo");
  const slider = buildGeminiRequest("Oi.", { provider: "gemini", paceMode: "slider", stylePreset: "rapido" });
  assert(!("annotations" in slider.input[0]!.content[0]!), "modo slider não manda estilo");

  // CTA (última frase) num trecho próprio, com estilo moderado — o Gemini atropelava.
  const outro = buildGeminiRequest("Fechei o notebook. Curta e comente para a parte 2.", { stylePreset: "rapido" }, { slowOutro: true });
  const items = outro.input[0]!.content as any[];
  assert(items.length === 2 && items[0].text === "Fechei o notebook." && items[1].text.trim() === "Curta e comente para a parte 2.", "última frase vira trecho separado");
  assert(items[0].annotations[0].style === STYLE_PRESETS.rapido && /moderado/.test(items[1].annotations[0].style), "corpo no preset, CTA moderado");
  assert(buildGeminiRequest("Fechei. Fim.", { stylePreset: "lento" }, { slowOutro: true }).input[0]!.content.length === 1, "preset lento não separa");
  assert(buildGeminiRequest("Fechei. Fim.", { paceMode: "slider" }, { slowOutro: true }).input[0]!.content.length === 1, "modo slider não separa");
  assert(splitLastSentence("Uma frase só.").length === 1, "uma frase só não separa");
  assert(splitLastSentence("A casa, às 3h. E então? Curta e comente!").join("|") === "A casa, às 3h. E então?|Curta e comente!", "separa na última frase");

  const audio = extractGeminiAudio({ steps: [{ type: "model_output", content: [{ type: "audio", data: Buffer.from("RIFF").toString("base64") }] }] });
  assert(audio.toString() === "RIFF", "áudio lido de steps[].content[]");
  let threw = false;
  try { extractGeminiAudio({ steps: [] }); } catch { threw = true; }
  assert(threw, "resposta sem áudio dá erro claro");

  assert(!finishFilter([], { paceMode: "style", speed: 1.4 }).includes("atempo"), "modo estilo ignora o slider");
  assert(finishFilter([], { paceMode: "slider", speed: 1.25 }).endsWith("atempo=1.25"), "modo slider aplica atempo");
  assert(JSON.stringify(pauseCuts("silence_start: 1\nsilence_end: 3\nsilence_start: 4\nsilence_end: 4.3\nsilence_start: 9")) === "[[1.12,2.77]]",
    "corta só o miolo das pausas longas (curta e a do fim do arquivo ficam)");

  // Final congelado do vídeo: freezes encostados contam juntos; termina andando = 0.
  assert(Math.abs(frozenTailSec("freeze_start: 1.4667\nfreeze_end: 1.8667\nfreeze_start: 1.8667") - 1.5333) < 0.001, "freeze encostado no fim conta junto");
  assert(frozenTailSec("freeze_start: 0.5\nfreeze_end: 1.0") === 0, "freeze no meio não corta");
  assert(frozenTailSec("") === 0, "sem freeze não corta");

  // Slots por frase: whisperx no render só alinha a 1ª frase de cada slot.
  const w = (word: string, startMs: number) => ({ word, startMs, endMs: startMs + 100 });
  const words = [w("Minha", 0), w("avó", 200), w("morreu.", 400), w("Às", 1000), w("3h17", 1200), w("tocou.", 1400), w("Fim", 2000)];
  const slots = sentenceSlots(words, "Minha avó morreu. Às três e dezessete tocou. Fim");
  assert(slots.length === 3 && slots[1]!.startMs === 1000 && slots[1]!.endMs === 1500, "um slot por frase, com o tempo da frase");
  assert(slots[1]!.narrationText === "Às três e dezessete tocou.", "usa o texto do roteiro quando o nº de frases bate");
  const fallback = sentenceSlots(words, "Uma frase só.");
  assert(fallback[1]!.narrationText === "Às 3h17 tocou.", "nº de frases diferente => usa a transcrição");

  // 1s fala + 2s silêncio + 1s fala com COMEÇO SUAVE (fade-in de 0,3s): a pausa vira ~0,35s
  // e a segunda fala sai inteira (silenceremove comia esse começo).
  const dir = await mkdtemp(join(tmpdir(), "gemini-tts-check-"));
  try {
    const src = join(dir, "src.wav"), out = join(dir, "out.wav"), fast = join(dir, "fast.wav");
    await run(["-y", "-f", "lavfi", "-i", "sine=f=440:d=1", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono:d=2", "-f", "lavfi", "-i", "sine=f=440:d=1",
      "-filter_complex", "[0:a]aresample=24000,aformat=channel_layouts=mono[a];[2:a]aresample=24000,aformat=channel_layouts=mono,afade=t=in:d=0.3[c];[a][1:a][c]concat=n=3:v=0:a=1", src]);
    const cuts = pauseCuts(await ffmpegStderr(["-i", src, "-af", "silencedetect=n=-50dB:d=0.35", "-f", "null", "-"]));
    await run(["-y", "-i", src, "-af", finishFilter(cuts, { paceMode: "style" }), out]);
    const d = await probeDuration(out);
    assert(Math.abs(d - 2.35) < 0.05, `pausa de 2s vira 0,35s sem comer fala (4s -> ${d.toFixed(2)}s, esperado 2,35s)`);
    await run(["-y", "-i", src, "-af", finishFilter(cuts, { paceMode: "slider", speed: 2 }), fast]);
    const f = await probeDuration(fast);
    assert(Math.abs(f - d / 2) < 0.1, `slider 2x reduz pela metade (${f.toFixed(2)}s)`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  console.log("\ngemini-tts.selfcheck: PASS");
}

main().catch((err) => { console.error(err); process.exit(1); });
