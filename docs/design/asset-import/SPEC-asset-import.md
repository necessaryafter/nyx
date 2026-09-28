# Spec: `asset-import` — Banco, fila e API do corte automático

> Módulo do mapa `capability-map.md`. Depende de `scene-detection`.
> Status: rascunho para revisão.

## Objetivo

Orquestrar o fluxo completo: recebe o vídeo bruto, enfileira a detecção, recorta e converte cada segmento candidato, guarda tudo esperando revisão, e só vira asset de verdade depois que o usuário confirma quais trechos quer.

**Sucesso:** usuário sobe um vídeo de 20 min com 6 cortes reais; em alguns minutos vê 6 candidatos com miniatura e duração; desmarca 1 que ficou ruim; confirma; os outros 5 aparecem na tela de Assets, agrupados, já em 1080×1920.

## Modelo de dados

### `asset_import_batches` (nova)
```ts
id                 uuid pk
user_id            text not null
source_name        text not null              // nome do arquivo original enviado
source_storage_key text not null              // vídeo bruto no MinIO — apagado ao final (confirmado ou descartado)
source_duration_ms integer
status             enum asset_import_status: "detecting" | "awaiting_fallback_choice" | "awaiting_review" | "done" | "discarded" | "failed"
segments           jsonb not null default '[]'  // ImportSegment[] — ver abaixo
error              text
created_at / updated_at / completed_at timestamptz
```

```ts
interface ImportSegment {
  index: number;
  startMs: number;
  endMs: number;
  clipStorageKey: string;      // MinIO — já cortado + convertido pra 1080x1920; some se não for confirmado
  thumbnailKey: string;        // MinIO — 1 frame do meio do trecho, JPEG pequeno
  selected: boolean;           // default true; usuário desmarca na prévia
  name?: string;               // opcional, senão vira "{sourceName} — parte {index}"
}
```

### `assets` (alteração)
```ts
import_batch_id  uuid null → asset_import_batches.id (on delete set null) (index)
```
Nulo = asset normal (comportamento de hoje, sem mudança). Preenchido = veio de um lote — é isso que a tela usa pra agrupar.

Migration única via `bun run db:generate`.

## Máquina de estados

```
detecting ──(achou corte)──────────────────► awaiting_review ──(confirm)──► done
    │                                              │
    │──(0 cortes, sem escolha ainda)──► awaiting_fallback_choice
    │                                       │ (fallback: fixed) ──► detecting (2ª passada, split fixo) ──► awaiting_review
    │                                       │ (fallback: single) ──────────────────────────────────────► awaiting_review (1 segmento)
    │
    └──(erro em qualquer ponto)──────────────────────────────────────────────────────────────────────► failed

awaiting_review ──(discard)──► discarded
```
`discarded` e `failed` liberam os objetos temporários no MinIO (source + clips + thumbnails não confirmados).

## Fila e worker (BullMQ, vive em `renderer/` — é onde o ffmpeg já roda)

```
backend/src/lib/queue.ts                    → + export const assetImportQueue = new Queue("asset-import", { connection })
renderer/src/workers/assetImport.worker.ts  → consome a fila
```
Job: `{ batchId: string }`, `attempts: 1` (mesma lógica do scheduler — falhou, falhou; não custa nada re-tentar sozinho porque não há cobrança de crédito aqui, mas evita rodar ffmpeg em loop num vídeo problemático).

