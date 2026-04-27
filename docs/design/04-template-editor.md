# Nyx — Template Editor

> Objetivo: Core do produto — editor visual de nodes onde o usuario monta seu pipeline de video (da fonte de video ate o render final) usando drag-and-drop e conexoes visuais.
> Rotas: `/templates/new`, `/templates/:id/edit`
> Auth: Requer autenticacao

---

## 1. Estrategia

### Principios
- **O template e a maquina** — O usuario esta construindo uma "maquina de videos". Cada node e uma engrenagem, cada edge e um fluxo de dados. A metafora deve ser clara e tangivel.
- **Drag, connect, render** — O fluxo completo do editor deve ser: arrastar nodes do painel → conectar handles → configurar propriedades → clicar "Render". Sem passos escondidos.
- **Feedback visual constante** — O usuario sempre sabe o que esta conectado, o que falta, e se ha erros. Edges animadas, status badges nos nodes, validacao em tempo real.
- **Sensacao de ferramenta profissional** — Inspiracao em DaVinci Resolve e Runway ML. O editor deve parecer poderoso mas acessivel. Dark surfaces, glow nos elementos ativos, profundidade em camadas.

### Mental Model
```
[Fontes]       →  [Processamento]  →  [Composicao]  →  [Output]
VideoPool          Loop, TTS           Layer, Subtitle    Render
MusicPool
```

O usuario pensa em camadas de producao:
1. "De onde vem meu video de fundo?" → VideoPool (pool de videos, concatenados aleatoriamente)
2. "De onde vem a narracao?" → TTS (texto definido na hora de renderizar, nao no template)
3. "Quero musica de fundo?" → MusicPool (pool de musicas, concatenadas aleatoriamente)
4. "Como combino video + audio?" → Loop (concatena videos aleatorios ate a duracao do audio)
5. "Quero legendas?" → Subtitle
6. "Como monto o frame final?" → Layer (base + overlays)
7. "Qual o formato de saida?" → Render (mixa narracao + musica de fundo)

### Metricas-alvo
- **Time to first template**: <5 minutos para um usuario novo montar o fluxo basico
- **Template reuse rate**: >70% dos renders usam templates salvos (nao recriam do zero)
- **Error rate**: <5% dos renders falham por erro de configuracao do template

---

## 2. Layout

### Estrutura: 3 paineis redimensionaveis

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [← Back]   Template: "Horror Reddit Stories"   [Salvo ✓]   [▶ Render]     │
├────────┬─────────────────────────────────────────────────────┬──────────────┤
│        │                                                     │              │
│  Node  │              Canvas (React Flow)                    │  Properties  │
│ Palette│                                                     │    Panel     │
│        │   ┌──────────┐         ┌──────────┐                │              │
│ ────── │   │ VideoPool │──videos─│  Loop    │                │  [Node: TTS] │
│ FONTES │   └──────────┘         └────┬─────┘                │              │
│ ○ Video│                             │                       │  Provider:   │
│ ○ Music│   ┌──────────┐             │video                  │  [Talkify ▾] │
│ ○ TTS  │   │   TTS    │──audio──────┤                       │              │
│        │   │          │──timestamps─┼───┐                   │  Voice:      │
│ ────── │   └──────────┘             │   │                   │  [Rachel ▾]  │
│ PROC.  │                            │   │                   │              │
│ ○ Loop │   ┌──────────┐            │   │                   │  Speed:      │
│ ○ Sub  │   │ Subtitle │←timestamps─┘   │                   │  [1.0x    ▾] │
│        │   └────┬─────┘                │                   │              │
│ ────── │        │filter                │video              │  * Texto da  │
│ COMP.  │   ┌────┴──────────────────────┴──┐                │  narracao e  │
│ ○ Layer│   │           Layer              │                │  definido na │
│        │   └──────────────┬───────────────┘                │  hora de     │
│ ────── │                  │video                           │  renderizar  │
│ OUTPUT │   ┌──────────────┴───────────────┐   ┌─────────┐ │              │
│ ○ Rend │   │           Render             │←──│MusicPool│ │              │
│        │   │      1080x1920 · 30fps       │   └─────────┘ │              │
│        │   └──────────────────────────────┘                │              │
│        │                                                     │              │
│        │  [Minimap]  [─] [+] [Fit] [Grid]                   │              │
├────────┴─────────────────────────────────────────────────────┴──────────────┤
│  Validacao: ✓ Grafo valido · 7 nodes · 8 edges · Est. 2 min render        │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Desktop (≥1280px):** 3 paineis — Palette (220px) | Canvas (flex) | Properties (300px). Redimensionaveis com drag handle.
**Desktop (1024-1279px):** Palette colapsada (icones only, 48px) | Canvas (flex) | Properties (280px).
**Tablet (768-1023px):** Sem palette fixa (acessa via botao flutuante). Canvas full. Properties em sheet bottom/lateral.
**Mobile (<768px):** Nao suportado. Exibe mensagem "Use um desktop para editar templates" com link para dashboard.

