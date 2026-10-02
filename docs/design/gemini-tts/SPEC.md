# Spec: Gemini TTS como provedor de voz

## Objetivo

Hoje a narração só sai pelo Edge TTS (ou Talkify), e a mesma voz serve pra todo tema — o
Antonio funciona em "traição" e fica ruim em "terror". O Gemini TTS deixa escolher voz
(30 prontas) e **estilo em texto livre** ("rápido, tom de conversa, leve tensão"), usando a
chave do Gemini que o usuário já tem (free tier).

Quem usa: o dono do Nyx, configurando templates e schedulers.

### Critérios de aceite

1. **Template (nó Narração):** o seletor de provedor ganha "Gemini". Com Gemini, aparecem
   *Modelo* (select), *Voz* (select com as 30 vozes + descrição) e *Velocidade* com modo
   Slider ou Estilo (preset Rápido/Moderado/Lento, ou Personalizar → texto livre).
   Com Edge, continua tudo como hoje (voz + velocidade).
2. **Scheduler:** nova seção *Voz* com "Usar a do template" (padrão) / "Edge" / "Gemini",
   com os mesmos campos do item 1. O que for escolhido aqui sobrescreve o nó Narração do
   template só para esse scheduler.
3. **Render:** um job com provider `gemini` gera o áudio pelo Gemini, com legenda
   sincronizada (tempos via whisperx) e pausas longas encurtadas (silêncio > 0,35s → 0,25s),
   que era o que travava a legenda.
4. **Nada vira Talkify por engano:** todo lugar que hoje faz "se não é edge, é talkify"
   passa a respeitar `gemini`.
5. Edge e Talkify continuam funcionando exatamente como antes.
6. Erro de cota (429) ou sobrecarga (503) do Gemini falha o job com mensagem clara
   ("cota diária do Gemini TTS esgotada…"), sem travar.

## Decisões (ponytail — o mínimo que resolve)

- **Sem dependência nova.** O SDK instalado (`@google/genai` 1.52) não suporta o formato
  de estilo do 3.8; em vez de atualizar o SDK (mexeria na geração de roteiro), a chamada é
  um `fetch` direto em `POST /v1beta/interactions` — testado, funciona com estilo.
- **Config no próprio nó**, sem tabela nova: `NarrationSourceConfig` ganha `model?` e
  `style?`; `voice` passa a guardar o nome da voz do Gemini quando o provider é gemini.
- **Scheduler: uma coluna jsonb `narration`** (nullable = usa o template) com o mesmo
  formato da config de voz. Quando existe, **substitui** a voz do template inteira (não mescla:
  voz de Edge não serve pro Gemini). Uma migration.
- **Velocidade no Gemini: modo escolhido pela pessoa** (`paceMode`):
  - `"style"` (padrão): o ritmo vem do estilo. Select de preset (`stylePreset`:
    Rápido / Moderado / Lento). Checkbox **Personalizar** (`stylePreset: "custom"`) troca o
    select por um textarea livre (`style`).
  - `"slider"`: sem estilo; o áudio gerado é acelerado/desacelerado com `atempo` pelo
    `speed` (mesmo slider do Edge). Aviso na UI: ajuste grande muda o timbre.
- **Modelo padrão:** `gemini-3.8-flash-lite-tts` (cota grátis separada).
- **Tempos das palavras:** o provider Gemini chama o whisperx (mesma chamada que o
  provider "custom" já faz) — extraio essa chamada pra uma função e reuso.
- **Texto longo:** quebra em blocos (reusa `splitTextIntoChunks` do edge) e concatena.
  Cada bloco = 1 pedido na cota.
- **Chave:** `integrations.provider = "gemini"` do usuário, fallback `GOOGLE_AI_STUDIO_KEY`
  (mesma regra do backend).
- **Listas fixas no front** (vozes e modelos do Gemini, vozes pt-BR do Edge) num arquivo
  de constantes. Sem endpoint novo.

## Fora do escopo

- Wizard de criação (`Step2_Narration`) e Talkify: não mudam.
- Crédito: continua o mesmo valor fixo de TTS para qualquer provider.
- Retry automático em 429/503 (falha com mensagem clara; o scheduler já tem o próximo disparo).
- Atualizar o `@google/genai`.

## Tech stack / comandos

- Bun monorepo: `backend/` (Elysia + Drizzle + zod), `renderer/` (BullMQ workers + ffmpeg),
  `web/` (React + Vite).
- Testes backend: `cd backend && bun test`
- Selfchecks renderer: `cd renderer && bun run test:<nome>`
- Typecheck: `bunx tsc --noEmit -p <pacote>`
- Migration: `cd backend && bun run db:generate && bun run db:migrate`

## Onde mexe

