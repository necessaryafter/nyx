# Spec: `scheduler` — Entidade, agendamento e worker de lote

> Módulo do mapa `capability-map.md`. Depende de `series-script` (e, por ele, de `ai-keys`).
> Status: rascunho para revisão.

## Objetivo

Persistir a configuração do scheduler, dispará-lo por cron ou manualmente, e transformar cada execução em uma série de jobs renderizados — reaproveitando **todo** o pipeline de job que já existe (draft → áudio → render → download), sem duplicar regra de crédito ou de fila.

**Sucesso:** o usuário cria um scheduler "toda segunda 09:00, 4 partes × 1 min" e, sem tocar em nada, toda segunda aparece uma execução nova com 4 vídeos baixáveis, cada um cobrado como um job normal.

## Modelo de dados

### `schedulers` (nova)
```ts
id            uuid pk
user_id       text not null (index)
name          text not null
template_id   uuid not null → templates.id  (on delete restrict)
theme         text not null
asset_ids     jsonb string[] not null default []      // fundo; [] = usa os do template
music_asset_ids jsonb string[] not null default []    // trilha; [] = usa os do template
mode          enum scheduler_mode: "single" | "parts"
total_minutes numeric(4,1) null                       // mode=single
parts_count   int null                                // mode=parts, 2..10
minutes_per_part numeric(4,1) null                    // mode=parts, 0.5..10
cta_template  text not null default 'Curta e comente para a parte {next}.'
final_cta_template text null
ai_provider   text not null default 'gemini'
ai_model      text not null
cron_pattern  text null                               // null = só manual
timezone      text not null default 'America/Sao_Paulo'
enabled       boolean not null default true
last_run_at   timestamptz null
created_at / updated_at timestamptz
```
Invariante (Zod + check no service): `mode=single` ⇒ `total_minutes` set; `mode=parts` ⇒ `parts_count` e `minutes_per_part` set.

### `scheduler_runs` (nova)
```ts
id            uuid pk
scheduler_id  uuid not null → schedulers.id (on delete cascade) (index)
user_id       text not null
status        enum scheduler_run_status: "pending" | "scripting" | "rendering" | "done" | "partial" | "failed"
triggered_by  enum: "manual" | "schedule"
title         text null                               // título da história (após scripting)
script        jsonb null                              // SeriesScript completo (auditoria e re-render)
parts_total   int not null
parts_done    int not null default 0
error         text null
started_at / completed_at / created_at timestamptz
```

### `jobs` (alteração)
```ts
run_id      uuid null → scheduler_runs.id (on delete set null) (index)
part_index  int null   // 1-based
```
Cada parte **é um job**. Nada muda para jobs criados pela UI atual (colunas nulas). Apagar um scheduler apaga as execuções mas **mantém os jobs e vídeos** (viram jobs "soltos" na tela de Jobs).

Migration única via `bun run db:generate` (0006).

## Máquina de estados da execução

```
pending ──► scripting ──► rendering ──► done      (todas as partes done)
                │             │
                │             └──────► partial   (≥1 parte done e ≥1 failed)
                │             └──────► failed    (todas failed)
                └────────────────────► failed    (IA falhou / créditos insuficientes / template inválido)
```
`parts_done` incrementa a cada parte concluída. Eventos WS a cada transição e a cada parte.

## Worker (BullMQ, no processo do backend)

```
backend/src/lib/queue.ts            → + export const schedulerQueue = new Queue("scheduler", { connection })
backend/src/workers/scheduler.worker.ts → new Worker("scheduler", handler, { connection, concurrency: 1 })
backend/src/index.ts                → startSchedulerWorker() (desligável com SCHEDULER_WORKER=false)
```
Job da fila: `name: "run"`, `data: { schedulerId: string; triggeredBy: "manual" | "schedule" }`, `attempts: 1` (a execução tem seu próprio tratamento de falha por parte; re-tentar a execução inteira duplicaria cobrança).