> **21st.dev — Componente base (layout redimensionavel):**
> - **Resizable** — Paineis redimensionaveis com handles de drag (react-resizable-panels). Suporta horizontal e vertical, nested groups, e handles customizaveis com icone GripVertical. Base perfeita para o layout 3-paineis do editor.
> - Link: https://21st.dev/resizable
> - Adaptar: 3 paineis horizontais (palette | canvas | properties), handles com borda `border-subtle`, min-width por painel para evitar colapso total.

---

## 3. Top Bar

### Estrutura

```
┌──────────────────────────────────────────────────────────────────────┐
│  [← Dashboard]   📝 Horror Reddit Stories   [Salvo ✓]   [▶ Render] │
└──────────────────────────────────────────────────────────────────────┘
```

**Elementos:**

- **Back button:** Icone `ArrowLeft` + "Dashboard" (ghost, `cyan-500`). Navega para `/dashboard`. Se houver alteracoes nao salvas, exibe dialog de confirmacao.
- **Nome do template:** Editavel inline (click para editar). Fonte Syne 600, `text-xl`, `text-primary`. Input com borda transparente, focus mostra borda `cyan-500`.
- **Status de save:** Indicador de estado:
  - "Salvo ✓" — `text-muted`, icone `Check`, aparece 2s apos salvar
  - "Salvando..." — `text-secondary`, pulse sutil
  - "Alteracoes nao salvas" — `warning`, icone `AlertCircle`
  - Auto-save a cada 30s se houver alteracoes
- **Botao Render:** Primary CTA. `orange-500`, glow `orange-glow`, icone `Play`.
  - Hover: glow intensifica
  - Click: abre modal de confirmacao de render (mostra estimativa de creditos)
  - Desabilitado se grafo invalido (tooltip explica o problema)

**Visual:**
- Background: `bg-deep`
- Borda bottom: `border-subtle`
- Altura: 56px
- Padding horizontal: 16px
- Flex: space-between com items centralizados

---

## 4. Node Palette (painel esquerdo)

### Estrutura

```
┌──────────────────┐
│  🔍 Buscar node  │  ← Filtro por nome (opcional, util com muitos nodes)
│                  │
│  FONTES          │  ← Section header
│  ┌──────────────┐│
│  │ 🎬 VideoPool ││  ← Node card arrastavel
│  │ Pool de vids ││
│  └──────────────┘│
│  ┌──────────────┐│
│  │ 🎵 MusicPool ││
│  │ Pool musicas ││
│  └──────────────┘│
│  ┌──────────────┐│
│  │ 🔊 TTS      ││
│  │ Text-to-Spch ││
│  └──────────────┘│
│                  │
│  PROCESSAMENTO   │
│  ┌──────────────┐│
│  │ 🔄 Loop     ││
│  │ Loop video   ││
│  └──────────────┘│
│  ┌──────────────┐│
│  │ 📝 Subtitle  ││
│  │ Legendas     ││
│  └──────────────┘│
│                  │
│  COMPOSICAO      │
│  ┌──────────────┐│
│  │ 🗂 Layer    ││
│  │ Camadas      ││
│  └──────────────┘│
│                  │
│  OUTPUT          │
│  ┌──────────────┐│
│  │ 🎯 Render   ││
│  │ Saida final  ││
│  └──────────────┘│
│                  │
└──────────────────┘
```

**Categorias de nodes:**

| Categoria | Nodes | Cor do icone |
|---|---|---|
| **Fontes** | VideoPool, MusicPool, TTS | `cyan-500` |
| **Processamento** | Loop, Subtitle | `orange-500` |
| **Composicao** | Layer | `cyan-400` |
| **Output** | Render | `orange-400` |

