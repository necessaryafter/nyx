import { Elysia, t } from "elysia";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { requireAuth } from "../auth/session";
import { database } from "../database";
import { assets } from "../database/schema/assets";
import { jobs } from "../database/schema/jobs";
import { storageClient as minio, BUCKET_ASSETS } from "@nyx/shared";
import { generateImage } from "../lib/freegen";
import { GoogleGenAI } from "@google/genai";
import { resolveGeminiKey } from "../lib/ai/gemini";

export const imageRoutes = new Elysia({ prefix: "/api/jobs" })
  .use(requireAuth)
  .post(
    "/:id/slots/:slotIndex/generate-image",
    async ({ params, body, session, set }) => {
      const { id: jobId, slotIndex } = params;
      const { prompt } = body;

      // Verify the job belongs to this user
      const [job] = await database
        .select({ userId: jobs.userId })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);

      if (!job) {
        set.status = 404;
        return { error: "Job não encontrado" };
      }

      if (job.userId !== session.user.id) {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      // Generate image via freegen.app
      const { imageBuffer } = await generateImage(prompt);

      // Store as asset in MinIO
      const assetId = randomUUID();
      const name = `ai-scene-${slotIndex}-${Date.now()}.jpg`;
      const storageKey = `${session.user.id}/${assetId}/${name}`;

      await minio.putObject(BUCKET_ASSETS, storageKey, imageBuffer, imageBuffer.length);

      // Create asset record
      const [asset] = await database
        .insert(assets)
        .values({
          id: assetId,
          userId: session.user.id,
          name,
          type: "image",
          storageKey,
          sizeBytes: imageBuffer.length,
        })
        .returning();

      return { assetId: asset!.id };
    },
    {
      params: t.Object({
        id: t.String(),
        slotIndex: t.String(),
      }),
      body: t.Object({
        prompt: t.String({ minLength: 1 }),
      }),
    },
  )

  // ── Gera prompts de imagem para todos os slots via Gemini ──
  .post(
    "/:id/slots/generate-prompts",
    async ({ params, session, set }) => {
      const apiKey = await resolveGeminiKey(session.user.id);
      if (!apiKey) {
        set.status = 503;
        return { error: "Configure sua chave do Gemini em Configurações → Integrações" };
      }

      const [job] = await database
        .select({ userId: jobs.userId, sceneSlots: jobs.sceneSlots })
        .from(jobs)
        .where(eq(jobs.id, params.id))
        .limit(1);

      if (!job || job.userId !== session.user.id) {
        set.status = 404;
        return { error: "Job não encontrado" };
      }

      const slots = (job.sceneSlots ?? []) as Array<{ index: number; narrationText?: string }>;
      if (slots.length === 0) {
        set.status = 400;
        return { error: "Job não possui slots" };
      }

      const scenes = slots
        .map((s, i) => `Cena ${i + 1}: ${s.narrationText ?? ""}`)
        .join("\n");

      const systemPrompt = `Você é um diretor de arte especialista em criar prompts de imagem para vídeos.
Dado o texto de cada cena de uma narração em português, gere um prompt em INGLÊS para gerar uma imagem que ilustre visualmente aquela cena.
Os prompts devem ser descritivos, cinematográficos e adequados para geração de imagem por IA.
Responda APENAS com um JSON válido no formato: {"prompts": ["prompt da cena 1", "prompt da cena 2", ...]}
Sem explicações, sem markdown, apenas o JSON.`;

      const ai = new GoogleGenAI({ apiKey });

      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-1.5-flash-8b",
          config: { systemInstruction: systemPrompt, temperature: 0.7 },
          contents: [{ role: "user", parts: [{ text: scenes }] }],
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const isRateLimit = msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate");
        set.status = isRateLimit ? 429 : 500;
        return { error: isRateLimit ? "Limite de requisições do Gemini atingido. Aguarde alguns segundos e tente novamente." : `Erro ao chamar Gemini: ${msg}` };
      }

      const text = (response.text ?? "").trim();
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        set.status = 500;
        return { error: "Gemini retornou resposta inválida" };
      }

      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { prompts: string[] };
      return { prompts: parsed.prompts };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