| Camada | Arquivos |
|---|---|
| Tipos/schema | `renderer/src/graph.ts`, `web/src/lib/types.ts`, `backend/src/lib/schemas.ts` (nó + startAudio + scheduler) |
| Renderer | `renderer/src/tts/providers/gemini.provider.ts` (novo), `renderer/src/audioWorker.ts`, whisperx extraído de `custom.provider.ts` |
| Backend | `jobs.service.ts` (union), `scheduler.worker.ts` (provider + merge do override), `routes/schedulers.ts` (create), schema `schedulers.ts` + migration 0012 |
| Web | `lib/voices.ts` (novo: listas), `PropertiesPanel.tsx` (nó), `SchedulerFormPage.tsx` + `useSchedulers.ts` (seção Voz), `RenderPage.tsx` / `RenderModal.tsx` / `useJobs.ts` (passar gemini adiante) |

## Testes

- `renderer/test/gemini-tts.selfcheck.ts`: monta o corpo do pedido (modelo/voz/estilo),
  extrai o áudio da resposta (fixture), e o corte de pausas (ffmpeg em áudio sintético).
  Sem chamar a API.
- `backend`: `startAudio` aceita `gemini`; merge do override do scheduler sobre o nó
  (template sem override, override edge, override gemini).
- Manual: 1 job de verdade com Gemini (gasta 1–2 pedidos da cota).

## Fronteiras

- **Sempre:** rodar testes/typecheck antes de commit; manter Edge/Talkify intactos.
- **Perguntar antes:** atualizar dependência; mudar regra de crédito.
- **Nunca:** logar/commitar a chave; gastar a cota do usuário em teste automático.

## Riscos

- **Cota grátis: 10 pedidos/dia no `gemini-3.8-flash-tts`** (o Lite tem cota separada).
  Um scheduler de 5 partes com texto longo pode passar disso. Mitigação: mensagem clara +
  o Lite como opção no select.
- Gemini gera ~em tempo real (3 min de voz ≈ 3 min de espera) — uma parte de 5 min leva
  ~5 min só de voz.

## Plano / tarefas (ordem de dependência)

Formato da config (nó Narração e override do scheduler — mesmo shape):

```ts
{ provider: "edge" | "gemini" | "talkify" | ..., voice?: string, speed?: number,
  model?: string, paceMode?: "style" | "slider",
  stylePreset?: "rapido" | "moderado" | "lento" | "custom", style?: string }
```

- [x] **T1 Renderer — provider Gemini.** `gemini.provider.ts`: chunk → `fetch /interactions`
  → concat → corta pausas → `atempo` se `paceMode: "slider"` → whisperx p/ tempos.
  Presets de estilo como constantes aqui (fonte única; o front só mostra os rótulos).
  Branch `gemini` no `audioWorker.ts` + chave do usuário.
  - Verify: `bun run test:gemini-tts` (sem rede) + typecheck renderer.
- [x] **T2 Backend — tipos e job.** zod do nó + `startAudioSchema` + unions de
  `jobs.service.ts`/`scheduler.worker.ts` aceitam `gemini` e os campos novos.
  - Verify: `bun test` (mesmas 13 falhas antigas, nenhuma nova) + teste novo de `startAudio`.
- [x] **T3 Backend — override do scheduler.** Coluna jsonb `narration` + migration 0012,
  zod, create/update na rota, `resolveSchedulerVoice(template, override)` no worker.
  - Verify: teste do merge; migration aplica.
- [x] **T4 Web — nó Narração.** `lib/voices.ts` (listas), tipos, campos no `PropertiesPanel`
  (componente `NarrationVoiceFields` reusado no T5).
  - Verify: typecheck web + abrir o editor.
- [x] **T5 Web — scheduler + render manual.** Seção Voz no `SchedulerFormPage` (reusa o
  componente do T4); `RenderPage`/`RenderModal`/`useJobs` repassam gemini.
  - Verify: typecheck web + 1 execução real com Gemini.

## Achados na implementação

- **Slots por frase.** O alinhamento do whisperx no render só alinha a 1ª frase de cada
  slot; slot com várias frases ficava sem legenda depois da 1ª frase. O Edge nunca
  esbarrou nisso (já entrega 1 cue por frase). O caminho Gemini usa `sentenceSlots`
  (`renderer/src/sceneSlots.ts`): 1 slot por frase, com o texto do roteiro quando o nº de
  frases bate (a transcrição escreve "3h17" no lugar de "três e dezessete").
  O Talkify usa `calculateSceneSlots` (por pausa) e provavelmente tem o mesmo problema —
  fora do escopo, não mexido.
- **Teto de pausa ~0,35s:** no ffmpeg 7 o `silenceremove` mantém `stop_duration +
  stop_silence` de cada pausa longa (0,2 + 0,15).
- **Validação real:** job de teste `1b75131c…` (Gemini Flash-Lite, Algenib, preset rápido):
  áudio → whisperx → render com legenda sincronizada e card.
