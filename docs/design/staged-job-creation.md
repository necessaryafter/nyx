# PRD — Criação de Job em Etapas

## Contexto

O fluxo atual de criação de job é um disparo único: seleciona template → configura tudo → renderiza. Isso impossibilita casos de uso onde o áudio precisa existir antes de definir as mídias (ex: slides sincronizados com timestamps do áudio, imagens geradas por IA por cena).

Este documento especifica o novo fluxo em 4 etapas, onde o job é uma entidade stateful que pode ser salva e retomada entre etapas.

---

## Objetivo

Permitir que o usuário crie um job de forma progressiva, salvando estado entre etapas, de modo que:
- O áudio seja gerado antes de definir as mídias
- As mídias sejam associadas a intervalos reais do áudio (baseados em timestamps)
- O template permaneça estático e reutilizável
- O processo possa ser interrompido e retomado

---

## Etapas do Fluxo

### Etapa 1 — Seleção de Template

O usuário escolhe um template da sua biblioteca ou do marketplace.

**Saída:** `job` criado com `status: "draft"`, `templateId` salvo.

---

### Etapa 2 — Configuração de Narração

O usuário configura a narração:
- **TTS:** cola ou digita o texto, escolhe provider (Talkify, etc.) e voz
- **Áudio custom:** faz upload de arquivo de áudio (WhisperX faz forced alignment)

Ao confirmar, o backend dispara a geração do áudio de forma assíncrona. O frontend aguarda via WebSocket.

**Saída:** `job` com `status: "audio_ready"`, campos `audioKey` e `sceneSlots` preenchidos.

`sceneSlots` são calculados automaticamente a partir dos timestamps do áudio. A estratégia de segmentação depende do tipo de narração:
- **TTS com roteiro estruturado (cenas):** uma slot por cena (delimitadas por `\n\n` duplo ou marcadores explícitos)
- **TTS ou áudio contínuo:** segmentação por pausas longas (silêncio > Xms) detectadas pelo provider ou WhisperX
- **Fallback:** N slots de duração igual, onde N é configurável

---

### Etapa 3 — Definição de Mídias

O usuário vê a waveform/timeline do áudio com N slots marcados. Para cada slot, associa uma mídia:
- Upload direto de imagem/vídeo
- Escolha da biblioteca de assets
- Prompt para geração por IA (futuro)

Os slots podem ser redimensionados (ajuste manual de `startMs`/`endMs`) e mesclados ou divididos.

**Saída:** `job` com `status: "ready"` quando todos os slots têm `assetId` preenchido.

---

### Etapa 4 — Renderização

O usuário revisa o resumo (template, duração estimada, créditos, slots) e confirma.

O backend enfileira o job no BullMQ. O renderer executa o grafo usando os `sceneSlots` já preenchidos.

**Saída:** `job` com `status: "rendering" → "done" | "failed"`.

---

## Modelo de Dados

### Novo campo: `status` (enum estendido)

```
"draft"           — job criado, template selecionado
"audio_processing"— áudio sendo gerado (TTS ou WhisperX)
"audio_ready"     — áudio pronto, slots calculados, aguardando mídias
"ready"           — todos os slots preenchidos, pronto para renderizar
"rendering"       — job enfileirado e em execução (atual "pending"+"processing")
"done"            — concluído
"failed"          — erro
```

> Os status antigos `"pending"` e `"processing"` são unificados em `"rendering"` para simplificar — o frontend não precisava distinguir os dois.

### Novos campos na tabela `jobs`

| Campo | Tipo | Descrição |
|---|---|---|
| `audioKey` | `text \| null` | MinIO key do áudio gerado na etapa 2 |
| `sceneSlots` | `jsonb \| null` | Array de `SceneSlot[]` |

### `SceneSlot`

```typescript
interface SceneSlot {
  index: number;
  startMs: number;
  endMs: number;
  assetId: string | null; // null = não preenchido
}
```

---

## Novo Node: `SceneMedia`

O template declara um node `SceneMedia` no lugar onde antes ficaria `MediaPool` + `VideoFit` para conteúdo por cena. Ele não carrega `assetIds` no template — lê `job.sceneSlots` em runtime.

### Handles

| Input | Output |
|---|---|
| — | `video` |

### Config

```typescript
interface SceneMediaConfig {
  // sem campos — tudo vem de job.sceneSlots em runtime
  fit?: "cover" | "contain"; // como escalar assets de imagem
  transitionMs?: number;      // crossfade entre slides (default: 0)
}
```

### Execução (renderer)

1. Lê `job.sceneSlots` do contexto
2. Para cada slot, baixa o asset do MinIO
3. Imagens → converte para clip de vídeo com duração `endMs - startMs`
4. Vídeos → trimma para a duração do slot
5. Concatena todos com FFmpeg (`concat` filter)
6. Saída: arquivo de vídeo com duração igual ao áudio total

### Grafo típico com `SceneMedia`