### Agendamento
BullMQ **Job Schedulers** (nativo na 5.76): 
- ligar/atualizar: `schedulerQueue.upsertJobScheduler(scheduler.id, { pattern: cron_pattern, tz: timezone }, { name: "run", data: { schedulerId, triggeredBy: "schedule" } })`
- desligar: `schedulerQueue.removeJobScheduler(scheduler.id)`
- próximo disparo: `schedulerQueue.getJobScheduler(scheduler.id)?.next` (exposto na API como `nextRunAt`)
Chamado em create/update/pause/resume/delete. Uma única fonte de verdade para "está agendado": a linha no banco (`enabled && cron_pattern`); o BullMQ é sincronizado a partir dela. `// ponytail:` na subida do backend, reconciliar todos os schedulers habilitados com `upsertJobScheduler` (idempotente) — cobre Redis limpo.

### Handler `run` (sequencial por execução)
1. Carrega scheduler (+ template, + usuário). Se `!enabled` e `triggeredBy=schedule` → sai sem criar execução.
2. Se já existe execução `scripting|rendering` deste scheduler → cria execução `failed` com erro "execução anterior ainda em andamento" (não empilha cobrança). 
3. Cria `scheduler_runs` (`pending` → `scripting`).
4. Pré-checagem de créditos: `getBalance(userId) >= partsTotal × (TTS_CREDITS_PER_MIN + RENDER_CREDITS_PER_MIN)` → senão `failed` "créditos insuficientes (precisa X, tem Y)". Não cobra nada aqui; a cobrança real continua por parte, nos services existentes.
5. `apiKey = resolveGeminiKey(userId)`; `avoidTitles` = títulos das últimas 20 execuções `done|partial` deste scheduler. `script = await generateSeriesScript(...)`. Salva `title`, `script`; status → `rendering`.
6. Para cada parte `i` (1..N), em sequência:
   a. `graph = applySchedulerOverrides(template.graph, { assetIds, musicAssetIds, title, partIndex: i, partsTotal: N })`
   b. `job = createDraftJob(userId, template, graph, { runId, partIndex: i })`
   c. `startAudio(userId, job, { type: "tts", text: part.text, provider, voice, speed })` — provider/voice/speed do `NarrationSource` do template (mesma regra do wizard corrigida ontem)
   d. aguarda o job de áudio terminar: `await audioJob.waitUntilFinished(audioQueueEvents, 10 * 60_000)`; se falhar/timeout → parte `failed`, continua.
   e. `startRender(userId, job)`; aguarda `renderJob.waitUntilFinished(renderQueueEvents, 30 * 60_000)`.
   f. `parts_done++`; WS `run:status`.
7. Status final conforme a máquina de estados; `completed_at`; `schedulers.last_run_at`.

`// ponytail: concorrência 1 e sequencial por parte — teto: um renderer ocupado por vez. Paralelizar partes = pool no renderer, não aqui.`

### Extração de services (pré-requisito, sem mudar comportamento)
Mover o corpo dos handlers de `routes/jobs.ts` para `backend/src/lib/jobs.service.ts`:
```ts
export async function createDraftJob(userId, template, graph?, meta?: { runId; partIndex }): Promise<Job>;
export async function startAudio(userId, job, narration): Promise<{ bullJobId: string }>;   // debita TTS, enfileira "audio"
export async function startRender(userId, job): Promise<{ bullJobId: string; creditsCharged }>; // valida grafo, debita, enfileira "render"
```
As rotas passam a chamá-los (mesmos códigos HTTP e mensagens; testes existentes em `jobs.test.ts` continuam verdes). As funções lançam `HttpError(status, body)` que a rota traduz.

### `applySchedulerOverrides(graph, ctx)`
- Todo `AssetSource` com `assetType ∈ {video, image}` recebe `assetIds = ctx.assetIds` se `ctx.assetIds.length > 0`.
- Todo `MusicSource` recebe `ctx.musicAssetIds` se não vazio.
- Todo `ShowTitleCard` recebe `title = ctx.partsTotal > 1 && ctx.partIndex > 1 ? \`${ctx.title} — Parte ${ctx.partIndex}\` : ctx.title` e `minDurationMs = 2500`.
- Não toca em mais nada. Função pura, testável.

## Mudança pequena no renderer (única)