**Node cards na palette:**
- Background: `bg-surface`
- Borda: `border-subtle`
- Hover: borda `border-medium`, cursor `grab`
- Dragging: `opacity: 0.5`, sombra elevada, cursor `grabbing`
- Icone: Lucide, 20px, cor da categoria
- Nome: `text-sm`, `font-medium`, `text-primary`
- Descricao: `text-xs`, `text-muted`
- Padding: `8px 12px`
- Border-radius: `0.5rem`

**Comportamento:**
- Drag-and-drop para o canvas (React Flow `onDrop`)
- Tooltip no hover com descricao completa do node e seus handles
- Section headers com `text-xs`, `text-muted`, `uppercase`, `tracking-wider`
- Palette colapsavel: clique no header da secao colapsa/expande os nodes daquela categoria

**Estado colapsado (48px):**
- Apenas icones dos nodes, sem labels
- Tooltip com nome no hover
- Botao para expandir no topo

> **21st.dev — Componente base (lista de nodes):**
> - **Sortable** — Lista drag-and-drop com items arrastáveis via handle (GripVertical), badges de tipo, icones. Usa dnd-kit. Referencia para o comportamento de drag dos node cards, embora no editor o drop target seja o canvas React Flow, nao a lista.
> - Link: https://21st.dev/sortable

---

## 5. Canvas (React Flow)

### Area central — o coracao do editor

**Background:**
- Cor: `bg-void` (o fundo mais profundo da paleta)
- Grid de pontos: dots pattern, cor `border-subtle`, spacing 20px
- Grid opcional (toggle): linhas, cor `border-subtle/50%`

**Viewport controls (canto inferior esquerdo):**
- Zoom in/out: botoes `+` / `−`
- Fit to view: botao `Maximize2` (centra e fita todos os nodes)
- Toggle grid: botao `Grid3x3`
- Zoom level: badge mostrando `75%`, `100%`, `150%`, etc.

**Minimap (canto inferior direito):**
- React Flow `<MiniMap>` customizado
- Background: `bg-surface/80%` com backdrop-blur
- Borda: `border-subtle`
- Nodes: retangulos coloridos por categoria
- Viewport indicator: borda `cyan-500`
- Tamanho: 150x100px
- Colapsavel (toggle de visibilidade)

**Interacoes:**
- **Pan:** Click + drag no background, ou scroll wheel (com Ctrl/Cmd)
- **Zoom:** Scroll wheel, ou pinch (touch)
- **Select node:** Click no node. Abre properties panel com config desse node.
- **Multi-select:** Shift + click, ou drag selection box
- **Delete node:** Selecionar + `Delete`/`Backspace`, ou context menu
- **Connect nodes:** Drag de um handle de saida para um handle de entrada
- **Disconnect:** Click na edge + `Delete`, ou drag o handle para fora
- **Context menu (right-click no canvas):** Adicionar node, colar, selecionar tudo, fit view
- **Context menu (right-click no node):** Duplicar, deletar, desconectar todas as edges

**Keyboard shortcuts:**
| Acao | Shortcut |
|---|---|
| Undo | `Ctrl/Cmd + Z` |
| Redo | `Ctrl/Cmd + Shift + Z` |
| Save | `Ctrl/Cmd + S` |
| Delete selected | `Delete` / `Backspace` |
| Select all | `Ctrl/Cmd + A` |
| Fit view | `Ctrl/Cmd + 0` |
| Zoom in | `Ctrl/Cmd + =` |
| Zoom out | `Ctrl/Cmd + -` |
| Duplicate | `Ctrl/Cmd + D` |

---

## 6. Design dos Nodes (dentro do canvas)

### Anatomia de um node

