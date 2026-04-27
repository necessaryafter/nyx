import {
  ChatInputCommandInteraction,
  AttachmentBuilder,
} from "discord.js";
import { generateScript } from "../lib/ai-studio";
import { queue, type QueueJob } from "../lib/queue";
import { logger } from "../lib/logger";

export async function handleGerar(interaction: ChatInputCommandInteraction) {
  const input = interaction.options.getString("tema", true);

  await interaction.deferReply();

  const willQueue = queue.activeCount >= queue.concurrency;
  const queuePos = queue.queueLength + 1;

  if (willQueue) {
    await interaction.editReply(`⏳ Na fila (posição ${queuePos}). Você será notificado quando iniciar.`);
  }

  const label = `Roteiro: ${input.slice(0, 40)}`;

  const { promise } = queue.enqueue(label, interaction.user.id, (job) =>
    _handleGerar(interaction, input, job)
  );

  try {
    await promise;
  } catch (err) {
    logger.error(err, "Error in /gerar");
    try { await interaction.editReply(`**Erro:** ${err instanceof Error ? err.message : "Erro desconhecido"}`); } catch {}
  }
}

async function _handleGerar(
  interaction: ChatInputCommandInteraction,
  input: string,
  job: QueueJob,
) {
  job.setProgress("Gerando roteiro...", 0, 1);
  await interaction.editReply(`**Tema:** ${input}\n\n⏳ Gerando roteiro com AI Studio...`);

  const script = await generateScript(input, "hook");
  logger.info({ title: script.title, scenes: script.scenes.length }, "Script generated");

  job.setProgress("Roteiro gerado", 1, 1);

  const lines: string[] = [];
  script.scenes.forEach((scene, i) => {
    lines.push(`**Cena ${i + 1}**`);
    lines.push(scene.narration);
    lines.push(`\`[img]\` ${scene.imagePrompt}`);
    lines.push("");
  });

  const text = lines.join("\n");
  const summary = `**${script.title}** — ${script.scenes.length} cenas`;

  if (text.length <= 1800) {
    await interaction.editReply(`${summary}\n\n${text}`);
  } else {
    await interaction.editReply({
      content: summary,
      files: [new AttachmentBuilder(Buffer.from(text, "utf-8"), { name: "roteiro.txt" })],
    });
  }
}
