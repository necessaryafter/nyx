# Spec: `ai-keys` — Chave Gemini por usuário e lista de modelos

> Módulo do mapa `capability-map.md`. Contexto técnico, comandos, estilo e limites comuns estão lá; aqui só o que é específico.
> Status: rascunho para revisão.

## Objetivo

Hoje o Gemini usa uma chave única do servidor (`GOOGLE_AI_STUDIO_KEY`) e a lista de modelos é fixa no front — já quebrou uma vez (`gemini-2.0-flash` e `gemini-1.5-pro` foram descontinuados pelo Google e a API passou a recusar).

Queremos que cada usuário use **a própria chave** (gasta a própria cota), configurada em **Configurações → Integrações** exatamente como o Talkify já é, e que a lista de modelos venha **da API do Google**, não de código.

**Usuário:** dono de canal usando o Nyx. **Sucesso:** ele cola a chave uma vez em Integrações, e tanto o chat de roteiro do wizard quanto o Scheduler passam a funcionar com ela, escolhendo modelos que existem de verdade.

## Escopo

- Provider `"gemini"` na tabela `integrations` (já existe, genérica: `userId + provider + encryptedApiKey`). **Sem migration.**
- Resolução de chave compartilhada: integração do usuário → env `GOOGLE_AI_STUDIO_KEY` → erro 503 com instrução.
- Endpoint de modelos disponíveis, com cache.
- `/api/ai/script` passa a usar a resolução acima (comportamento igual quando há chave).
- Card Gemini na aba Integrações; seletor de modelo do wizard passa a consumir o endpoint.

Fora de escopo: outros provedores (OpenAI etc.), chave por scheduler, cobrança de créditos pelo uso de IA.

## API

### `PUT /api/integrations/gemini`
Body: `{ apiKey: string }`.
Antes de salvar, valida a chave chamando `GET https://generativelanguage.googleapis.com/v1beta/models?key=…` (200 = válida). 400 `{ error: "chave inválida" }` se não. Salva com `encrypt()`; upsert por `(userId, provider)`.
Resposta 200: `{ provider: "gemini", maskedKey: "****XXXX" }`.

### `DELETE /api/integrations/gemini`
Remove a linha. 204.

### `GET /api/integrations`
Já existe; passa a listar `gemini` também sem mudança de código (é genérico).

### `GET /api/ai/models`
Resposta 200: `Array<{ id: string; label: string }>` — só modelos `models/gemini-*` que suportam `generateContent`, sem variantes de embedding/tts/image/robotics/computer-use. `id` sem o prefixo `models/`. `label` = id legível ("gemini-3.8-flash" → "Gemini 3.8 Flash").
Cache em memória por **chave** (não por usuário) com TTL 1 h — a lista é a mesma para a mesma chave.
503 `{ error: "Configure sua chave do Gemini em Configurações → Integrações" }` se não houver chave resolvível.

### `POST /api/ai/script` (existente)
Única mudança: chave via `resolveGeminiKey(userId)`. Mesmos body/resposta. Mensagem do 503 passa a ser a mesma acima.

## Estrutura

```
backend/src/lib/ai/gemini.ts          → resolveGeminiKey, validateGeminiKey, listGeminiModels, createGemini
backend/src/routes/integrations.ts    → + PUT/DELETE /gemini (espelho do /talkify, sem duplicar lógica: extrair upsertIntegration/removeIntegration)
backend/src/routes/ai.ts              → GET /models; POST /script usa resolveGeminiKey
backend/src/__tests__/ai-keys.test.ts → testes
web/src/hooks/useAiModels.ts          → useQuery(["ai","models"]) com staleTime 1h
web/src/pages/SettingsPage.tsx        → IntegrationsTab: card Gemini (mesmo componente/visual do card Talkify)
web/src/pages/wizard/Step2_Narration.tsx → AI_MODELS fixo vira fallback; usa useAiModels()
```

## Contratos (TypeScript)

```ts
// backend/src/lib/ai/gemini.ts
export async function resolveGeminiKey(userId: string): Promise<string | null>;  // integração → env → null
export async function validateGeminiKey(apiKey: string): Promise<boolean>;
export async function listGeminiModels(apiKey: string): Promise<Array<{ id: string; label: string }>>; // com cache
export function createGemini(apiKey: string): GoogleGenAI;
```

## Estilo

Seguir o card do Talkify em `SettingsPage.tsx` linha a linha (título, chave mascarada, input, botões salvar/remover, texto de ajuda com link). Texto de ajuda do Gemini: "Gere uma chave gratuita em aistudio.google.com/apikey". Nada de novo componente.

## Testes

`backend/src/__tests__/ai-keys.test.ts` (bun:test, mocks de `helpers/setup.ts`):
- `resolveGeminiKey`: (a) integração existe → devolve decrypt; (b) sem integração e env setado → env; (c) nada → null.
- `listGeminiModels`: filtra `generateContent` e prefixo `gemini-`; exclui `-tts`, `-image`, `embedding`, `robotics`, `computer-use`; segunda chamada com a mesma chave não bate na rede (cache).
- `PUT /gemini`: 400 quando `validateGeminiKey` mockado devolve false; 200 + maskedKey quando true; grava criptografado (`encrypt` chamado).
- `GET /api/ai/models`: 503 sem chave; 200 lista com chave.

## Limites específicos

- **Nunca** logar a chave (nem parcial além do `****XXXX` já usado). **Nunca** devolver a chave em texto puro em nenhuma resposta.
- **Perguntar antes** de mudar o formato de `integrations` (não deveria precisar).

## Critérios de sucesso

1. Usuário sem `GOOGLE_AI_STUDIO_KEY` no servidor cola a chave em Integrações e o chat de roteiro do wizard funciona.
2. Chave inválida é recusada na hora de salvar, com mensagem clara, sem gravar nada.
3. `GET /api/ai/models` devolve só modelos que a API do Google aceita hoje; escolher qualquer um da lista no wizard gera roteiro sem 404.
4. Remover a chave volta o wizard a mostrar "Configure sua chave…" (ou usa a env, se existir).
5. `bun test` verde; nenhuma rota de jobs/templates alterada.

## Questões abertas

1. Manter o fallback pra env em produção? Proposta: manter, com `AI_ALLOW_SERVER_KEY=false` para desligar quando quiser cobrar/limitar.
2. Mostrar na UI qual chave está em uso ("sua chave" vs "chave do servidor")? Proposta: só um aviso discreto quando estiver usando a do servidor.