```
┌─── Cor da categoria (borda top 3px) ──────────────────────┐
│                                                           │
│  [Icone] Nome do Node                          [⋮ menu] │
│                                                           │
│  ● input_handle_1    Label              output_handle ●  │
│  ● input_handle_2    Label                              │
│                                                           │
│  [Status badge: "Configurado ✓" ou "Falta config ⚠"]    │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Visual por tipo

**VideoPool**
- Borda top: `cyan-500`
- Icone: `Film` (Lucide)
- Handles: Saida `videos` (direita)
- Badge: "{N} videos no pool" ou "Sem videos ⚠"
- Comportamento: retorna todos os assets; o Loop concatena aleatoriamente

**MusicPool**
- Borda top: `cyan-500`
- Icone: `Music` (Lucide)
- Handles: Saida `audios` (direita)
- Badge: "{N} musicas no pool" ou "Sem musicas ⚠"
- Comportamento: retorna todos os assets; o Render concatena aleatoriamente e mixa com narracao

**TTS**
- Borda top: `cyan-500`
- Icone: `Mic` (Lucide)
- Handles: Saida `audio` (direita), Saida `timestamps` (direita, abaixo)
- Badge: Provider selecionado ou "Sem provider ⚠"
- Nota: o texto da narracao e definido na hora de renderizar (per-render), nao no template

**Loop**
- Borda top: `orange-500`
- Icone: `Repeat` (Lucide)
- Handles: Entrada `videos` (esquerda), Entrada `audio` (esquerda), Saida `video` (direita)
- Badge: "Pronto" (se inputs conectados) ou "Falta input ⚠"
- Comportamento: concatena videos aleatoriamente do pool ate cobrir a duracao do audio

**Subtitle**
- Borda top: `orange-500`
- Icone: `Captions` (Lucide)
- Handles: Entrada `timestamps` (esquerda), Saida `filter` (direita)
- Badge: "{N} palavras/grupo" ou "Sem config ⚠"

**Layer**
- Borda top: `cyan-400`
- Icone: `Layers` (Lucide)
- Handles: Entrada `base` (esquerda), Entrada `overlay` (esquerda, multiplos), Saida `video` (direita)
- Badge: "{N} camadas" ou "Sem base ⚠"

**Render**
- Borda top: `orange-400`
- Icone: `Clapperboard` (Lucide)
- Handles: Entrada `video` (esquerda), Entrada `audio` (esquerda), Entrada `music` (esquerda, opcional)
- Badge: "{W}x{H} · {FPS}fps" (ex: "1080x1920 · 30fps")
- Visual especial: borda com glow `orange-glow` sutil (e o node "destino")
- Comportamento: mixa narracao + musica de fundo (volume configuravel)

### Estilo compartilhado dos nodes
- Background: `bg-surface`
- Borda: `border-subtle` (1px)
- Borda top: 3px, cor da categoria
- Border-radius: `0.75rem`
- Sombra: `0 2px 8px rgba(0,0,0,0.3)`
- Width: 200-240px (fixo por tipo)
- Padding: 12px
- **Selecionado:** borda inteira muda para cor da categoria + glow sutil
- **Hover:** borda `border-medium`
- **Erro:** borda `error` + glow `error` sutil
- **Dragging:** `opacity: 0.8`, sombra mais intensa

### Handles (portas de conexao)
- Tamanho: 12px circulo
- Cor default: `border-strong` (inativo), cor da categoria (conectado)
- Hover: scale 1.3 + glow da cor
- Conectando (drag): glow pulsante
- Posicao: inputs a esquerda, outputs a direita
- Label: `text-xs`, `text-muted`, alinhado ao handle

---

## 7. Design das Edges (conexoes)

### Visual
- Cor: gradiente da cor do handle de saida para a cor do handle de entrada
- Fallback: `border-strong` (cinza)
- Espessura: 2px (normal), 3px (hover/selecionada)
- Tipo: `smoothstep` (curva suave com angulo reto nos cantos)
- **Animacao de dados fluindo:** Dashes animados na direcao do fluxo (do output para o input)
  - `stroke-dasharray: 5 5`
  - `animation: dash 1s linear infinite` (dashes se movem na direcao do fluxo)
  - Apenas na edge selecionada ou quando o node de origem esta selecionado

### Estados
- **Normal:** cor solida, sem animacao
- **Hover:** espessura 3px, cor mais brilhante
- **Selecionada:** espessura 3px, animacao de dashes, glow sutil
- **Conectando (drag):** Linha pontilhada seguindo o cursor, cor da categoria do handle de origem
- **Invalida (tentativa de conexao incompativel):** Linha vermelha, cursor `not-allowed`

### Labels nas edges (opcional)
- Tipo de dado fluindo: "video", "audio", "timestamps", "filter"
- Background: `bg-elevated`, borda `border-subtle`, border-radius `0.25rem`
- Texto: `text-xs`, `JetBrains Mono`, `text-muted`
- Visivel apenas no hover da edge ou quando selecionada

---

## 8. Properties Panel (painel direito)

### Estrutura quando um node esta selecionado

```
┌────────────────────────────┐
│  [Icone] TTS              │  ← Header com tipo do node
│  Configuracao             │
│                            │
│  ─── PROVIDER ───         │
│                            │
│  Provider *               │
│  [Talkify            ▾]  │
│                            │
│  Voice                    │
│  [Rachel             ▾]  │
│                            │
│  ─── AJUSTES ───          │
│                            │
│  Velocidade               │
│  [──●──────────] 1.0x     │
│                            │
│  ─── INFO ───             │
│                            │
│  ℹ O texto da narracao    │
│  sera definido na hora    │
│  de renderizar.           │
│                            │
│  ─── CONEXOES ───         │
│                            │
│  Saidas:                  │
│  ● audio → Loop.audio     │
│  ● timestamps → Sub.ts    │
│                            │
│  ─── ACOES ───            │
│                            │
│  [Duplicar] [Deletar]     │
│                            │
└────────────────────────────┘
```

### Conteudo por tipo de node

**VideoPool:**
- Lista de assets selecionados (drag to reorder)
- Botao "Adicionar video" → abre modal de selecao de assets (filtrado por tipo video)
- Preview thumbnail de cada video
- Botao remover (X) em cada video

**MusicPool:**
- Lista de assets selecionados (drag to reorder)
- Botao "Adicionar musica" → abre modal de selecao de assets (filtrado por tipo audio)
- Preview: nome + duracao de cada musica
- Botao remover (X) em cada musica
- Info: "As musicas serao escolhidas aleatoriamente e concatenadas ate cobrir a duracao da narracao"

**TTS:**
- Select: Provider (talkify, custom)
- Select: Voice (lista depende do provider)
- Slider: Velocidade (0.5x - 2.0x)
- Info box: "O texto da narracao sera definido na hora de renderizar, nao no template. O template configura apenas o provider, voz e velocidade."
- Se provider = "custom": info "O usuario fara upload do audio na hora de renderizar. WhisperX fara forced alignment automaticamente."

**Loop:**
- Sem configuracoes proprias
- Mostra apenas conexoes e info: "Videos do pool serao concatenados aleatoriamente ate cobrir a duracao do audio"

**Subtitle:**
- Number input: Palavras por grupo (2-6, default 3)
- Secao Style (expandivel):
  - Select: Font family
  - Number: Font size
  - Color picker: Cor do texto
  - Color picker: Cor do stroke
  - Number: Stroke width
  - Select: Posicao (top, center, bottom)

**Layer:**
- Sem configuracoes proprias
- Mostra lista de inputs conectados com labels (base, overlay_1, overlay_2...)
- Drag to reorder overlays (define z-order)

**Render:**
- Number: Width (default 1080)
- Number: Height (default 1920)
- Number: FPS (default 30)
- Select: Format (mp4, webm)
- Slider: Volume da musica de fundo (0% - 100%, default 15%)
- Info box: "Estimativa: ~X creditos" (calculo baseado em duracao estimada)

### Visual do panel
- Background: `bg-deep`
- Borda esquerda: `border-subtle`
- Header do node: borda bottom `border-subtle`, icone + nome + cor da categoria
- Sections: separadas por linhas `border-subtle` com label `text-xs`, `text-muted`, `uppercase`
- Inputs: estilo padrao Nyx (bg-deep, border-subtle, focus cyan-500)
- Selects: Radix UI `<Select>` com dropdown dark
- Sliders: Radix UI `<Slider>`, track `bg-elevated`, thumb `cyan-500`
- Color picker: quadrado de preview + input hex + popover com picker

### Estado vazio (nenhum node selecionado)
```
┌────────────────────────────┐
│                            │
│  [icone MousePointer]      │
│                            │
│  Selecione um node         │
│  para configurar           │
│                            │
│  Dica: arraste nodes do    │
│  painel esquerdo para o    │
│  canvas                    │
│                            │
└────────────────────────────┘
```

> **21st.dev — Componente base (floating panel):**
> - **Floating Panel** (ark-ui) — Painel flutuante arrastavel e redimensionavel com header (grip, titulo, minimize, maximize, close). Util como referencia para o properties panel em modo tablet/mobile onde ele se torna um painel flutuante em vez de fixo.
> - Link: https://21st.dev/floating-panel

---

## 9. Toolbar do Canvas

### Posicao: canto inferior esquerdo do canvas, flutuante

```
┌──────────────────────────────────────────────────────────────┐
│  [−] [100%] [+]  │  [Fit] [Grid] [Snap]  │  [↩] [↪]       │
└──────────────────────────────────────────────────────────────┘
```

**Grupos de botoes:**

1. **Zoom:** `−` (zoom out), badge com % atual, `+` (zoom in)
2. **View:** Fit (Maximize2), Grid toggle (Grid3x3), Snap to grid toggle (Magnet)
3. **History:** Undo (Undo2), Redo (Redo2)

**Visual:**
- Background: `bg-surface/90%` + `backdrop-blur(8px)`
- Borda: `border-subtle`
- Border-radius: `0.75rem`
- Padding: `4px 8px`
- Sombra: sutil
- Separadores verticais: `border-subtle`, 1px, altura 24px
- Botoes: 32x32px, ghost style, icone 16px, `text-secondary`, hover `text-primary` + `bg-hover`
- Botao ativo (grid on, snap on): `bg-cyan-900/30`, icone `cyan-500`

> **21st.dev — Componente base (toolbar):**
> - **Toolbar** — Toolbar flutuante com botoes de icone, tooltips animados (motion), separadores, estados ativos. Perfeita para a toolbar do canvas.
> - Link: https://21st.dev/toolbar
> - Adaptar: trocar botoes de texto para icones Lucide do editor, agrupar em 3 secoes (zoom, view, history), aplicar glassmorphism (bg-surface/90% + backdrop-blur).
>
> - **Action Toolbar** — Toolbar com botoes de icone + dropdowns, badges, estados ativos/inativos. Alternativa com suporte nativo a dropdown menus nos botoes.
> - Link: https://21st.dev/action-toolbar

---

## 10. Barra de Validacao (bottom bar)

### Posicao: parte inferior da tela, full-width

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ✓ Grafo valido · 7 nodes · 8 edges · Est. 2 min render · ~20 creditos │
└──────────────────────────────────────────────────────────────────────────┘
```