### Handler
1. Carrega o batch; baixa `source_storage_key` do MinIO pra um tmpdir local.
2. `duration = probeDuration(localPath)` (`renderer/src/ffmpeg/probe.ts`, já existe).
3. `segments = await detectSegments(localPath, duration, { threshold: 0.4, minSegmentMs: 1500 })` (`scene-detection`).
4. Se `segments.length === 1` (nenhum corte real) → status `awaiting_fallback_choice`, WS avisa, **para aqui** (não gera clipe nenhum ainda — evita processar à toa antes de saber o que o usuário quer).
5. Se o número de segmentos passar de `ASSET_IMPORT_MAX_SEGMENTS` (env, default **30**) → status `failed`, erro "muitos cortes detectados (X), ajuste o vídeo ou aumente o limite" — não processa nenhum recorte.
6. Senão (ou depois que o fallback escolhido reprocessou): pra cada segmento, em paralelo (até um teto de concorrência, ex. 3 por vez):
   - corta + converte pra 1080×1920 (mesmo `cover`/crop-central que o render já usa — `buildScaleFilter` em `renderer/src/ffmpeg/builder.ts`, reaproveitar a mesma função): `ffmpeg -i <fonte> -ss <start> -to <end> -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -an -c:v libx264 -crf 20 <saida>` (`-an`: descarta áudio original, decisão já tomada).
   - extrai 1 frame do meio pra miniatura (`ffmpeg -ss <meio> -i <saida> -frames:v 1 <thumb>.jpg`).
   - sobe os dois pro MinIO, key temporária: `${userId}/imports/${batchId}/segment-${index}.mp4` e `...-thumb.jpg`.
7. Salva `segments` no batch, status → `awaiting_review`. WS avisa.

### Fallback escolhido pelo usuário
`POST /api/asset-imports/:id/fallback` com `{ mode: "fixed" | "single" }`:
- `single`: 1 segmento (`{0, duration}`), pula direto pro passo 5 do handler acima (reenfileira o mesmo job, ou chama a função de recorte direto — tanto faz, mas reenfileirar mantém o padrão "worker faz o trabalho pesado").
- `fixed`: `segments = splitFixedInterval(duration, 45_000)` (`scene-detection`), mesma coisa.

## API REST (`/api/asset-imports`, `requireAuth`)

Upload em 3 passos, mesmo padrão de `/api/assets/upload/multipart/*` — o "complete" também streama direto pro MinIO como source do lote (sem montar o arquivo localmente no backend): o worker do renderer já baixa o source do MinIO pra um tmpdir local antes de rodar ffmpeg (reaproveita `downloadAsset` de `renderer/src/prepare/assets.ts`), então não faz sentido montar o arquivo duas vezes. Extraí a lógica de reassemblar chunks em `backend/src/lib/chunkedUpload.ts`, reaproveitada pelos dois fluxos (assets normais continuam com o mesmo comportamento).

| Método | Rota | O quê |
|---|---|---|
| POST | `/upload/start` | `{ name }` → `{ batchId }` (cria a linha do lote em memória/tmp, ainda sem enfileirar) |
| PUT | `/upload/:batchId/chunk?index&total` | Igual ao de assets — grava o chunk local |
| POST | `/upload/:batchId/complete` | `{ totalChunks, totalSize }` → monta o arquivo local, sobe pro MinIO como source, cria a linha em `asset_import_batches` (status `detecting`), enfileira o job, apaga os chunks locais. 201 `{ batchId, status: "detecting" }` |
| GET | `/:id` | Status do lote + segmentos (com URL pré-assinada da miniatura de cada um) — usado pela tela de revisão, via polling ou WS |
| POST | `/:id/fallback` | `{ mode: "fixed" \| "single" }` — só válido quando `status = awaiting_fallback_choice` |
| POST | `/:id/confirm` | `{ selectedIndexes: number[], names?: Record<number,string> }` — ver abaixo |
| DELETE | `/:id` | Descarta o lote inteiro (limpa MinIO, apaga a linha) — só antes de confirmar |
| GET | `/` | Lista lotes do usuário em `detecting \| awaiting_fallback_choice \| awaiting_review` — pra retomar revisão se saiu da tela no meio |

### `POST /:id/confirm`
Só válido com `status = awaiting_review`. Pra cada índice em `selectedIndexes`: `INSERT INTO assets (id, userId, name, type: "video", storageKey: segment.clipStorageKey, sizeBytes, importBatchId: batchId)` — **sem mover o arquivo no MinIO**, o storageKey do asset passa a ser o mesmo key temporário que já existe (deixa de ser temporário só porque agora tem uma linha em `assets` apontando pra ele). Pra cada índice **não** selecionado: `minio.removeObject` do clip e da miniatura. Some com o `source_storage_key`. Status → `done`.

