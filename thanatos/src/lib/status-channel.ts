import { Client, EmbedBuilder, Colors, TextChannel, Message } from "discord.js";
import { queue, type QueueJob } from "./queue";
import { logger } from "./logger";

const STATUS_CHANNEL_ID = "1489274097958392021";
const REFRESH_INTERVAL_MS = 20_000;

let statusMessage: Message | null = null;
let updateScheduled = false;

function eta(job: QueueJob): string {
  if (!job.startedAt || job.totalSteps === 0 || job.step === 0) return "calculando...";
  const elapsed = Date.now() - job.startedAt;
  const msPerStep = elapsed / job.step;
  const remainingMs = msPerStep * (job.totalSteps - job.step);
  const secs = Math.round(remainingMs / 1000);
  if (secs <= 5) return "quase pronto";
  if (secs < 60) return `~${secs}s`;
  return `~${Math.round(secs / 60)}min`;
}

function elapsed(startedAt: number): string {
  const secs = Math.round((Date.now() - startedAt) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.round(secs / 60)}min`;
}

function progressBar(step: number, total: number): string {
  if (total === 0) return "";
  const filled = Math.round((step / total) * 10);
  return `\`[${"█".repeat(filled)}${"░".repeat(10 - filled)}]\` ${step}/${total}`;
}

function buildEmbed(): EmbedBuilder {
  const { active, pending, recent } = queue.snapshot();
  const embed = new EmbedBuilder().setTitle("🎬 Fila de Produção").setTimestamp();

  if (active.length === 0 && pending.length === 0) {
    embed.setColor(Colors.Green).setDescription("✅ Nenhum job em andamento.");
  } else {
    embed.setColor(Colors.Yellow);
  }

  for (const job of active) {
    const bar = job.totalSteps > 0 ? progressBar(job.step, job.totalSteps) : "";
    const lines = [
      `📍 ${job.progress}`,
      bar,
      `⏱ ${elapsed(job.startedAt!)} decorrido | ETA: ${eta(job)}`,
    ].filter(Boolean).join("\n");

    embed.addFields({ name: `⚙️ ${job.label}`, value: lines });
  }

  if (pending.length > 0) {
    const text = pending.map((j, i) => `${i + 1}. ${j.label}`).join("\n");
    embed.addFields({ name: `⏳ Na Fila (${pending.length})`, value: text });
  }

  if (recent.length > 0) {
    const text = recent.map(j => {
      const icon = j.status === "done" ? "✅" : "❌";
      const dur = j.startedAt && j.doneAt
        ? ` (${Math.round((j.doneAt - j.startedAt) / 1000)}s)`
        : "";
      return `${icon} ${j.label}${dur}`;
    }).join("\n");
    embed.addFields({ name: "Recentes", value: text });
  }

  return embed;
}

async function updateEmbed(channel: TextChannel) {
  const embed = buildEmbed();
  try {
    if (statusMessage) {
      await statusMessage.edit({ embeds: [embed] });
    } else {
      statusMessage = await channel.send({ embeds: [embed] });
    }
  } catch {
    // Message was deleted or inaccessible — send a new one
    statusMessage = null;
    try {
      statusMessage = await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.warn({ err }, "Failed to send status embed");
    }
  }
}

export async function initStatusChannel(client: Client) {
  let channel: TextChannel;
  try {
    const fetched = await client.channels.fetch(STATUS_CHANNEL_ID);
    if (!fetched || !("send" in fetched)) {
      logger.warn({ channelId: STATUS_CHANNEL_ID }, "Status channel not found");
      return;
    }
    channel = fetched as TextChannel;
  } catch (err) {
    logger.warn({ err }, "Could not fetch status channel");
    return;
  }

  // Try to reuse last bot embed in channel
  try {
    const msgs = await channel.messages.fetch({ limit: 20 });
    const existing = msgs.find(m => m.author.id === client.user!.id && m.embeds.length > 0);
    if (existing) statusMessage = existing;
  } catch {}

  await updateEmbed(channel);

  // Debounced updates on queue events
  queue.on("update", () => {
    if (updateScheduled) return;
    updateScheduled = true;
    setTimeout(async () => {
      updateScheduled = false;
      await updateEmbed(channel);
    }, 1_500);
  });

  // Periodic refresh (in case of stale state)
  setInterval(() => updateEmbed(channel), REFRESH_INTERVAL_MS);

  logger.info({ channelId: STATUS_CHANNEL_ID }, "Status channel initialized");
}
