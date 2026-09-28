import { Elysia, t } from "elysia";
import { requireAuth } from "../auth/session";
import { resolveGeminiKey, createGemini, listGeminiModels } from "../lib/ai/gemini";
import { BASE_SYSTEM_PROMPT, DURATION_RULES } from "../lib/ai/prompts";
import { generateSeriesScript } from "../lib/ai/seriesScript";

const NO_KEY_ERROR = "Configure sua chave do Gemini em Configurações → Integrações";

export const aiRoutes = new Elysia({ prefix: "/api/ai" })
  .use(requireAuth)

  .get("/models", async ({ session, set }) => {
    const apiKey = await resolveGeminiKey(session.user.id);
    if (!apiKey) {
      set.status = 503;
      return { error: NO_KEY_ERROR };
    }
    return listGeminiModels(apiKey);
  })

  .post(
    "/script",
    async ({ body, session, set }) => {
      const apiKey = await resolveGeminiKey(session.user.id);
      if (!apiKey) {
        set.status = 503;
        return { error: NO_KEY_ERROR };
      }

      const { messages, model, duration } = body;

      // Concatena a base do prompt com a regra específica injetada para a requisição corrente
      const systemInstruction = `${BASE_SYSTEM_PROMPT}\n\n${DURATION_RULES[duration]}`;
      const ai = createGemini(apiKey);

      const response = await ai.models.generateContent({
        model,
        config: {
          systemInstruction,
          maxOutputTokens: duration === "long" ? 8192 : 2048, // Aumenta o teto de tokens caso o vídeo seja longo
          temperature: 0.8,
        },
        contents: messages.map((m) => ({
          role: m.role,
          parts: [{ text: m.text }],
        })),
      });

      const text = response.text ?? "";
      return { text };
    },
    {
      body: t.Object({
        messages: t.Array(
          t.Object({
            role: t.Union([t.Literal("user"), t.Literal("model")]),
            text: t.String(),
          }),
        ),
        model: t.String(),
        duration: t.Union([t.Literal("short"), t.Literal("long")]), // Validação estrita do tipo do vídeo no TypeBox
      }),
    },
  )

  // Preview do roteiro de uma série em N partes (job-scheduler) — não persiste nada.
  .post(
    "/series-script",
    async ({ body, session, set }) => {
      const apiKey = await resolveGeminiKey(session.user.id);
      if (!apiKey) {
        set.status = 503;
        return { error: NO_KEY_ERROR };
      }

      try {
        return await generateSeriesScript({ ...body, apiKey });
      } catch (err) {
        set.status = 502;
        return { error: err instanceof Error ? err.message : "Falha ao gerar roteiro da série" };
      }
    },
    {
      body: t.Object({
        model: t.String(),
        theme: t.String({ minLength: 10, maxLength: 2000 }),
        parts: t.Integer({ minimum: 1, maximum: 10 }),
        minutesPerPart: t.Number({ minimum: 0.5, maximum: 10 }),
        ctaTemplate: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        finalCtaTemplate: t.Optional(t.String({ maxLength: 200 })),
        avoidTitles: t.Optional(t.Array(t.String())),
      }),
    },
  );
