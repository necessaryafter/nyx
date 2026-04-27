import {
  ChatInputCommandInteraction,
  AttachmentBuilder,
} from "discord.js";
import { generateScript, Script } from "../lib/ai-studio";
import { queue, type QueueJob } from "../lib/queue";
import { logger } from "../lib/logger";

function buildInspiredInput(tema: string, referencia: string): string {
  return `${tema}

---
REFERENCE SCRIPT (structural calibration only — match genre, tone, pacing, and sentence rhythm; create 100% original content):
${referencia}`;
}

function formatScripts(scripts: Script[]): string {
  const lines: string[] = [];

  scripts.forEach((script, idx) => {
    const label = idx === 0 ? "HOOK" : `SEGMENTO ${idx}`;
    lines.push(`${label}: ${script.title}`);
    lines.push("─".repeat(50));

    script.scenes.forEach((scene, si) => {
      lines.push(`\nCena ${si + 1}:`);
      lines.push(scene.narration);
      lines.push(`[img] ${scene.imagePrompt}`);
    });

    lines.push("");
  });

  return lines.join("\n");
}

export async function handleRoteiro(interaction: ChatInputCommandInteraction) {
  const tema = interaction.options.getString("tema", true);
  const segmentos = interaction.options.getInteger("segmentos") ?? 1;
  const referencia = interaction.options.getString("inspirado_em");

  await interaction.deferReply();

  const willQueue = queue.activeCount >= queue.concurrency;
  const queuePos = queue.queueLength + 1;

  if (willQueue) {
    await interaction.editReply(`⏳ Na fila (posição ${queuePos}). Você será notificado quando iniciar.`);
  }

  const label = `Roteiro: ${tema.slice(0, 45)}`;
  const { promise } = queue.enqueue(label, interaction.user.id, (job) =>
    _handleRoteiro(interaction, tema, segmentos, referencia, job)
  );

  try {
    await promise;
  } catch (err) {
    logger.error(err, "Error in /roteiro");
    try {
      await interaction.editReply(`**Erro:** ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    } catch {}
  }
}

async function _handleRoteiro(
  interaction: ChatInputCommandInteraction,
  tema: string,
  segmentos: number,
  referencia: string | null,
  job: QueueJob,
) {
  const effectiveInput = referencia ? buildInspiredInput(tema, referencia) : tema;
  const suffix = referencia ? " _(baseado em referência)_" : "";

  let scripts: Script[];

  if (segmentos === 1) {
    job.setProgress("Gerando roteiro...", 0, 1);
    await interaction.editReply(`**Tema:** ${tema}${suffix}\n\n⏳ Gerando roteiro...`);
    const script = await generateScript(effectiveInput, "hook");
    scripts = [script];
    job.setProgress("Roteiro gerado", 1, 1);
    logger.info({ title: script.title }, "Roteiro (hook) generated");
  } else {
    job.setProgress(`Gerando ${segmentos} segmentos...`, 0, segmentos);
    await interaction.editReply(`**Tema:** ${tema}${suffix}\n\n⏳ Gerando ${segmentos} segmentos...`);
    const result = await generateScript(effectiveInput, "full", segmentos);
    scripts = result as Script[];
    job.setProgress("Roteiro gerado", segmentos, segmentos);
    logger.info({ segments: scripts.length, titles: scripts.map(s => s.title) }, "Roteiro (full) generated");
  }

  const text = formatScripts(scripts);
  const wordCount = scripts.flatMap(s => s.scenes).map(sc => sc.narration).join(" ").split(/\s+/).length;
  const summary = `**${scripts[0]!.title}** — ${scripts.length} segmento${scripts.length > 1 ? "s" : ""}, ~${wordCount} palavras`;

  if (text.length <= 1800) {
    await interaction.editReply(`${summary}\n\`\`\`\n${text}\`\`\``);
  } else {
    await interaction.editReply({
      content: summary,
      files: [new AttachmentBuilder(Buffer.from(text, "utf-8"), { name: "roteiro.txt" })],
    });
  }
}