**Estados:**

- **Valido:** Icone `CheckCircle` em `success`, mensagem em `text-secondary`
- **Warning:** Icone `AlertTriangle` em `warning`, mensagem descrevendo o problema
  - Ex: "Nenhum video no VideoPool", "Nenhuma musica no MusicPool"
- **Invalido:** Icone `XCircle` em `error`, mensagem descrevendo o erro
  - Ex: "Nenhum node Render encontrado", "Loop sem input de audio", "Ciclo detectado no grafo"

**Informacoes:**
- Contagem de nodes e edges
- Estimativa de duracao do render
- Estimativa de custo em creditos
- Tudo em `text-xs`, `JetBrains Mono`, `text-muted`

**Visual:**
- Background: `bg-deep`
- Borda top: `border-subtle`
- Altura: 36px
- Padding horizontal: 16px
- Items separados por `·` (middle dot)

---

## 11. Modal de Render

### Trigger: botao "Render" na top bar

```
┌──────────────────────────────────────────┐
│                                          │
│  🎬 Iniciar renderizacao               │
│                                          │
│  Template: Horror Reddit Stories         │
│  Nodes: 7 · Edges: 8                    │
│                                          │
│  ─── NARRACAO ───                       │
│                                          │
│  (●) Texto para TTS                     │
│  ┌────────────────────────────────┐     │
│  │ Era uma noite escura quando    │     │
│  │ o usuario do Reddit postou...  │     │
│  └────────────────────────────────┘     │
│                                          │
│  ( ) Upload de audio                    │
│  [Escolher arquivo...]                  │
│                                          │
│  ─── CUSTO ───                          │
│                                          │
│  Renderizacao:     20 creditos          │
│  TTS (ElevenLabs): 10 creditos          │
│  ─────────────────────────              │
│  Total:            30 creditos          │
│                                          │
│  Saldo atual: 847 creditos              │
│  Saldo apos:  817 creditos              │
│                                          │
│  [Cancelar]            [▶ Renderizar]   │
│                                          │
└──────────────────────────────────────────┘
```