```
TTS.audio             → Render.audio
TTS.timestamps        → Subtitle.timestamps
TTS.sceneTimestamps   → (usado só no backend para calcular sceneSlots)
SceneMedia.video      → Layer.base
Subtitle.filter       → Layer.overlay
Layer.video           → Render.video
MusicPool.audios      → Render.music
```

> `SceneMedia` substitui o par `MediaPool + VideoFit` em templates de estilo "Reddit com slides".

---

## Novos Endpoints da API

### `POST /api/jobs` (modificado)

Agora cria o job com `status: "draft"`. Aceita apenas `templateId`.

```typescript
// request
{ templateId: string }

// response
{ jobId: string; status: "draft" }
```

### `POST /api/jobs/:id/audio`

Dispara a geração de áudio (etapa 2). Aceita narração (TTS ou áudio custom).

```typescript
// request
{
  narration:
    | { type: "tts"; text: string; provider: string; voice?: string; speed?: number }
    | { type: "audio"; assetId: string }
}

// response
{ status: "audio_processing" }
// resultado chega via WebSocket: job.status → "audio_ready" + sceneSlots preenchidos
```

### `PATCH /api/jobs/:id/slots`

Atualiza os slots (etapa 3). Pode ser chamado múltiplas vezes (saves parciais).

```typescript
// request
{
  slots: Array<{ index: number; assetId: string | null; startMs?: number; endMs?: number }>
}

// response
{ status: "audio_ready" | "ready"; slots: SceneSlot[] }
// status vira "ready" quando todos os slots têm assetId
```

### `POST /api/jobs/:id/render`

Enfileira o job para renderização (etapa 4). Só aceita jobs com `status: "ready"`.

```typescript
// response
{ status: "rendering"; creditsCharged: number }
```

### `DELETE /api/jobs/:id` (novo)

Descarta um job em `draft`, `audio_ready` ou `ready`. Libera créditos se já debitados.

---

## Frontend — Wizard de 4 Etapas

### Rota

`/jobs/new` — substituição ou complemento da `RenderPage` atual.

### Estrutura de componentes

```
JobWizardPage
├── WizardStepper          — barra de progresso (etapas 1-4)
├── Step1_TemplateSelect   — grid de templates com preview
├── Step2_Narration        — textarea TTS ou upload de áudio + config de voz
├── Step3_MediaSlots       — timeline com waveform + slot cards
│   ├── AudioWaveform      — visualização do áudio com marcadores de slot
│   └── SlotCard           — card por slot com uploader/asset picker
└── Step4_Confirm          — resumo + botão renderizar
```

### Persistência de estado

O estado do wizard é o próprio job no banco. Recarregar a página ou fechar e voltar retoma de onde parou, via `GET /api/jobs/:id`.

Jobs em `draft` / `audio_ready` / `ready` aparecem na `JobsPage` com badge "Em progresso" e link para retomar.

---

## Eventos WebSocket

Novos eventos além do `status_updated` atual:

| Evento | Payload | Quando |
|---|---|---|
| `audio_ready` | `{ jobId, sceneSlots }` | Áudio gerado + slots calculados |
| `slot_updated` | `{ jobId, slotIndex, assetId }` | Slot atualizado (feedback imediato) |
| `status_updated` | `{ jobId, status }` | Qualquer mudança de status |

---

## Cálculo de Créditos

Os créditos são debitados em dois momentos:

1. **Etapa 2 (áudio):** debita créditos de TTS ao confirmar narração
2. **Etapa 4 (render):** debita créditos de renderização ao enfileirar

Se o job for descartado após o débito de TTS, os créditos são reembolsados via `creditTransaction` com `amount` negativo e `reason: "refund"`.

Isso requer adicionar `"refund"` ao enum `creditTransactionReason`.

---

## Migrações de Banco

```sql
-- Estender enum job_status
ALTER TYPE job_status ADD VALUE 'draft';
ALTER TYPE job_status ADD VALUE 'audio_processing';
ALTER TYPE job_status ADD VALUE 'audio_ready';
ALTER TYPE job_status ADD VALUE 'ready';
ALTER TYPE job_status ADD VALUE 'rendering';
-- "pending" e "processing" permanecem por compatibilidade, deprecated

-- Novos campos em jobs
ALTER TABLE jobs ADD COLUMN audio_key TEXT;
ALTER TABLE jobs ADD COLUMN scene_slots JSONB;

-- Novo valor em credit_transaction_reason
ALTER TYPE credit_transaction_reason ADD VALUE 'refund';
```

---

## Compatibilidade com Fluxo Atual

Templates e jobs existentes continuam funcionando. O novo fluxo é opt-in:
- Templates sem node `SceneMedia` seguem o caminho atual (sem etapa 3)
- A `RenderPage` atual pode continuar existindo como "modo rápido" para templates simples
- Jobs antigos com `status: "pending" | "processing"` não são afetados

---

## Fora de Escopo (MVP desta feature)

- Geração de imagem por IA diretamente no wizard (etapa 3 aceita apenas assets já existentes)
- Edição da waveform / corte de áudio
- Múltiplos tracks de áudio (narração + trilha) configuráveis no wizard
- Preview de vídeo em tempo real por slot
