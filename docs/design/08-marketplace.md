# Nyx — Marketplace

> Objetivo: Galeria de templates publicos onde usuarios podem descobrir, visualizar e clonar templates criados pela comunidade ou pelo time Nyx. Funciona como inspiracao e acelerador de producao.
> Rota: `/marketplace`
> Auth: Requer autenticacao (para clonar), navegacao publica (futuro)

---

## 1. Estrategia

### Principios
- **Descoberta rapida** — O usuario encontra um template relevante em <30 segundos via categorias, busca, ou destaques.
- **Preview antes de clonar** — O usuario ve o pipeline completo (nodes, edges) e um sample output antes de se comprometer.
- **Clone com um click** — Clonar cria uma copia completa no workspace do usuario. Sem dependencias do template original.
- **Comunidade como motor** — Templates publicos de outros usuarios alimentam o ecossistema. Publicar e opt-in no Template Editor.

### Metricas-alvo
- **Clone rate**: >15% dos usuarios que visitam marketplace clonam pelo menos 1 template
- **Time to clone**: <30s entre chegar e clonar
- **Template diversity**: >50 templates publicos no lancamento

---

## 2. Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Sidebar  │                      Marketplace                                │
│           │─────────────────────────────────────────────────────────────────│
│  ≡ Dash   │                                                                 │
│  ≡ Templ  │  🔍 Buscar templates...        [Categoria ▾]  [Grid] [List]    │
│  ≡ Assets │                                                                 │
│  ≡ Jobs   │  ─── DESTAQUES ───                                             │
│  ≡ Credit │                                                                 │
│  ≡ Market │  ┌────────────────────┐  ┌────────────────────┐                │
│           │  │ ★                  │  │ ★                  │                │
│           │  │ [Mini graph]       │  │ [Mini graph]       │                │
│           │  │                    │  │                    │                │
│           │  │ Reddit Horror      │  │ Motivacional       │                │
│           │  │ por @darkmaster    │  │ por @nyx-team      │                │
│           │  │ 234 clones · ★4.8  │  │ 189 clones · ★4.9  │                │
│           │  │                    │  │                    │                │
│           │  │ [Ver] [Clonar]     │  │ [Ver] [Clonar]     │                │
│           │  └────────────────────┘  └────────────────────┘                │
│           │                                                                 │
│           │  ─── TODOS OS TEMPLATES ───                                    │
│           │                                                                 │
│           │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│           │  │ [graph]  │  │ [graph]  │  │ [graph]  │  │ [graph]  │      │
│           │  │ Story v2 │  │ Horror   │  │ Top 10   │  │ Curiosi. │      │
│           │  │ @user1   │  │ @user2   │  │ @user3   │  │ @nyx     │      │
│           │  │ 45 clon. │  │ 12 clon. │  │ 98 clon. │  │ 67 clon. │      │
│           │  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│           │                                                                 │
│           │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│           │  │ ...      │  │ ...      │  │ ...      │  │ ...      │      │
│           │  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│           │                                                                 │
│           │  [Carregar mais...]                                            │
│           │                                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Desktop (>=1024px):** Grid 4 colunas. Destaques em cards maiores (2 cols each).
**Tablet (768-1023px):** Grid 3 colunas. Destaques em 1 col each.
**Mobile (<768px):** Grid 2 colunas. Destaques em 1 col, scroll horizontal.

---