**Comportamento:**
- Mostra breakdown de custos (render + TTS)
- Mostra saldo atual e projecao
- Se saldo insuficiente: botao desabilitado + mensagem "Creditos insuficientes" em `error` + link "Comprar creditos"
- Click "Renderizar": cria job via API, fecha modal, toast "Job criado! Acompanhe em Jobs.", redireciona para `/jobs` ou mostra notificacao no dashboard

**Visual:**
- Modal com `glass` + `backdrop-blur(16px)`
- Background: `bg-elevated`
- Borda: `border-subtle`
- Border-radius: `1rem`
- Width: `max-w-md`
- Botao "Renderizar": `orange-500`, glow, full-width
- Botao "Cancelar": ghost, `text-secondary`

> **21st.dev — Componente base (modal):**
> - **Video Modal** — Modal com overlay backdrop-blur, animacao fade-in/scale, titulo, descricao, player de video. Estrutura de modal adaptavel para o modal de confirmacao de render.
> - Link: https://21st.dev/video-modal
> - Adaptar: remover video player, adicionar breakdown de custos, botoes de acao, usar cores Nyx.

---

## 12. Templates Predefinidos (Onboarding)

### Para novos usuarios: galeria de starter templates

Quando o usuario acessa `/templates/new` pela primeira vez (ou nao tem templates), mostra:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Comece com um template pronto                                  │
│  Escolha um modelo e personalize a vontade                      │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  🎬          │  │  🎬          │  │  🎬          │          │
│  │  Reddit      │  │  Horror      │  │  Motivacional│          │
│  │  Story       │  │  Narration   │  │              │          │
│  │              │  │              │  │              │          │
│  │  VideoPool → │  │  VideoPool → │  │  VideoPool → │          │
│  │  TTS → Loop  │  │  TTS → Loop  │  │  Custom →    │          │
│  │  → Sub → ... │  │  → Sub → ... │  │  Loop → ...  │          │
│  │              │  │              │  │              │          │
│  │  [Usar]      │  │  [Usar]      │  │  [Usar]      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ──── ou ────                                                   │
│                                                                  │
│  [+ Criar do zero]                                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Cards de template:**
- Preview: miniatura do grafo (nodes simplificados + edges)
- Nome: Syne 600, `text-lg`
- Descricao: `text-sm`, `text-secondary`
- Pipeline resumido: `text-xs`, `JetBrains Mono`, `text-muted`
- Botao "Usar": ghost `cyan-500`, cria copia do template para o usuario

