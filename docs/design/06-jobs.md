# Nyx — Jobs

> Objetivo: Dashboard de acompanhamento de renders. O usuario vê todos os seus jobs com status em tempo real, faz download dos videos prontos, e acompanha o historico de renderizacoes.
> Rota: `/jobs`
> Auth: Requer autenticacao

---

## 1. Estrategia

### Principios
- **Status instantaneo** — O usuario nunca deve precisar dar refresh para ver o progresso. WebSocket atualiza status em tempo real (pending → processing → done/failed).
- **Download direto** — Um clique para baixar o video pronto. Sem paginas intermediarias.
- **Transparencia em falhas** — Se um job falhar, o motivo e visivel. O usuario sabe o que aconteceu e pode agir (re-submeter, corrigir template, etc.).
- **Historico util** — O usuario consegue ver quanto gastou, quanto tempo levou, e qual template usou em cada render.

### Metricas-alvo
- **Status visibility**: <2s para refletir mudanca de status (via WebSocket)
- **Download time**: <1 click apos job done
- **Error clarity**: 100% dos erros com mensagem legivel (nunca stack trace)

---

## 2. Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Sidebar  │                         Jobs                                    │
│           │─────────────────────────────────────────────────────────────────│
│  ≡ Dash   │  Jobs de renderizacao       [Todos ▾]  🔍 Buscar...            │
│  ≡ Templ  │─────────────────────────────────────────────────────────────────│
│  ≡ Assets │                                                                 │
│  ≡ Jobs   │  ┌─────────────────────────────────────────────────────────┐   │
│  ≡ Credit │  │ Status    │ Template           │ Creditos │ Data    │  ⋮  │   │
│  ≡ Market │  ├───────────┼────────────────────┼──────────┼─────────┼─────┤   │
│           │  │ ● Done    │ Horror Reddit      │ 30 cr    │ 2 min   │ ⬇⋮  │   │
│           │  │ ◐ Process │ Motivacional v2    │ 25 cr    │ agora   │  ⋮  │   │
│           │  │ ○ Pending │ Curiosidades       │ 20 cr    │ 1 min   │  ⋮  │   │
│           │  │ ✕ Failed  │ Horror v3          │ 15 cr    │ 5 min   │  ⋮  │   │
│           │  │ ● Done    │ Reddit Top Posts   │ 30 cr    │ 1 hora  │ ⬇⋮  │   │
│           │  │ ● Done    │ Horror Reddit      │ 28 cr    │ 2 horas │ ⬇⋮  │   │
│           │  └───────────┴────────────────────┴──────────┴─────────┴─────┘   │
│           │                                                                 │
│           │  Mostrando 6 de 42 jobs               [← 1 2 3 ... 7 →]       │
│           │                                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Desktop (>=1024px):** Tabela full-width com todas as colunas.
**Tablet (768-1023px):** Tabela sem coluna "Creditos". Sidebar colapsada.
**Mobile (<768px):** Cards empilhados (sem tabela). Cada card mostra status + template + data + acoes.

---

## 3. Tabela de Jobs

### Colunas

| Coluna | Conteudo | Largura | Alinhamento |
|---|---|---|---|
| **Status** | Badge com icone + label | 120px | Left |
| **Template** | Nome do template usado | Flex | Left |
| **Creditos** | Custo do render | 100px | Right |
| **Data** | Tempo relativo (ha X min) | 120px | Right |
| **Acoes** | Botoes (download, menu) | 80px | Center |

### Status badges

| Status | Cor | Icone | Label |
|---|---|---|---|
| `pending` | `orange-500` | `Clock` | Pendente |
| `processing` | `cyan-500` (pulse) | `Loader` (spin) | Processando |
| `done` | `success` | `CheckCircle` | Concluido |
| `failed` | `error` | `XCircle` | Falhou |

- **Processing:** Badge com dot pulsante (`animate-pulse`) para indicar atividade
- **Failed:** Hover no badge mostra tooltip com mensagem de erro

### Acoes por status

