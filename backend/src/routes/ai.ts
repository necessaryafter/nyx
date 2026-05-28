import { Elysia, t } from "elysia";
import { GoogleGenAI } from "@google/genai";
import { requireAuth } from "../auth/session";

// Base estável do prompt sem as amarras de tamanho fixo
const BASE_SYSTEM_PROMPT = `Você é um roteirista fantasma de elite, especialista em micro-storytelling de alta retenção para vídeos em português brasileiro.

Seu único objetivo é transformar a ideia do usuário em um roteiro magnético, visceral e direto ao ponto, feito sob medida para prender a atenção e manter o espectador imerso.

DIRETRIZES DE ESCRITA E RITMO:
- Ritmo de Fala Cortado: Escreva com frases curtas. Use pontuação para criar pausas dramáticas naturais para a IA de voz. Evite parágrafos longos ou termos difíceis.
- Anticlachê Estrito: Proibido usar jargões cafonas de "coach" ou palavras batidas como: "sucesso", "triunfo", "jornada", "guerreiro", "vencer", "desistir", "obstáculos".
- Detalhes Sensoriais: Substitua conceitos abstratos por microdetalhes realistas (ex: em vez de "fiquei pobre", use "o eco do apartamento vazio e o gosto de café frio").
- Conclusão Provocativa: O final nunca deve ser uma lição de moral barata. Deve ser uma pergunta reflexiva, um soco no estômago ou um paradoxo que force o espectador a pensar ou a comentar.

REGRAS DE FORMATAÇÃO DO SISTEMA:
- Separe cada bloco/frase de impacto com EXATAMENTE uma linha em branco (obrigatório para a geração correta de timestamps no sistema).

Quando apresentar o roteiro finalizado ou revisado, você deve ignorar qualquer outra conversa e usar estritamente o formato abaixo:

---ROTEIRO---
[Texto do roteiro aqui, quebrado linha a linha com uma linha em branco entre os blocos]
---FIM---`;

// Configurações dinâmicas de acordo com o payload
const DURATION_RULES = {
  short: `
DIRETRIZES ESPECÍFICAS DE DURAÇÃO (VÍDEO CURTO):
- Mantenha o texto total entre 110 e 140 palavras (ideal para 45 a 60 segundos).
- Estrutura direta: Gancho de impacto imediato nos primeiros 3 segundos, desenvolvimento rápido e um soco no estômago no final.
- Quebra de Padrão no Início: Comece no meio de uma ação. Nunca use "Você já pensou..." ou "Imagine se...".`,
  
  long: `
DIRETRIZES ESPECÍFICAS DE DURAÇÃO (VÍDEO LONGO):
- Mantenha o texto total entre 900 e 1050 palavras (ideal para ~7 minutos em ritmo pausado e reflexivo).
- Estrutura obrigatória em 4 Atos bem definidos: 
  1. O Fundo do Poço Realista (Introdução imersiva focada no cenário).
  2. A Rotina e o Isolamento (O processo psicológico e técnico do trabalho duro).
  3. O Ápice do Conflito (A grande tensão de colocar o projeto à prova, o risco palpável da falha).
  4. A Resolução Pragmática e Filosofia Final (O retorno, mas com uma perspectiva fria e mudada).
- Use micro-ganchos de transição a cada 1 ou 2 minutos para renovar o fôlego do espectador e evitar drop na retenção.`
};

export const aiRoutes = new Elysia({ prefix: "/api/ai" })
  .use(requireAuth)
  .post(
    "/script",
    async ({ body, set }) => {
      const apiKey = process.env.GOOGLE_AI_STUDIO_KEY;
      if (!apiKey) {
        set.status = 503;
        return { error: "GOOGLE_AI_STUDIO_KEY não configurada no servidor" };
      }

      const { messages, model, duration } = body;

      // Concatena a base do prompt com a regra específica injetada para a requisição corrente
      const systemInstruction = `${BASE_SYSTEM_PROMPT}\n\n${DURATION_RULES[duration]}`;
      const ai = new GoogleGenAI({ apiKey });

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
  );
