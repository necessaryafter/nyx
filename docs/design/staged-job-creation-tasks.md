# Tarefas — Criação de Job em Etapas

Referência: `staged-job-creation.md`

---

## Bloco 1 — Banco de Dados

### T-01: Migração do enum `job_status`
Adicionar os novos valores ao enum do PostgreSQL e atualizar o schema Drizzle.

**Arquivos:**
- `backend/src/database/schema/jobs.ts` — estender `jobStatusEnum`
- `backend/src/database/migrations/` — nova migration SQL

**Novos valores:** `draft`, `audio_processing`, `audio_ready`, `ready`, `rendering`

**Obs:** `pending` e `processing` permanecem sem alteração (compatibilidade com jobs existentes).

---

### T-02: Migração dos campos `audioKey` e `sceneSlots`
Adicionar as duas colunas novas na tabela `jobs`.

**Arquivos:**
- `backend/src/database/schema/jobs.ts` — adicionar campos
- `backend/src/database/migrations/` — nova migration SQL

**Schema:**
```typescript
audioKey: text("audio_key"),
sceneSlots: jsonb("scene_slots").$type<SceneSlot[]>(),
```

---

### T-03: Migração do enum `credit_transaction_reason`
Adicionar o valor `"refund"` ao enum existente.

**Arquivos:**
- `backend/src/database/schema/creditTransactions.ts`
- `backend/src/database/migrations/` — nova migration SQL

---

## Bloco 2 — Shared Types

### T-04: Definir tipo `SceneSlot`
Criar o tipo compartilhado e exportar de onde os outros módulos importam.

**Arquivos:**
- `backend/src/lib/schemas.ts` — adicionar `SceneSlot` interface + Zod schema

```typescript
interface SceneSlot {
  index: number;
  startMs: number;
  endMs: number;
  assetId: string | null;
}
```

---

## Bloco 3 — Renderer

### T-05: Implementar node `SceneMedia`
Novo executor que lê `job.sceneSlots` do contexto e monta slideshow via FFmpeg.

**Arquivos:**
- `renderer/src/nodes/sceneMedia.ts` — novo arquivo
- `renderer/src/nodes/factory.ts` — registrar `SceneMedia`
- `renderer/src/graph.ts` — adicionar ao discriminated union

**Comportamento:**
1. Recebe `sceneSlots` do contexto de execução (não do config do node)
2. Para cada slot: baixa asset do MinIO, converte imagem → clip com duração `endMs - startMs`
3. Vídeos: trimma para a duração do slot
4. Concatena tudo com FFmpeg `concat` filter
5. Aplica `transitionMs` de crossfade entre clips se configurado

**Config do node:**
```typescript
interface SceneMediaConfig {
  fit?: "cover" | "contain";
  transitionMs?: number;
}
```

---

### T-06: Passar `sceneSlots` no contexto de execução do renderer
O worker precisa buscar e injetar `sceneSlots` no contexto antes de executar o grafo.

**Arquivos:**
- `renderer/src/worker.ts` — ler `job.sceneSlots` e passar no `ExecutionContext`
- `renderer/src/executor.ts` (ou equivalente) — adicionar `sceneSlots` ao tipo do contexto

---

## Bloco 4 — Backend: Endpoints

### T-07: Modificar `POST /api/jobs` para criar job em `draft`
O endpoint atual cria o job completo e enfileira imediatamente. Passa a criar apenas o rascunho.

**Arquivos:**
- `backend/src/routes/jobs.ts`

**Novo request body:**
```typescript
{ templateId: string }
```

**Comportamento:**
- Valida que o template existe e pertence ao usuário
- Cria job com `status: "draft"`, sem graph resolvido ainda
- Não debita créditos, não enfileira
- Retorna `{ jobId, status: "draft" }`

**Obs:** o endpoint antigo (que enfileira direto) pode ser mantido em `/api/jobs/quick` para templates sem `SceneMedia`, ou removido após migração do frontend.

---

### T-08: Implementar `POST /api/jobs/:id/audio`
Dispara a geração de áudio (etapa 2).

**Arquivos:**
- `backend/src/routes/jobs.ts`

**Request:**
```typescript
{
  narration:
    | { type: "tts"; text: string; provider: string; voice?: string; speed?: number }
    | { type: "audio"; assetId: string }
}
```

**Comportamento:**
1. Valida que job existe, pertence ao usuário e está em `draft`
2. Atualiza `status → "audio_processing"`
3. Enfileira job de áudio (novo worker ou job especial no BullMQ)
4. Retorna `{ status: "audio_processing" }`