## 3. Header + Filtros

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔍 Buscar templates...           [Categoria ▾]    [Grid] [List]    │
└──────────────────────────────────────────────────────────────────────┘
```

**Busca:**
- Input com icone `Search`
- Placeholder: "Buscar templates..."
- Busca por nome do template
- Debounced 300ms

**Filtro de categoria (dropdown):**
- Todas (default)
- Reddit Stories
- Horror / Terror
- Motivacional
- Curiosidades / Fatos
- Custom / Outros

**Toggle de layout:**
- Grid (default): icone `Grid3x3`
- Lista: icone `List`
- Transicao animada entre layouts

**Ordenacao (dropdown):**
- Mais populares (default — por clones)
- Mais recentes
- Melhor avaliados

> **21st.dev — Componente base (layout toggle):**
> - **Animated Toggle Layout Container** — Container com toggle entre grid (2 cols, 4 cols) e list view com transicoes animadas (Framer Motion LayoutGroup). Perfeito para o toggle grid/list do marketplace.
> - Link: https://21st.dev/animated-toggle-layout-container

---

## 4. Template Cards

### Card padrao (grid)

```
┌───────────────────────────┐
│ ┌───────────────────────┐ │
│ │                       │ │  ← Preview do grafo (miniatura)
│ │   [VP]──[Loop]──[Lay] │ │     Miniatura simplificada dos nodes + edges
│ │   [TTS]──┘   [Sub]──┘ │ │     Cores das categorias de node
│ │                       │ │
│ └───────────────────────┘ │
│                             │
│  Reddit Horror Stories      │  ← Nome do template
│  por @darkmaster            │  ← Autor
│                             │
│  6 nodes · 7 edges          │  ← Metadados do grafo
│  234 clones                 │  ← Popularidade
│                             │
│  [Horror] [Reddit]          │  ← Tags/categorias
│                             │
│  [Ver detalhes] [Clonar]    │  ← Acoes
│                             │
└───────────────────────────┘
```

**Visual:**
- Background: `bg-surface`
- Borda: `border-subtle`
- Border-radius: `0.75rem`
- Hover: borda `border-medium`, sombra sutil, card sobe 2px
- Preview area: `bg-void`, aspect ratio 16:10

**Preview do grafo:**
- Renderizacao simplificada dos nodes como retangulos coloridos por tipo
- Edges como linhas entre eles
- Sem labels detalhados — apenas forma do pipeline
- Gerado client-side com canvas ou SVG simples

**Tags:**
- Badges pequenos: `bg-elevated`, `text-xs`, `text-secondary`, `border-subtle`
- Max 3 tags visiveis + "+N" se mais

### Card lista (alternativa)

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Preview] │ Reddit Horror Stories   │ 6 nodes │ 234 clones │ [Clonar] │
│  [mini]    │ por @darkmaster         │ 7 edges │ ★ 4.8      │          │
└──────────────────────────────────────────────────────────────────────┘
```

> **21st.dev — Componente base (cards):**
> - **Product Card** — Card de produto com imagem, nome, tagline, metadata, e botao de acao. Demo inclui grid responsivo 4 colunas com staggered animations. Adaptar para template cards.
> - Link: https://21st.dev/product-card-2
>
> - **Layout Grid** — Grid com cards clicaveis que expandem em overlay com detalhes. Click no template card pode abrir preview expandido com o grafo completo.
> - Link: https://21st.dev/layout-grid

---

## 5. Template Detail (preview expandido)

### Trigger: click em "Ver detalhes" ou no card

```
┌──────────────────────────────────────────────────────────────────┐
│                                                          [X]      │
│  Reddit Horror Stories                                           │
│  por @darkmaster · Publicado em 15/02/2026                       │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │   [VideoPool]───videos───[Loop]───video───[Layer]          │  │
│  │                                   ↑              ↑         │  │
│  │   [TTS]───audio─────────────────┘              │         │  │
│  │        └──timestamps───[Subtitle]───filter──────┘         │  │
│  │                                                            │  │
│  │   [MusicPool]───audios───[Render]←video─[Layer]           │  │
│  │                           ↑                                │  │
│  │                  [TTS]───audio                             │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ─── PIPELINE ───                                                 │
│                                                                    │
│  7 nodes · 8 edges                                                │
│  VideoPool (3 videos) → Loop → Layer + Subtitle → Render         │
│  MusicPool (5 musicas) → Render (mix)                             │
│  TTS: Talkify · Voz: Rachel · 1.0x                               │
│  Render: 1080x1920 · 30fps · MP4                                  │
│                                                                    │
│  ─── STATS ───                                                    │
│                                                                    │
│  234 clones · ★ 4.8 (42 avaliacoes)                              │
│                                                                    │
│  ─── ACOES ───                                                    │
│                                                                    │
│  [Clonar para meu workspace]                                      │
│                                                                    │
│  Nota: clonar cria uma copia independente.                        │
│  Voce pode editar livremente sem afetar o original.               │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Visual:**
- Modal ou sheet full-height
- Preview do grafo: renderizacao mais detalhada que o card (com labels dos nodes)
- Background do grafo: `bg-void` com dot grid
- Info do pipeline em `JetBrains Mono`, `text-sm`, `text-secondary`

**Comportamento:**
- Grafo e read-only (sem drag, sem edicao)
- Zoom/pan permitido no preview
- "Clonar" cria POST no backend → copia template + redireciona para `/templates/:newId/edit`

---

## 6. Secao de Destaques

### Templates em destaque (curados pelo time Nyx)

Cards maiores (2x largura), com visual diferenciado:
- Badge estrela "Destaque" em `orange-500`
- Preview maior com mais detalhes do grafo
- Descricao breve do template (1-2 linhas)
- Background com gradiente sutil `bg-surface` → `bg-elevated`
- Borda `border-orange-500/30%`

---

## 7. Estado Vazio

### Sem resultados de busca

```
┌──────────────────────────────────────────────────────────────┐
│                                                                │
│                    [Icone SearchX]                             │
│                                                                │
│         Nenhum template encontrado para                       │
│         "{busca}" em {categoria}                              │
│                                                                │
│         Tente outra busca ou [limpar filtros]                 │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### Marketplace vazio (improvavel, mas defensivo)

