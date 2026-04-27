import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events, ChatInputCommandInteraction } from "discord.js";
import { handleGerar } from "./commands/gerar";
import { handleRoteiro } from "./commands/roteiro";
import { initStatusChannel } from "./lib/status-channel";
import { logger } from "./lib/logger";

const REQUIRED_ENV = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "NYX_API_URL", "NYX_API_KEY", "GOOGLE_AI_STUDIO_KEY", "RAPHAEL_EMAIL", "RAPHAEL_PASSWORD"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

const commands = [
  new SlashCommandBuilder()
    .setName("gerar")
    .setDescription("Gera um vídeo automaticamente com IA")
    .addStringOption(opt =>
      opt.setName("tema").setDescription("Tema ou roteiro de inspiração para o vídeo").setRequired(true)
    )
    .addAttachmentOption(opt =>
      opt.setName("audio")
        .setDescription("Áudio da narração (MP3/WAV/OGG)")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("modo")
        .setDescription("O que fazer após gerar o conteúdo")
        .setRequired(false)
        .addChoices(
          { name: "Renderizar vídeo (padrão)", value: "render" },
          { name: "Preview — roteiro + imagens no Discord", value: "preview" },
        )
    ),
  new SlashCommandBuilder()
    .setName("roteiro")
    .setDescription("Gera um roteiro com IA (sem renderizar)")
    .addStringOption(opt =>
      opt.setName("tema").setDescription("Tema do vídeo").setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName("segmentos")
        .setDescription("Número de segmentos (1 = só hook, 2-5 = série completa)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(5)
    )
    .addStringOption(opt =>
      opt.setName("inspirado_em")
        .setDescription("Cole um roteiro de referência — mantém a estrutura mas cria conteúdo 100% original")
        .setRequired(false)
    ),
];

// Register slash commands
const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
await rest.put(
  Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
  { body: commands.map(c => c.toJSON()) },
);
logger.info("Slash commands registered");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  logger.info(`Thanatos online as ${c.user.tag}`);
  await initStatusChannel(c);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Only allow configured users
  const allowedUsers = process.env.ALLOWED_USER_IDS?.split(",").map(s => s.trim()) ?? [];
  if (allowedUsers.length > 0 && !allowedUsers.includes(interaction.user.id)) {
    await interaction.reply({ content: "Acesso não autorizado.", ephemeral: true });
    return;
  }

  if (interaction.commandName === "gerar") {
    await handleGerar(interaction as ChatInputCommandInteraction);
  } else if (interaction.commandName === "roteiro") {
    await handleRoteiro(interaction as ChatInputCommandInteraction);
  }
});

client.login(process.env.DISCORD_TOKEN!);