| Status | Acoes disponiveis |
|---|---|
| `pending` | Cancelar (futuro) |
| `processing` | — (aguardando) |
| `done` | Download, Ver detalhes |
| `failed` | Ver erro, Re-submeter (futuro) |

**Botao Download (done):**
- Icone `Download` (Lucide), `cyan-500`
- Click: busca presigned URL via `GET /api/jobs/:id/download` e inicia download
- Tooltip: "Baixar video"

**Menu (⋮):**
- Ver detalhes → abre drawer/modal com info completa do job
- Download (se done)
- Re-submeter (se failed — futuro)

### Visual da tabela
- Background: `bg-deep`
- Header: `bg-surface`, `text-xs`, `text-muted`, `uppercase`, `tracking-wider`
- Rows: `bg-deep`, hover `bg-surface/50%`
- Row selecionada: `bg-cyan-900/10%`
- Borda entre rows: `border-subtle`
- Zebra striping: nao (hover e suficiente)
- Paginacao: 20 items por pagina

> **21st.dev — Componente base (tabela):**
> - **Table** (TanStack Table) — Tabela com sorting, filtering, paginacao, selecao de rows, e action menus. Base completa para a tabela de jobs.
> - Link: https://21st.dev/table
> - Adaptar: colunas customizadas (Status badge, Template name, Credits, Date, Actions), paginacao server-side, remover selecao de rows.

> **21st.dev — Componente base (status):**
> - **StatusBadge** — Badges com suporte a `pending`, `success`, `error`, icones automaticos (Clock, CheckCircle, XCircle). Mapeia diretamente para os status de job.
> - Link: https://21st.dev/status-badge
> - Adaptar: adicionar variante `processing` com dot pulsante, aplicar cores Nyx.

---

## 4. Job Detail (drawer/modal)

### Trigger: click na row ou "Ver detalhes" no menu

```
┌──────────────────────────────────────────┐
│                                          │
│  Job #c000...0088                  [X]   │
│                                          │
│  ─── STATUS ───                         │
│                                          │
│  ● Concluido                            │
│  Criado: 01/03/2026 14:30               │
│  Concluido: 01/03/2026 14:32            │
│  Duracao: 2 min 15 seg                  │
│                                          │
│  ─── TEMPLATE ───                       │
│                                          │
│  Horror Reddit Stories                   │
│  [Ver template →]                       │
│                                          │
│  ─── CUSTOS ───                         │
│                                          │
│  Renderizacao:     20 creditos          │
│  TTS (Talkify):    10 creditos          │
│  ─────────────────────────              │
│  Total debitado:   30 creditos          │
│                                          │
│  ─── VIDEO ───                          │
│                                          │
│  Resolucao: 1080x1920                   │
│  FPS: 30                                │
│  Formato: mp4                           │
│  Duracao: 2:15                          │
│                                          │
│  Disponivel para download ate:           │
│  02/03/2026 14:32 (22h restantes)       │
│                                          │
│  [⬇ Download Video]                     │
│                                          │
└──────────────────────────────────────────┘
```

**Para jobs com erro:**
```
│  ─── ERRO ───                           │
│                                          │
│  ✕ FFmpeg exited with code 1            │
│  "Invalid input: audio file corrupt"    │
│                                          │
│  [Copiar erro]                          │
```

**Visual:**
- Sheet/Drawer lateral (direita), 400px width
- Ou modal centralizado em mobile
- Background: `bg-elevated`
- Sections com separadores `border-subtle`

---

## 5. Real-time Updates (WebSocket)

### Comportamento
- Conexao WebSocket aberta ao entrar na pagina `/jobs`
- Recebe eventos: `{ jobId, status, progress?, error? }`
- Atualiza row correspondente instantaneamente (sem reload)
- Toast quando job muda para `done`: "Render concluido! Video pronto para download."
- Toast quando job muda para `failed`: "Render falhou: {motivo breve}"

### Visual de transicao
- Row faz flash sutil na cor do novo status ao atualizar
- Badge anima: icone anterior faz fade-out, novo faz fade-in
- Se `processing`: progress bar aparece abaixo da row (opcional, se backend reportar %)

---