`ShowTitleCardConfig` ganha dois campos opcionais, espelhados no Zod do backend e nos tipos/painel do web:
- `title?: string` — quando presente, o card usa este texto em vez da primeira frase da narração (a legenda continua pulando a primeira frase, como hoje).
- `minDurationMs?: number` (default 2500) — o card fica no mínimo esse tempo. Necessário porque "Parte 2." dura < 1 s falado.
Arquivos: `renderer/src/graph.ts`, `renderer/src/compile/titleCard.ts`, `backend/src/lib/schemas.ts`, `web/src/lib/types.ts`, `web/src/components/editor/PropertiesPanel.tsx` (dois inputs).

## API REST (`/api/schedulers`, `requireAuth`, rate limit padrão)

| Método | Rota | Body / Resposta |
|---|---|---|
| POST | `/` | `CreateScheduler` → 201 `Scheduler`. Se `runOnCreate` → enfileira `run` manual. Se `enabled && cronPattern` → upsert no BullMQ. |
| GET | `/?limit&offset` | `{ data: SchedulerListItem[], total }` — inclui `lastRun: { id, status, partsDone, partsTotal, createdAt } \| null` e `nextRunAt: string \| null`. |
| GET | `/:id` | `Scheduler & { runs: RunWithParts[] }` (últimas 20 execuções; cada parte = `{ jobId, partIndex, status, durationSeconds, hasVideo }`). |
| PUT | `/:id` | `UpdateScheduler` (parcial) → `Scheduler`. Re-sincroniza BullMQ. Não altera execuções já feitas. |
| POST | `/:id/run` | 202 `{ runQueued: true }`; 409 se há execução em andamento. |
| POST | `/:id/pause` · `/:id/resume` | `enabled` ↔ remove/upsert no BullMQ → `Scheduler`. |
| DELETE | `/:id` | remove do BullMQ, apaga scheduler + execuções (jobs ficam) → 204. |
| GET | `/:id/runs/:runId` | `Run & { parts: Part[]; script: SeriesScript }`. |
| GET | `/estimate?mode&partsCount&minutesPerPart&totalMinutes` | `{ partsTotal, creditsPerPart, creditsTotal, wordsPerPart }` — para a UI mostrar antes de criar. |

Download de parte: **reusar** `GET /api/jobs/:id/download`.

### Validação (Zod, `backend/src/lib/schemas.ts`)
- `name` 1..80; `theme` 10..2000; `templateId` uuid do usuário; grafo v2; **sem `SceneSource`**; com `NarrationSource`.
- `assetIds`/`musicAssetIds`: uuids do usuário; tipos `video|image` / `audio`.
- `mode=parts`: `partsCount` int 2..10, `minutesPerPart` 0.5..10 (passo 0.5). `mode=single`: `totalMinutes` 0.5..10.
- `ctaTemplate` 1..200; `finalCtaTemplate` 0..200.
- `aiModel` 1..80 (a UI oferece a lista; a API não valida contra o Google para não acoplar).
- `cronPattern`: null ou 5 campos; validado tentando `upsertJobScheduler` em try/catch (BullMQ usa cron-parser) — erro vira 400 "expressão cron inválida".
- `timezone`: string IANA (validar com `Intl.DateTimeFormat(undefined, { timeZone })` em try/catch).
- Máx **10 schedulers habilitados** por usuário (409 ao criar/resumir o 11º).

## Eventos WebSocket (`routes/ws.ts`, mesmo canal por usuário)

```ts
{ type: "run:status", runId, schedulerId, status, partsDone, partsTotal, title? }
```
Emitido no worker via o mesmo mecanismo que `job:status` usa hoje (Redis pub/sub existente). Jobs das partes continuam emitindo `job:status` normalmente.

## Estrutura