---

## 13. Animacoes e Interacoes

### Canvas
- **Node drop:** Node aparece com scale `0.8 → 1` + fade-in (`duration-normal`, `ease-spring`)
- **Node delete:** Fade-out + scale `1 → 0.8` (`duration-fast`)
- **Edge connect:** Linha aparece com animacao de "desenho" (stroke-dashoffset animation)
- **Edge delete:** Fade-out (`duration-fast`)
- **Node drag:** Smooth follow com `will-change: transform`
- **Zoom:** CSS transform com `transition: transform duration-fast`

### Panels
- **Palette collapse:** Width transition `duration-normal`, labels fade-out
- **Properties panel:** Conteudo faz crossfade ao trocar de node selecionado (`duration-fast`)
- **Resize handle drag:** Immediate (sem transition durante drag, transition ao soltar)

### Feedback
- **Save:** Badge "Salvo ✓" faz fade-in, permanece 2s, fade-out
- **Validacao muda:** Barra de validacao faz flash sutil na cor do novo estado
- **Conexao invalida:** Handle destino faz shake animation + flash `error`
- **Conexao valida:** Handle destino faz pulse `success` (1x)

---

## 14. Responsividade

### Breakpoints

| Breakpoint | Palette | Canvas | Properties | Toolbar |
|---|---|---|---|---|
| **≥1280px** | Expandida (220px) | Flex | Fixa (300px) | Flutuante no canvas |
| **1024-1279px** | Colapsada (48px) | Flex | Fixa (280px) | Flutuante no canvas |
| **768-1023px** | Botao flutuante (FAB) | Full | Sheet lateral | Flutuante no canvas |
| **<768px** | N/A | N/A | N/A | N/A — "Use desktop" |