## 6. Filtros

### Filtro de status (dropdown)

```
┌────────────────┐
│ Todos        ▾ │
├────────────────┤
│ ○ Todos        │
│ ○ Pendente     │
│ ○ Processando  │
│ ● Concluido    │
│ ○ Falhou       │
└────────────────┘
```

- Default: "Todos"
- Alem do dropdown, tabs acima da tabela podem ser uma alternativa (All | Pending | Processing | Done | Failed)
- Filtro client-side se <100 jobs, senao server-side via query param

### Busca
- Input com icone `Search`
- Busca por nome do template
- Debounced 300ms

---

## 7. Estado Vazio

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│                     [Icone Clapperboard]                          │
│                                                                    │
│              Nenhum render ainda                                  │
│                                                                    │
│     Crie um template e inicie seu                                 │
│     primeiro render                                               │
│                                                                    │
│              [→ Ir para Templates]                                │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. Layout Mobile (Cards)

Em telas <768px, a tabela vira uma lista de cards:

```
┌──────────────────────────────────┐
│  ● Concluido     2 min atras    │
│  Horror Reddit Stories           │
│  30 creditos · 2:15 de video    │
│  [⬇ Download]              [⋮] │
├──────────────────────────────────┤
│  ◐ Processando   agora         │
│  Motivacional v2                │
│  25 creditos                    │
├──────────────────────────────────┤
│  ✕ Falhou        5 min atras   │
│  Horror v3                      │
│  15 creditos                    │
│  Erro: audio file corrupt       │
└──────────────────────────────────┘
```

---

## 9. Animacoes

### Tabela
- **Row load:** Staggered fade-in (0.03s delay entre rows)
- **Status update (WebSocket):** Row faz flash de cor (background `status-color/10%` → transparent, `duration-normal`)
- **Download click:** Icone faz pulse `1 → 1.2 → 1` feedback

### Drawer/modal
- **Abre:** Slide-in da direita (`translateX: 100% → 0`, `duration-normal`)
- **Fecha:** Slide-out reverso

### Paginacao
- **Troca de pagina:** Crossfade entre rows (`duration-fast`)

---

## 10. Responsividade

| Breakpoint | Layout | Colunas visiveis | Detalhes |
|---|---|---|---|
| **>=1280px** | Tabela | Todas | Full info |
| **1024-1279px** | Tabela | Sem "Creditos" | Sidebar colapsada |
| **768-1023px** | Tabela | Status + Template + Data + Acoes | Sem sidebar |
| **<768px** | Cards | N/A (stacked) | Cards empilhados |

---

## 11. Notas Tecnicas

### API endpoints usados
- `GET /api/jobs?limit=20&offset=0` — Lista paginada
- `GET /api/jobs/:id` — Detalhes do job
- `GET /api/jobs/:id/download` — Presigned URL para download

### Retencao de videos
- Videos ficam disponiveis por **24 horas** apos conclusao
- Drawer mostra countdown: "Disponivel ate {data} ({Xh restantes})"
- Apos expiracao: botao Download desabilitado + mensagem "Video expirado"

### WebSocket events
```typescript
// Eventos recebidos
{ type: "job:status", jobId: string, status: "pending" | "processing" | "done" | "failed" }
{ type: "job:progress", jobId: string, progress: number } // 0-100 (futuro)
{ type: "job:done", jobId: string, durationSeconds: number }
{ type: "job:failed", jobId: string, error: string }
```

### Cache
- React Query com `staleTime: 10s`
- WebSocket invalida query cache ao receber evento
- Polling fallback: a cada 30s se WebSocket desconectar

---

## 12. Componentes 21st.dev — Resumo

| Secao | Componente | Link | Uso |
|---|---|---|---|
| Tabela de jobs | Table (TanStack) | https://21st.dev/table | Tabela com sorting, paginacao, action menus |
| Status badges | StatusBadge | https://21st.dev/status-badge | Badges com icones por status (pending, done, failed) |
| Progress (futuro) | Progress (Vercel-style) | https://21st.dev/progress | Barra de progresso por status, sem dependencias extras |
