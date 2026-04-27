# Nyx — Dashboard

> Objetivo: Hub central do usuario — visao geral de jobs recentes, creditos, atalhos rapidos e acesso a todas as areas da plataforma.
> Rota: `/dashboard`
> Auth: Requer autenticacao (redireciona para `/login` se nao autenticado)

---

## 1. Estrategia

### Principios
- **Visao geral em 5 segundos** — O usuario abre o dashboard e imediatamente entende: quantos creditos tem, qual o status dos jobs, e o que pode fazer agora.
- **Acao, nao decoracao** — Cada elemento do dashboard e clicavel ou informativo. Zero widgets ornamentais.
- **Recencia como prioridade** — Jobs recentes e atividade recente aparecem primeiro. O que importa e o que esta acontecendo *agora*.
- **Onboarding natural** — Usuario novo ve empty states com CTAs claros que guiam para a primeira acao (criar template, fazer upload).

### Metricas-alvo
- **Time to action**: <3 cliques para iniciar um render
- **Retencao de sessao**: Usuario retorna ao dashboard como ponto de partida
- **Onboarding completion**: 80%+ dos novos usuarios criam seu primeiro template na primeira sessao

---

## 2. Layout

### Estrutura: Sidebar colapsavel + Area principal

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [≡]  Nyx                                          [🔔] [avatar ▾]      │
├────────┬─────────────────────────────────────────────────────────────────┤
│        │                                                                 │
│  Sidebar│  Bom dia, {nome}. 👋                                          │
│        │                                                                 │
│  📊 Dash│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  📝 Templ│  │ Creditos │ │ Jobs hoje│ │ Templates│ │ Assets   │         │
│  📁 Asset│  │ 847      │ │ 12       │ │ 5        │ │ 23       │         │
│  🎬 Jobs│  │ ████░░░  │ │ +3 ↑     │ │          │ │          │         │
│  💰 Cred│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│        │                                                                 │
│  ──────│  Acoes rapidas                                                  │
│  ⚙ Sett│  ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│        │  │ + Novo   │ │ ↑ Upload │ │ ▶ Render │                       │
│        │  │ Template │ │ Asset    │ │ Rapido   │                       │
│        │  └──────────┘ └──────────┘ └──────────┘                       │
│        │                                                                 │
│        │  Jobs recentes                              [Ver todos →]       │
│        │  ┌──────────────────────────────────────────────────────┐       │
│        │  │ ● Horror Story #47    Done    2m34s    14:32   [↓]  │       │
│        │  │ ◉ Reddit AITA #12    Render.  1m22s    14:28   ...  │       │
│        │  │ ○ Motivational #8    Pending  est 3m   14:25   ...  │       │
│        │  │ ✗ Curiosity #33      Failed   —        13:50   [↻]  │       │
│        │  └──────────────────────────────────────────────────────┘       │
│        │                                                                 │
└────────┴─────────────────────────────────────────────────────────────────┘
```

**Desktop (≥1280px):** Sidebar expandida (240px) + area principal com max-w-7xl centralizado.
**Desktop (1024-1279px):** Sidebar colapsada (icones only, 64px) + area principal.
**Tablet (768-1023px):** Sidebar escondida, acessivel via hamburger. Area principal full-width.
**Mobile (<768px):** Sem sidebar. Bottom navigation com 4 itens principais. Area principal com padding lateral.

> **21st.dev — Componente base (layout geral):**
> - **Dashboard with Collapsible Sidebar** por tomisloading — Dashboard completo com sidebar colapsavel (icones + labels, secoes separadas, indicador de item ativo), grid de stats (4 KPI cards com icones + trending), lista de atividade recente, quick stats com progress bars. Layout ideal para adaptar como base do Nyx dashboard.
> - Link: https://21st.dev/tomisloading/dashboard
> - Adaptar: trocar paleta para Nyx (bg-deep para sidebar, bg-surface para cards, cyan-500 para item ativo), substituir metricas genericas pelas metricas do Nyx (creditos, jobs, templates, assets).

---

## 3. Sidebar

### Estrutura

**Estado expandido (240px):**
```
┌──────────────────┐
│  [Logo] Nyx      │  ← Logo + wordmark
│                  │
│  PRINCIPAL       │  ← Section label (text-muted, text-xs, uppercase)
│  ▌📊 Dashboard   │  ← Item ativo: bg cyan-900/30, borda esquerda cyan-500
│   📝 Templates   │
│   📁 Assets      │
│   🎬 Jobs        │
│                  │
│  CONTA           │
│   💰 Creditos    │
│   🏪 Marketplace │
│   ⚙ Configuracoes│
│                  │
│  ──────────────  │
│  [avatar] Nome   │  ← Footer: avatar + nome + menu dropdown
│  [◁] Colapsar    │
└──────────────────┘
```

**Estado colapsado (64px):**
- Apenas icones centralizados, sem labels
- Tooltip no hover mostrando o nome da pagina
- Logo reduzido para icone/sigla

**Visual:**
- Background: `bg-deep`
- Borda direita: `border-subtle` (1px)
- Item ativo: `bg cyan-900/30` + borda esquerda `cyan-500` (2px) + texto `text-primary`
- Item hover: `bg-hover` com transicao `duration-fast`
- Section labels: `text-muted`, `text-xs`, `uppercase`, `tracking-wider`
- Icones: Lucide React, 20px, `text-secondary` (inativo), `text-primary` (ativo)

**Comportamento:**
- Toggle de colapso com animacao suave (width transition, `duration-normal`)
- Labels fazem fade-out ao colapsar, fade-in ao expandir
- Persiste estado (expandido/colapsado) no localStorage
- Badge de notificacao no icone de Jobs quando ha jobs concluidos (pulsante)

> **21st.dev — Componente base (sidebar):**
> - **Sidebar Component** — Sidebar com icones, busca, secoes colapsaveis, area de perfil do usuario. Adaptar: remover busca, usar secoes "Principal" e "Conta", aplicar cores Nyx.
> - Link: https://21st.dev/sidebar

---

## 4. Header Bar (topo)

### Estrutura

```
┌──────────────────────────────────────────────────────────────────┐
│  [≡]  Breadcrumb: Dashboard              [🔔 2]  [avatar ▾]     │
└──────────────────────────────────────────────────────────────────┘
```

**Elementos:**
- **Hamburger (mobile/tablet):** Toggle da sidebar, visivel apenas quando sidebar esta escondida
- **Breadcrumb:** Navegacao contextual. No dashboard e apenas "Dashboard". Em sub-paginas mostra hierarquia.
- **Notificacoes (sino):** Badge com contagem de jobs concluidos/falhados nao vistos. Abre dropdown com lista de notificacoes.
- **Avatar:** Foto do usuario (via OAuth) ou iniciais. Dropdown com: Perfil, Configuracoes, Logout.

**Visual:**
- Background: `bg-deep`
- Borda bottom: `border-subtle`
- Altura: 64px
- Padding horizontal: 24px

---

## 5. Secao — KPI Cards (Stats)

### Layout: Grid 4 colunas (desktop) → 2 colunas (tablet) → 1 coluna (mobile)

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  💰 Creditos     │  │  🎬 Jobs hoje    │  │  📝 Templates    │  │  📁 Assets       │
│                 │  │                 │  │                 │  │                 │
│  847            │  │  12             │  │  5              │  │  23             │
│  ████████░░ 85% │  │  +3 ↑ vs ontem │  │                 │  │  1.2 GB usado   │
│                 │  │                 │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Cards

**1. Creditos**
- Icone: `Coins` (Lucide), cor `cyan-500`
- Valor principal: saldo atual (ex: "847"), fonte `text-3xl`, `font-bold`, `JetBrains Mono`
- Sub-info: barra de progresso mostrando % do plano usado (se aplicavel) ou "de 1000 creditos"
- Cor da barra: `cyan-500` (normal), `warning` (>75%), `error` (>90%)
- Clicavel → navega para `/credits`

**2. Jobs hoje**
- Icone: `Film` (Lucide), cor `orange-500`
- Valor principal: contagem de jobs do dia
- Sub-info: variacao vs dia anterior. "+3 ↑" em `success`, "-2 ↓" em `error`, "=" em `text-muted`
- Clicavel → navega para `/jobs`

**3. Templates**
- Icone: `LayoutTemplate` (Lucide), cor `cyan-500`
- Valor principal: total de templates do usuario
- Sub-info: "X favoritos" em `text-secondary`
- Clicavel → navega para `/templates`

**4. Assets**
- Icone: `FolderOpen` (Lucide), cor `orange-500`
- Valor principal: total de assets
- Sub-info: storage usado (ex: "1.2 GB de 5 GB")
- Clicavel → navega para `/assets`

**Visual dos cards:**
- Background: `bg-surface`
- Borda: `border-subtle` (1px)
- Hover: borda `border-medium` + `translateY(-2px)` + glow sutil da cor do icone
- Border-radius: `0.75rem`
- Padding: `1.25rem`
- Transicao: `duration-fast`, `ease-out`

> **21st.dev — Componente base (stats cards):**
> - **Stats cards with links** — Cards de estatisticas com nome, valor grande, variacao percentual (+/- com cor), e link "View more →" no footer. Grid responsivo 1→2→3 colunas. Perfeito para os 4 KPI cards do dashboard.
> - Link: https://21st.dev/stats-cards
> - Adaptar: trocar cores para paleta Nyx, adicionar icones Lucide, substituir link no footer por navegacao via React Router.
>
> - **Stats** — Cards de uso com progress bar (Requests, Credits, Storage, API Calls). Mostra valor atual, limite, e % com barra. Excelente para o card de Creditos especificamente.
> - Link: https://21st.dev/stats
> - Adaptar: usar para o card de creditos com barra cyan→warning→error conforme uso.

---

## 6. Secao — Acoes Rapidas

### Layout: 3 botoes em grid horizontal

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│                  │  │                  │  │                  │
│   ➕ Novo         │  │   ⬆ Upload       │  │   ▶ Render       │
│   Template       │  │   Asset          │  │   Rapido         │
│                  │  │                  │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Cards de acao:**

1. **Novo Template**
   - Icone: `Plus` (Lucide), 24px
   - Label: "Novo Template"
   - Acao: navega para `/templates/new` (editor vazio)
   - Visual: bg `bg-surface`, borda `border-subtle`, hover glow `cyan-glow`

2. **Upload Asset**
   - Icone: `Upload` (Lucide), 24px
   - Label: "Upload Asset"
   - Acao: abre modal de upload ou navega para `/assets` com upload automatico
   - Visual: bg `bg-surface`, borda `border-subtle`, hover glow `cyan-glow`

3. **Render Rapido**
   - Icone: `Play` (Lucide), 24px
   - Label: "Render Rapido"
   - Acao: abre seletor de template → inicia render com 1 clique
   - Visual: bg `orange-500/10`, borda `orange-500/30`, hover glow `orange-glow`
   - Este e o CTA principal — visual diferenciado para atrair atencao

**Visual:**
- Altura: 80px
- Border-radius: `0.75rem`
- Texto centralizado, icone acima do label
- Hover: `scale(1.02)` + glow sutil
- Transicao: `ease-spring`, `duration-normal`

> **21st.dev — Componente base (acoes rapidas):**
> - **QuickLinksCard** — Grid de 3 botoes de acao com icone + label, animacao spring no hover (scale 1.05), layout responsivo. Adaptar: trocar para 3 colunas horizontais, usar icones Lucide do Nyx, aplicar diferenciacao visual no "Render Rapido".
> - Link: https://21st.dev/card
>
> - **Grid List** — Grid de cards de acao com icone, titulo, descricao e seta. Alternativa com mais informacao por card se preferir descricoes nos atalhos.
> - Link: https://21st.dev/grid-list

---

## 7. Secao — Jobs Recentes

### Layout: Lista/tabela com 5 jobs mais recentes

```
Jobs recentes                                              [Ver todos →]
┌───────────────────────────────────────────────────────────────────────┐
│  Status   Nome                    Duracao    Hora     Acao            │
├───────────────────────────────────────────────────────────────────────┤
│  ● Done   Horror Story #47       2m 34s     14:32    [↓ Download]   │
│  ◉ Render Reddit AITA #12        1m 22s     14:28    [progresso]    │
│  ○ Pend.  Motivational #8        est 3m     14:25    —             │
│  ✗ Failed Curiosity #33          —          13:50    [↻ Retry]     │
│  ● Done   Reddit Top #91         4m 12s     13:15    [↓ Download]   │
└───────────────────────────────────────────────────────────────────────┘
```

**Colunas:**
- **Status:** Badge/pill com icone e cor (ver design-thinking secao 8 — Badges/Status pills)
  - Done: `success` + icone check
  - Rendering: `warning` + pulse animation
  - Pending: `text-muted` + icone clock
  - Failed: `error` + icone x
- **Nome:** Nome do job (truncado se necessario), fonte `text-sm`, `text-primary`
- **Duracao:** Tempo de render (concluido) ou estimativa (pendente), `JetBrains Mono`, `text-secondary`
- **Hora:** Timestamp relativo ou absoluto, `text-muted`, `text-xs`
- **Acao:**
  - Done: botao ghost "Download" com icone `Download`
  - Rendering: barra de progresso mini (inline)
  - Pending: dash (sem acao)
  - Failed: botao ghost "Retry" com icone `RotateCcw`

**Visual:**
- Background: `bg-surface`
- Borda: `border-subtle`
- Hover de linha: `bg-hover`
- Border-radius: `0.75rem`
- Header "Jobs recentes": `text-xl`, Syne 600, `text-primary`
- Link "Ver todos →": `text-sm`, `cyan-500`, hover `cyan-400`

**Comportamento:**
- Jobs "Rendering" atualizam em tempo real via WebSocket
- Barra de progresso anima suavemente
- Novo job aparece no topo com animacao fade-in + slide-down
- Click na linha inteira navega para detalhes do job

> **21st.dev — Componente base (activity/jobs list):**
> - **Dashboard Activities** — Feed de atividades recentes com motion (framer-motion). Cada item tem icone colorido, mensagem, timestamp. Animacao de entrada staggered e saida suave. Otimo para a lista de jobs recentes com adaptacao para incluir status badges e acoes.
> - Link: https://21st.dev/dashboard-activities
> - Adaptar: trocar items de atividade por jobs, adicionar coluna de status com badges, incluir botoes de acao (download/retry), aplicar cores de status do Nyx.
>
> - **Activity Dropdown** — Lista de atividades em dropdown com icone, titulo, descricao e timestamp. Animacao de expand/collapse com stagger delay. Util como referencia para o dropdown de notificacoes do header.
> - Link: https://21st.dev/activity-dropdown

---

## 8. Secao — Widget de Creditos (sidebar do conteudo principal)

### Layout: Card lateral ou embutido na area principal

Em telas largas (≥1440px), o widget de creditos pode aparecer como card lateral fixo a direita. Em telas menores, integra-se como o primeiro KPI card (secao 5).

```
┌────────────────────┐
│  Seus creditos     │
│                    │
│  847 / 1000        │
│  ████████████░░░   │
│                    │
│  ~3 videos restam  │
│                    │
│  [Comprar mais]    │
└────────────────────┘
```

**Conteudo:**
- Titulo: "Seus creditos", `text-sm`, `text-secondary`
- Valor: `{saldo} / {total}`, `JetBrains Mono`, `text-2xl`, `text-primary`
- Barra de progresso: cor muda conforme uso (cyan → warning → error)
- Estimativa: "~X videos restam" (calculo: saldo / custo medio por video)
- CTA: "Comprar mais" — botao ghost `cyan-500`, navega para `/credits`

**Visual:**
- Background: `bg-surface`
- Borda: `border-subtle` com glow `cyan-glow` sutil quando creditos > 50%
- Borda com glow `warning-glow` quando creditos entre 25-50%
- Borda com glow `error-glow` quando creditos < 25%

---

## 9. Estado Vazio (Onboarding)

### Primeira visita do usuario

Quando o usuario nao tem templates, jobs ou assets, o dashboard mostra empty states com CTAs que guiam para a primeira acao.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Bem-vindo ao Nyx, {nome}! 🎬                                   │
│                                                                  │
│  Voce tem 10 creditos na conta — suficiente para seu             │
│  primeiro video de ate 30 segundos.                              │
│                                                                  │
│  Comece em 3 passos:                                             │
│                                                                  │
│  ┌─────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ 1       │  │ 2           │  │ 3           │                  │
│  │ Upload  │→ │ Crie um     │→ │ Renderize   │                  │
│  │ assets  │  │ template    │  │ seu video   │                  │
│  │         │  │             │  │             │                  │
│  │ [Ir]    │  │ [Ir]        │  │ [Ir]        │                  │
│  └─────────┘  └─────────────┘  └─────────────┘                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Copy:**
- Headline: "Bem-vindo ao Nyx, {nome}!"
- Sub: "Voce tem 10 creditos na conta — suficiente para seu primeiro video de ate 30 segundos."
- Passos:
  1. "Faca upload dos seus videos de background e audios" → navega para `/assets`
  2. "Monte seu primeiro template no editor visual" → navega para `/templates/new`
  3. "Clique em Render e pronto" → desabilitado ate ter template

**Visual:**
- Fundo: gradient radial sutil `cyan-glow` centrado
- Cards dos passos: `bg-surface`, borda `border-subtle`, hover glow
- Seta entre cards: `→` em `text-muted` (desktop), empilhados sem seta (mobile)
- Animacao: stagger reveal dos 3 cards (delay 100ms entre cada)

### Empty states por secao

**Jobs recentes (vazio):**
```
┌──────────────────────────────────────────┐
│                                          │
│  [icone Film com opacity 0.3]            │
│                                          │
│  Nenhum job ainda                        │
│  Crie um template e renderize seu        │
│  primeiro video.                         │
│                                          │
│  [Criar template →]                      │
│                                          │
└──────────────────────────────────────────┘
```

**Templates (vazio):**
- Icone: `LayoutTemplate`
- Texto: "Nenhum template. Comece criando seu primeiro."
- CTA: "Novo template →"

**Assets (vazio):**
- Icone: `FolderOpen`
- Texto: "Biblioteca vazia. Faca upload de videos e audios."
- CTA: "Upload assets →"

> **21st.dev — Componente base (empty states):**
> - **Empty State** por shadcn-ui-chadcn — Container com borda tracejada, trio de icones com rotacao, titulo, descricao e botao de acao. Perfeito para empty states de secoes individuais (jobs, templates, assets).
> - Link: https://21st.dev/shadcn-ui-chadcn/empty-state
> - Adaptar: trocar icones para Lucide do Nyx, aplicar bg-surface, borda border-subtle (tracejada), CTA ghost cyan-500.

---

## 10. Animacoes e Interacoes

### Entrada na pagina (page load)
1. Sidebar desliza da esquerda (`translateX(-100%) → 0`, `duration-slow`)
2. Header bar faz fade-in (`opacity: 0 → 1`, `duration-normal`)
3. KPI cards aparecem em stagger (fade-up, delay 50ms entre cada, `duration-reveal`)
4. Acoes rapidas aparecem apos os KPIs (delay +200ms)
5. Jobs recentes aparecem por ultimo (delay +300ms)

### Interacoes em tempo real
- **Job muda de status:** Badge de status faz transicao de cor com flash sutil (0.3s)
- **Job concluido:** Linha do job faz pulse glow `success` (1x) + botao download aparece com fade-in
- **Job falhou:** Linha faz pulse glow `error` (1x) + botao retry aparece
- **Novo job criado:** Insere no topo da lista com slide-down + fade-in

### Micro-interacoes
- KPI cards: hover `translateY(-2px)` + border glow
- Acoes rapidas: hover `scale(1.02)` com `ease-spring`
- Sidebar items: hover bg transition `duration-fast`
- Sidebar collapse: width + opacity transition `duration-normal`
- Notificacao badge: pulse animation infinita quando ha nao-lidos

---

## 11. Responsividade

### Breakpoints

| Breakpoint | Sidebar | KPI Grid | Acoes | Jobs |
|---|---|---|---|---|
| **≥1280px** | Expandida (240px) | 4 colunas | 3 colunas | Tabela completa |
| **1024-1279px** | Colapsada (64px) | 4 colunas | 3 colunas | Tabela completa |
| **768-1023px** | Escondida (hamburger) | 2 colunas | 3 colunas | Tabela simplificada (sem coluna "Hora") |
| **<768px** | Bottom nav | 2 colunas → stack | 1 coluna (vertical) | Cards empilhados (sem tabela) |

### Mobile-specific
- Bottom navigation com 4 itens: Dashboard, Templates, Jobs, Menu (abre drawer com restante)
- KPI cards viram 2x2 grid, depois stack vertical
- Jobs recentes viram cards individuais em vez de linhas de tabela
- Acoes rapidas empilham verticalmente
- Header simplificado: apenas hamburger + notificacoes + avatar

---

## 12. Notas Tecnicas

### Data fetching
- **Initial load:** Fetch paralelo de `/credits/balance`, `/jobs?limit=5&sort=recent`, `/templates?count=true`, `/assets?count=true`
- **Real-time:** WebSocket para atualizacoes de status de jobs
- **Cache:** React Query / SWR com stale-while-revalidate. KPIs revalidam a cada 30s.
- **Skeleton loading:** Cada secao exibe skeleton independente enquanto carrega

### State management (Zustand)
- `useDashboardStore`: creditos, jobs recentes, contadores
- `useSidebarStore`: estado de colapse (persistido em localStorage)
- `useNotificationStore`: lista de notificacoes nao-lidas

### Rotas (React Router v7)
- `/dashboard` — pagina principal
- Layout compartilhado: `<DashboardLayout>` com sidebar + header + outlet
- Protecao de rota: middleware de auth redireciona para `/login`

### Componentes
- `<Sidebar>` — Navegacao lateral colapsavel
- `<StatsGrid>` — Grid de KPI cards
- `<QuickActions>` — Botoes de acao rapida
- `<RecentJobs>` — Lista/tabela de jobs recentes
- `<CreditsWidget>` — Widget de creditos com barra
- `<EmptyState>` — Componente reutilizavel para estados vazios
- `<NotificationDropdown>` — Dropdown de notificacoes

---

## 13. Componentes 21st.dev — Resumo

| Secao | Componente | Autor | Link | Uso |
|---|---|---|---|---|
| Layout geral | Dashboard with Collapsible Sidebar | tomisloading | https://21st.dev/tomisloading/dashboard | Base do layout: sidebar colapsavel + stats grid + activity list |
| Sidebar | Sidebar Component | — | https://21st.dev/sidebar | Referencia para sidebar com icones, secoes e perfil |
| KPI Cards | Stats cards with links | — | https://21st.dev/stats-cards | Cards de metricas com valor, variacao % e link |
| Card Creditos | Stats (com progress) | — | https://21st.dev/stats | Cards com progress bar para uso de creditos |
| Acoes rapidas | QuickLinksCard | — | https://21st.dev/card | Grid de botoes de acao com icone + label |
| Acoes rapidas (alt) | Grid List | — | https://21st.dev/grid-list | Cards de acao com icone, titulo e descricao |
| Jobs recentes | Dashboard Activities | — | https://21st.dev/dashboard-activities | Feed de atividades com motion animation |
| Notificacoes | Activity Dropdown | — | https://21st.dev/activity-dropdown | Dropdown expandivel com lista de atividades |
| Empty state | Empty State | shadcn-ui-chadcn | https://21st.dev/shadcn-ui-chadcn/empty-state | Container com icone, titulo, descricao e CTA |