## Estrutura

```
backend/src/database/schema/assetImports.ts     → assetImportBatches, enum, relations
backend/src/database/schema/assets.ts           → + importBatchId
backend/src/lib/chunkedUpload.ts                → extraído de routes/assets.ts, reaproveitado nos dois fluxos
backend/src/lib/schemas.ts                      → confirmImportSchema, fallbackImportSchema
backend/src/routes/assetImports.ts              → REST acima
backend/src/lib/queue.ts                        → + assetImportQueue
backend/src/__tests__/asset-imports.test.ts
renderer/src/workers/assetImport.worker.ts
renderer/src/scene-detection/                   → (spec própria)
```

## Estilo

Mesmo padrão de `routes/schedulers.ts`: Zod pra validação, `set.status` + `{ error }` pros erros, tudo escopado por `userId` da sessão.

## Testes

- `chunkedUpload.ts`: extração deve manter os testes de upload de assets existentes passando sem mudança (mesmo contrato).
- Rotas (`bun:test`, mocks de `helpers/setup.ts`, estilo `schedulers.test.ts`): confirm materializa só os selecionados, remove os outros do MinIO; discard limpa tudo; fallback só aceito no status certo; confirm/fallback fora do status certo → 409.
- Worker: com `detectSegments` mockado (retorna 1 segmento) → status vira `awaiting_fallback_choice`, nenhum ffmpeg de corte roda ainda; com 3 segmentos → 3 entradas em `segments`, status `awaiting_review`.

## Limites

- **Sempre:** apagar os objetos temporários do MinIO ao descartar/rejeitar — não deixar lixo órfão.
- **Perguntar antes:** mudar os limites de upload (2h/2GB, valores da suposição do mapa); mudar `-crf`/qualidade do recorte.
- **Nunca:** confirmar um lote que não está em `awaiting_review`; apagar um asset já confirmado (`importBatchId` preenchido) por causa de uma ação no lote — uma vez confirmado, o asset é independente do lote.

### Variáveis de ambiente
```
ASSET_IMPORT_MAX_SEGMENTS=30   # teto de cortes por vídeo antes de desistir
```
Vive só em `renderer/.env` (não existe `renderer/.env.example` no repo hoje) — quem decide é o worker, que é quem conta os segmentos de verdade; validar no backend antes de enfileirar não faz sentido aqui.

### Limpeza de lotes abandonados
Sem cron novo: `// ponytail: lazy cleanup — sem scheduler dedicado, só varre quando alguém mexe na lista.` A cada `POST /upload/start` (antes de criar um lote novo), apaga (linha + objetos no MinIO) os lotes do mesmo usuário com mais de 7 dias em qualquer status que não seja `done`. Se isso não for suficiente na prática (usuário nunca volta a criar um lote novo), upgrade natural é um cron de verdade — mesmo mecanismo que o `job-scheduler` já usa (BullMQ Job Scheduler).

## Critérios de sucesso

1. Upload de um vídeo com cortes reais → em minutos, `GET /:id` mostra `awaiting_review` com N segmentos e miniaturas visualizáveis (URL pré-assinada abre).
2. Confirmar um subconjunto → só esses viram `assets` (visíveis em `GET /api/assets` com `importBatchId` preenchido); os descartados não sobram no MinIO.
3. Vídeo sem corte → `awaiting_fallback_choice`; escolher `fixed` gera pedaços de 45s; escolher `single` gera 1 segmento do vídeo inteiro.
4. Descartar um lote em qualquer etapa não deixa asset nenhum criado nem objeto órfão no MinIO.

## Decisões (eram perguntas abertas, resolvidas com o usuário)

1. ~~Limite de segmentos~~ → resolvido: `ASSET_IMPORT_MAX_SEGMENTS` no `.env`, default 30 (ver seção de env vars acima).
2. ~~Expiração de lote abandonado~~ → resolvido: 7 dias, limpeza preguiçosa (sem cron dedicado) — ver "Limpeza de lotes abandonados" acima.