### Mobile (<768px)
Exibe tela de bloqueio:
```
┌──────────────────────────┐
│                          │
│  [Icone Monitor]         │
│                          │
│  Editor nao disponivel   │
│  em dispositivos moveis  │
│                          │
│  Use um computador para  │
│  editar seus templates   │
│                          │
│  [← Voltar ao Dashboard] │
│                          │
└──────────────────────────┘
```

---

## 15. Notas Tecnicas

### Dependencias-chave
- **React Flow** (`@xyflow/react`): Engine do canvas, nodes customizados, edges, minimap, controls
- **react-resizable-panels**: Layout 3-paineis redimensionaveis
- **dnd-kit** (`@dnd-kit/core`): Drag da palette para o canvas
- **Zustand**: State do editor (nodes, edges, selected node, history)
- **Zod**: Validacao do grafo antes de submeter render

### State management (Zustand)

```typescript
interface EditorStore {
  // Graph state
  nodes: Node[];
  edges: Edge[];

  // Selection
  selectedNodeId: string | null;

  // History (undo/redo)
  past: GraphSnapshot[];
  future: GraphSnapshot[];

  // UI state
  isPalletteCollapsed: boolean;
  isGridVisible: boolean;
  isSnapEnabled: boolean;

  // Template metadata
  templateId: string | null;
  templateName: string;
  isDirty: boolean; // unsaved changes
  lastSavedAt: Date | null;

  // Actions
  addNode: (type: NodeType, position: XYPosition) => void;
  removeNode: (id: string) => void;
  updateNodeConfig: (id: string, config: Partial<NodeConfig>) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (id: string) => void;
  undo: () => void;
  redo: () => void;
  save: () => Promise<void>;
  validate: () => ValidationResult;
}
```

### Custom nodes (React Flow)
Cada tipo de node e um componente React customizado registrado no React Flow:
- `VideoPoolNode`, `MusicPoolNode`, `TTSNode`, `LoopNode`, `SubtitleNode`, `LayerNode`, `RenderNode`
- Todos estendem um `BaseNode` que fornece: header, handles, status badge, menu

### Validacao do grafo (client-side)
Antes de permitir render, valida:
1. Exatamente 1 node Render
2. Node Render tem inputs `video` e `audio` conectados
3. Sem ciclos no grafo (topological sort)
4. Todos os nodes obrigatorios estao configurados (VideoPool tem assets, MusicPool tem assets, TTS tem provider, etc.)
5. Edges conectam handles compativeis (videos→videos, audio→audio, etc.)
6. TTS nao precisa de texto configurado no template (texto e definido per-render)

### Auto-save
- Debounced: salva 30s apos ultima alteracao
- Otimista: salva diff (nao o grafo inteiro)
- Indicador visual no top bar
- `beforeunload` event mostra warning se houver alteracoes nao salvas

### Rotas (React Router v7)
- `/templates/new` — Editor vazio (ou galeria de starters se primeiro template)
- `/templates/:id/edit` — Editor com template carregado
- Guard: se template nao pertence ao usuario → 404

---

## 16. Componentes 21st.dev — Resumo

| Secao | Componente | Link | Uso |
|---|---|---|---|
| Layout (3 paineis) | Resizable | https://21st.dev/resizable | Paineis redimensionaveis com drag handles |
| Toolbar do canvas | Toolbar | https://21st.dev/toolbar | Botoes de icone com tooltips e separadores |
| Toolbar (alternativa) | Action Toolbar | https://21st.dev/action-toolbar | Toolbar com dropdowns e badges |
| Node palette (drag) | Sortable | https://21st.dev/sortable | Referencia para drag-and-drop de items |
| Properties (tablet) | Floating Panel | https://21st.dev/floating-panel | Painel flutuante arrastavel para modo tablet |
| Modal de render | Video Modal | https://21st.dev/video-modal | Estrutura de modal com backdrop-blur |

**Nota:** O canvas em si usa React Flow (`@xyflow/react`), que nao e um componente 21st.dev. React Flow fornece: canvas infinito, nodes customizados, edges, minimap, controls, selection, drag-and-drop, zoom/pan, e toda a logica de conexao entre nodes.