O worker de áudio, ao terminar:
1. Faz upload do áudio para MinIO → salva `audioKey`
2. Calcula `sceneSlots` a partir dos timestamps (ver T-09)
3. Atualiza `status → "audio_ready"` + salva `sceneSlots`
4. Publica evento `audio_ready` via WebSocket

---

### T-09: Implementar cálculo de `sceneSlots` a partir de timestamps
Lógica que transforma `WordTimestamp[]` em `SceneSlot[]`.

**Arquivos:**
- `backend/src/lib/sceneSlots.ts` — novo arquivo com a função `calculateSceneSlots`

**Estratégia default (pausas):**
- Agrupa palavras onde o gap entre `endMs` de uma e `startMs` da próxima é > 500ms
- Cada grupo vira um slot: `startMs = primeira.startMs`, `endMs = última.endMs`
- Mínimo: 1 slot; máximo: sem limite

**Estratégia por cenas (quando texto tem `\n\n`):**
- Divide o texto por parágrafo duplo antes de gerar TTS
- Cada parágrafo → um segmento de áudio → um slot
- Requer que o TTS seja chamado por segmento e os áudios concatenados com offset

---

### T-10: Implementar `PATCH /api/jobs/:id/slots`
Atualiza slots individualmente (etapa 3). Pode ser chamado múltiplas vezes.

**Arquivos:**
- `backend/src/routes/jobs.ts`

**Request:**
```typescript
{
  slots: Array<{
    index: number;
    assetId: string | null;
    startMs?: number;
    endMs?: number;
  }>
}
```

**Comportamento:**
1. Valida que job está em `audio_ready`
2. Faz merge dos slots recebidos com `job.sceneSlots` existente
3. Se todos os slots tiverem `assetId != null` → atualiza `status → "ready"`
4. Retorna `{ status, slots: SceneSlot[] }`

---

### T-11: Implementar `POST /api/jobs/:id/render`
Enfileira o job para renderização (etapa 4).

**Arquivos:**
- `backend/src/routes/jobs.ts`

**Comportamento:**
1. Valida que job está em `ready`
2. Resolve o grafo completo (template + narração injetada + sceneSlots no contexto)
3. Debita créditos de renderização
4. Enfileira no BullMQ
5. Atualiza `status → "rendering"`
6. Retorna `{ status: "rendering", creditsCharged: number }`

---

### T-12: Implementar `DELETE /api/jobs/:id`
Descarta job em andamento e reembolsa créditos de TTS se já debitados.

**Arquivos:**
- `backend/src/routes/jobs.ts`

**Comportamento:**
1. Só permite para jobs em `draft`, `audio_processing`, `audio_ready`, `ready`
2. Se `audioKey` existe: deleta arquivo do MinIO
3. Se créditos de TTS foram debitados: cria `creditTransaction` com `reason: "refund"`
4. Deleta o job do banco

---

## Bloco 5 — Backend: Worker de Áudio

### T-13: Criar worker BullMQ para processamento de áudio
Separar a lógica de TTS do worker de renderização atual.

**Arquivos:**
- `renderer/src/audioWorker.ts` — novo arquivo (ou em `backend/` se preferir manter TTS no backend)
- `renderer/src/index.ts` — registrar o novo worker

**Comportamento:**
1. Consome fila `audio-jobs`
2. Chama TTS provider (ou WhisperX para áudio custom)
3. Faz upload do áudio para MinIO
4. Chama `calculateSceneSlots` com os timestamps retornados
5. Atualiza job no banco (`audioKey`, `sceneSlots`, `status: "audio_ready"`)
6. Publica evento `audio_ready` via WebSocket (Redis pub/sub)

---

## Bloco 6 — WebSocket

### T-14: Adicionar evento `audio_ready` ao WebSocket
O backend já tem WebSocket para `status_updated`. Adicionar o novo evento com payload de slots.

**Arquivos:**
- `backend/src/routes/ws.ts` (ou equivalente)
- `renderer/src/audioWorker.ts` — publicar o evento após processar

**Payload:**
```typescript
{ type: "audio_ready"; jobId: string; sceneSlots: SceneSlot[] }
```

---

## Bloco 7 — Frontend

### T-15: Criar hook `useJob(id)` com polling/WebSocket
Hook que retorna o estado atual de um job e atualiza em tempo real.

**Arquivos:**
- `web/src/hooks/useJob.ts` — novo arquivo

**Comportamento:**
- Faz `GET /api/jobs/:id` inicial
- Subscreve ao WebSocket para atualizações em tempo real
- Retorna `{ job, isLoading, error }`

---

### T-16: Criar página `JobWizardPage` com roteamento
Página principal do wizard com navegação entre etapas.

**Arquivos:**
- `web/src/pages/JobWizardPage.tsx` — novo arquivo
- `web/src/App.tsx` (ou router) — adicionar rota `/jobs/new` e `/jobs/:id/edit`