```
backend/src/database/schema/schedulers.ts       → schedulers, schedulerRuns, enums, relations
backend/src/database/schema/jobs.ts             → + runId, partIndex
backend/src/lib/schemas.ts                      → createSchedulerSchema, updateSchedulerSchema, showTitleCardConfigSchema (+2 campos)
backend/src/lib/jobs.service.ts                 → createDraftJob, startAudio, startRender (extraídos)
backend/src/lib/scheduler/overrides.ts          → applySchedulerOverrides (pura)
backend/src/lib/scheduler/estimate.ts           → estimateRun (pura)
backend/src/lib/scheduler/sync.ts               → syncBullScheduler(scheduler) / reconcileAll()
backend/src/workers/scheduler.worker.ts         → handler run
backend/src/routes/schedulers.ts                → REST
backend/src/routes/ws.ts                        → + run:status
backend/src/__tests__/schedulers.test.ts, scheduler-overrides.test.ts, jobs.service.test.ts
```

## Testes (`bun test`, mocks existentes)

- `applySchedulerOverrides`: substitui só AssetSource video/image; mantém quando `assetIds=[]`; música; título do card parte 1 vs parte 3; não muda outros nodes (deep-equal do resto).
- `estimateRun`: `parts` 4 × 1 min → `partsTotal 4`, `creditsTotal 4×15`; `single` 3 min → 1 parte.
- Zod: rejeita `mode=parts` sem `partsCount`; rejeita 11 partes; rejeita template com `SceneSource` (via service, mock db).
- `jobs.service`: comportamento igual aos handlers atuais — reaproveitar os casos de `jobs.test.ts` apontando para os services (402 sem crédito, 409 status errado, 400 grafo inválido).
- Worker (handler isolado, fila e Gemini mockados): créditos insuficientes → `failed` sem chamar IA; IA falha → `failed`; 2 partes ok → `done` com `parts_done=2`; 1 ok + 1 timeout de áudio → `partial`; execução em andamento → nova marcada `failed` sem cobrança.
- Renderer: `assert` em `compile/titleCard.ts` — com `title` no config, `plan.title === config.title`; `endSeconds − startSeconds ≥ minDurationMs/1000`.

## Limites específicos

- **Sempre:** cobrar créditos apenas pelos services existentes; toda escrita em `scheduler_runs` dentro do worker, nunca pela rota (a rota só enfileira).
- **Perguntar antes:** mudar limites (10 partes/10 schedulers/10 min); permitir templates com `SceneSource`; retry automático de parte falhada.
- **Nunca:** re-tentar a execução inteira automaticamente (duplica cobrança); apagar jobs ao apagar scheduler; rodar o worker no processo web.

## Critérios de sucesso

1. `POST /api/schedulers` com `runOnCreate` e 2 partes × 1 min no template "Teste - Storytime Realista" → em até ~5 min a execução está `done`, `parts_done=2`, dois jobs `done` com `run_id`/`part_index` preenchidos, `GET /api/jobs/:id/download` funciona para os dois.
2. Parte 1: narração começa pelo título e termina com "Curta e comente para a parte 2."; parte 2 começa com "Parte 2." e não tem CTA; card de título aparece nas duas com duração ≥ 2,5 s.
3. Com cron `*/5 * * * *` habilitado, uma nova execução nasce a cada 5 min sem ação do usuário; `pause` interrompe; `resume` retoma; `nextRunAt` bate com o cron.
4. Sem créditos: execução `failed` com mensagem clara, saldo intocado, IA não chamada.
5. Apagar o scheduler não remove os vídeos já gerados da tela de Jobs.
6. Reiniciar o backend com Redis limpo re-registra os schedulers habilitados.
7. `bun test` verde, incluindo os testes antigos de jobs (rotas refatoradas para services sem mudança de contrato).

## Questões abertas

1. **Ordem das partes vs. tempo total:** sequencial simples (parte 1, depois 2…). Uma série de 4 × 1 min leva ~4–6 min. Aceitável?
2. **Retry de parte falhada:** v1 usa o `POST /api/jobs/:id/retry` que já existe, por parte. Um "re-rodar partes falhadas" no nível da execução fica para depois. Ok?
3. **Cobrança por uso de IA:** hoje o Gemini não consome créditos do Nyx (é a chave do usuário). Manter assim?
4. **Nome de exibição:** o usuário chamou de "Scheduler". Manter em inglês na UI (como "Jobs", "Templates") ou "Agendamentos"? Proposta: **"Schedulers"**, consistente com o resto do menu.