```
│  O marketplace esta sendo preparado.                          │
│  Em breve voce podera descobrir templates da comunidade.      │
│  [← Criar meu proprio template]                              │
```

---

## 8. Copy & Microcopy

| Elemento | Texto |
|---|---|
| Titulo da pagina | Marketplace |
| Busca placeholder | Buscar templates... |
| Filtro categorias | Categoria |
| Filtro default | Todas |
| Ordenacao default | Mais populares |
| Badge destaque | Destaque |
| Card clones | {N} clones |
| Card autor | por @{username} |
| Botao ver | Ver detalhes |
| Botao clonar | Clonar |
| Botao clonar (detail) | Clonar para meu workspace |
| Clone nota | Clonar cria uma copia independente. Voce pode editar livremente sem afetar o original. |
| Clone sucesso | Template clonado! Redirecionando para o editor... |
| Empty search | Nenhum template encontrado para "{busca}" |
| Empty filtered | Nenhum template encontrado em "{categoria}" |
| Carregar mais | Carregar mais templates |

---

## 9. Animacoes

### Grid
- **Cards entram:** Staggered fade-in + translate-y (`0.05s` delay, `ease-spring`)
- **Card hover:** Sombra intensifica, translate-y `-2px`, `duration-fast`
- **Layout toggle (grid/list):** Framer Motion `LayoutGroup` — cards se reposicionam suavemente

### Detail overlay
- **Abre:** Card faz expand animation (Framer Motion `layoutId`), backdrop fade-in
- **Fecha:** Reverse animation, card volta ao tamanho original
- **Alternativa simples:** Modal slide-up com fade

### Clonar
- **Click "Clonar":** Botao faz loading spinner
- **Sucesso:** Toast com confetti sutil (2-3 particulas), redirect apos 1s

---

## 10. Responsividade

| Breakpoint | Grid | Destaques | Detail | Busca |
|---|---|---|---|---|
| **>=1280px** | 4 colunas | 2 cols per card | Modal overlay | Input expandido |
| **1024-1279px** | 3 colunas | 1 col per card | Modal overlay | Input expandido |
| **768-1023px** | 2 colunas | 1 col, scroll horizontal | Sheet full-height | Input + icone |
| **<768px** | 2 colunas | 1 col, scroll horizontal | Sheet full-height | Icone only (expand on tap) |

---

## 11. Notas Tecnicas

### API endpoints necessarios (futuro — nao implementado ainda)
- `GET /api/marketplace?limit=20&offset=0&category=horror&sort=popular` — Lista templates publicos
- `GET /api/marketplace/:id` — Detalhes de um template publico
- `POST /api/marketplace/:id/clone` — Clona template para o usuario
- `POST /api/templates/:id/publish` — Publica template do usuario (opt-in)

### Template publishing flow
1. Usuario marca template como publico no Template Editor (toggle "Publicar no Marketplace")
2. Backend valida: grafo valido, tem pelo menos 1 asset referenciado, nome preenchido
3. Template aparece no marketplace com status "publico"
4. Autor pode despublicar a qualquer momento

### Clone mechanics
- Cria novo template no workspace do usuario
- Copia grafo completo (nodes + edges + configs)
- **NAO** copia assets — usuario precisa ter seus proprios assets (ou re-referenciar)
- Apos clonar, nao ha vinculo com o original

### Cache
- Lista: React Query, `staleTime: 60s` (marketplace muda lentamente)
- Infinite scroll com `useInfiniteQuery` (offset-based)

---

## 12. Componentes 21st.dev — Resumo

| Secao | Componente | Link | Uso |
|---|---|---|---|
| Template cards | Product Card | https://21st.dev/product-card-2 | Cards com preview, nome, metadata, acoes |
| Grid com preview | Layout Grid | https://21st.dev/layout-grid | Grid clicavel com expand overlay |
| Layout toggle | Animated Toggle Layout | https://21st.dev/animated-toggle-layout-container | Toggle grid/list com animacao |
| Filtro de categorias | Multiple Selector | https://21st.dev/multiple-selector | Multi-select com busca e badges |