**Estrutura:**
```
JobWizardPage
├── WizardStepper (barra de progresso)
└── <Step atual />
```

O step atual é derivado do `job.status`:
- `draft` → Step 1 (selecionar template) ou Step 2 (narração, se templateId já definido)
- `audio_processing` → Step 2 (aguardando áudio)
- `audio_ready` → Step 3 (mídias)
- `ready` → Step 4 (confirmar)
- `rendering` / `done` → redireciona para `/jobs/:id`

---

### T-17: Implementar Step 1 — Seleção de Template
Grid de templates com preview e busca.

**Arquivos:**
- `web/src/pages/wizard/Step1_TemplateSelect.tsx`

**Comportamento:**
- Lista templates do usuário via `useTemplates()`
- Ao selecionar: chama `POST /api/jobs` com `{ templateId }`, navega para `/jobs/:id/edit`

---

### T-18: Implementar Step 2 — Configuração de Narração
Formulário de TTS ou upload de áudio. Estado de loading enquanto áudio é processado.

**Arquivos:**
- `web/src/pages/wizard/Step2_Narration.tsx`

**Comportamento:**
- Tabs: "Texto (TTS)" / "Áudio pronto"
- TTS: textarea + select de provider/voz
- Áudio: asset picker filtrado por tipo `audio`
- Ao confirmar: chama `POST /api/jobs/:id/audio`, exibe loading com mensagem
- Quando recebe evento `audio_ready` via WebSocket: avança automaticamente para Step 3

---

### T-19: Implementar Step 3 — Definição de Mídias
Lista de slots com waveform simplificada e uploader por slot.

**Arquivos:**
- `web/src/pages/wizard/Step3_MediaSlots.tsx`
- `web/src/components/wizard/SlotCard.tsx`
- `web/src/components/wizard/AudioTimeline.tsx`

**Comportamento:**
- Exibe N `SlotCard`s, um por `sceneSlot`
- Cada card mostra: intervalo de tempo (ex: `0:04 – 0:12`), status (preenchido/vazio), asset picker
- Asset picker: upload direto ou selecionar da biblioteca (`AssetsPage` como modal/sheet)
- Ao selecionar asset: chama `PATCH /api/jobs/:id/slots` com o slot atualizado
- Quando todos preenchidos: botão "Avançar" fica habilitado

**AudioTimeline (opcional para MVP):**
- Barra visual com marcadores nos timestamps dos slots
- Não requer waveform real — pode ser uma representação proporcional simples

---

### T-20: Implementar Step 4 — Confirmação e Renderização
Resumo do job e botão de renderizar.

**Arquivos:**
- `web/src/pages/wizard/Step4_Confirm.tsx`

**Comportamento:**
- Exibe: template selecionado, duração do áudio, N slots, créditos estimados
- Botão "Renderizar": chama `POST /api/jobs/:id/render`
- Após confirmar: redireciona para `/jobs/:id` (página de acompanhamento existente)

---

### T-21: Atualizar `JobsPage` para exibir jobs em andamento
Jobs em `draft`, `audio_processing`, `audio_ready`, `ready` aparecem com badge "Em progresso" e link para retomar o wizard.

**Arquivos:**
- `web/src/pages/JobsPage.tsx`
- `web/src/components/jobs/JobCard.tsx` (ou equivalente)

---

## Ordem de Implementação Sugerida

```
T-01 → T-02 → T-03   (banco — fazer tudo junto em uma migration)
T-04                  (tipos compartilhados)
T-05 → T-06           (renderer — SceneMedia node)
T-09                  (lógica de segmentação de slots)
T-13 → T-14           (worker de áudio + WebSocket)
T-07 → T-08 → T-10 → T-11 → T-12  (endpoints, nesta ordem)
T-15 → T-16           (hook + rota do wizard)
T-17 → T-18 → T-19 → T-20 → T-21  (steps do wizard)
```

---

## Dependências entre tarefas

```
T-04 (SceneSlot type)
  ├── T-02 (campo sceneSlots no banco usa o tipo)
  ├── T-05 (SceneMedia lê sceneSlots)
  ├── T-09 (calculateSceneSlots retorna SceneSlot[])
  └── T-10 (PATCH /slots valida SceneSlot[])

T-01 (enum status)
  ├── T-07 (POST /jobs usa "draft")
  ├── T-08 (POST /audio usa "audio_processing" → "audio_ready")
  ├── T-10 (PATCH /slots usa "ready")
  └── T-11 (POST /render usa "rendering")

T-13 (worker de áudio)
  ├── T-08 (endpoint dispara a fila)
  └── T-14 (worker publica o evento WebSocket)
```
