# Nyx — Landing Page

> Objetivo: Converter visitante em usuario registrado.
> Rota: `/`
> Auth: Nao requer

---

## 1. Estrategia de Conversao

### Framework: AIDA (Attention → Interest → Desire → Action)

| Fase | Secao da pagina | Gatilho psicologico |
|------|----------------|---------------------|
| **Attention** | Hero | Headline impactante + visual do editor em acao |
| **Interest** | Problema + Como Funciona | Identificacao com a dor + solucao clara em 3 passos |
| **Desire** | Features + Demo + Social Proof | Prova de capacidade + validacao social |
| **Action** | CTA final + Pricing preview | Urgencia + transparencia de custo |

### Metricas-alvo
- **Primary CTA**: "Teste agora" → registro (10 creditos gratis = 1 video de 30s)
- **Secondary CTA**: "Ver demo" → scroll para secao demo
- **Tempo medio na pagina**: >45s (indica leitura real)
- **Scroll depth**: >70% (indica interesse)

---

## 2. Secoes da Pagina

### Navegacao (Header fixo)

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo Nyx]     Features   Pricing   Docs       [Login] [CTA]  │
└─────────────────────────────────────────────────────────────────┘
```

**Comportamento:**
- Fixo no topo com `backdrop-filter: blur(16px)` + `bg-void/80%`
- Logo: wordmark "Nyx" em Syne 700, tracking wide
- Links: DM Sans 400, `text-secondary`, hover `text-primary`
- Login: botao ghost `cyan-500`
- CTA: botao primary `orange-500` com texto "Teste agora"
- On scroll: borda bottom `border-subtle` aparece com fade (indica separacao)
- Mobile: hamburger menu com slide-in lateral (glass panel)

> **21st.dev — Componente base:**
> - **Floating Header** — Header sticky com backdrop-blur, glassmorphism, rounded border, mobile sheet menu. Adaptar cores para paleta Nyx (bg-void/80%, border-subtle) e trocar links/logo.
> - Link: https://21st.dev/ibelick/floating-header

---

### S1 — Hero

**Layout:** Full viewport height. Conteudo centralizado com visual a direita (desktop) ou abaixo (mobile).

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              ┌─────────────────┐  ┌───────────────────────┐     │
│              │                 │  │                       │     │
│  [badge]     │   HEADLINE      │  │   Visual do Editor    │     │
│              │   em 2 linhas   │  │   (React Flow nodes   │     │
│              │                 │  │    conectados com      │     │
│              │   Subheadline   │  │    animacao de dados   │     │
│              │   em 2 linhas   │  │    fluindo pelas       │     │
│              │                 │  │    edges)              │     │
│              │  [CTA] [Demo]   │  │                       │     │
│              │                 │  │                       │     │
│              └─────────────────┘  └───────────────────────┘     │
│                                                                 │
│         ── trust bar: "X videos renderizados" ──                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Copy:**

- **Badge** (pill acima do headline):
  - Texto: "Automacao de Dark Videos"
  - Estilo: pill com bg `cyan-900/30`, borda `cyan-500/30`, texto `cyan-400`, text-sm

- **Headline** (Syne 800, `text-7xl` desktop / `text-4xl` mobile):
  ```
  Configure uma vez.
  Produza para sempre.
  ```
  - "Configure uma vez." em `text-primary`
  - "Produza para sempre." em gradiente `cyan-400 → orange-400`

- **Subheadline** (DM Sans 400, `text-xl`, `text-secondary`, max-w-lg):
  ```
  Transforme texto em videos dark prontos para o YouTube.
  Templates visuais, TTS automatico, legendas karaoke —
  tudo renderizado em minutos.
  ```

- **CTA primario**:
  - Texto: "Teste agora"
  - Estilo: `orange-500`, px-8 py-3, text-lg, rounded-xl
  - Hover: glow orange + scale 1.02
  - Icone: seta → a direita

- **CTA secundario**:
  - Texto: "Ver como funciona"
  - Estilo: ghost, `cyan-500`, underline offset
  - Acao: smooth scroll para secao "Como funciona"

**Visual do Editor (lado direito):**
- Screenshot estilizado ou componente interativo mostrando o editor de nodes
- Nodes conectados: VideoPool → Loop → Layer → Render
- Edges animadas com dashes fluindo (simulando dados sendo processados)
- Glow sutil nos nodes ativos
- Perspectiva leve (rotateY -3deg, rotateX 2deg) para profundidade
- Sombra dramatica: `0 25px 80px rgba(0,0,0,0.6)`
- Borda `border-subtle` com glow `cyan-glow` nas extremidades

**Trust Bar (abaixo do hero):**
```
┌─────────────────────────────────────────────────────────────────┐
│   ▶ 12,847 videos    ⚡ 2,340 criadores    ⏱ 3min tempo medio  │
└─────────────────────────────────────────────────────────────────┘
```
- Estilo: borda top e bottom `border-subtle`, bg `bg-deep`
- Numeros em Syne 700 `text-primary`, labels em DM Sans `text-muted`
- Icones em `cyan-500`
- Animacao: numeros fazem count-up quando entram na viewport

**Animacoes de entrada (staggered reveal):**
1. Badge — fade up (0ms)
2. Headline linha 1 — fade up (100ms)
3. Headline linha 2 — fade up (200ms)
4. Subheadline — fade up (300ms)
5. CTAs — fade up (400ms)
6. Visual do editor — fade in + slide left (500ms)
7. Trust bar — fade up (800ms)

**Background:**
- Gradient radial sutil: `radial-gradient(ellipse at 30% 20%, rgba(6, 182, 212, 0.06) 0%, transparent 50%)`
- Segundo gradient: `radial-gradient(ellipse at 70% 80%, rgba(249, 115, 22, 0.04) 0%, transparent 50%)`
- Grid pattern sutil (linhas `border-subtle/20%`) para textura de "blueprint"

> **21st.dev — Componentes base:**
> - **Hero** por ibelick — Estrutura com eyebrow badge, titulo com gradient text, subtitulo, CTA button, grid background com mask radial, e animacoes fade-in staggered. Usar como base para o layout esquerdo do hero, adaptando cores para paleta Nyx (cyan/orange gradients, bg-void).
> - Link: https://21st.dev/ibelick/hero
> - **Hero with bg video** por Cruiser0002 — Variante com background video em loop + overlay escuro + headline animada com word cycling. Referencia para o efeito de profundidade com video/screenshot do editor atras.
> - Link: https://21st.dev/Cruiser0002/hero-with-bg-video
> - **Sliding Number** por barvframer — Componente de numeros animados com spring physics (digitos rolam individualmente). Perfeito para o count-up da Trust Bar (12,847 videos, 2,340 criadores, etc).
> - Link: https://21st.dev/barvframer/sliding-number

---

### S2 — Problema (Pain Points)

**Proposito:** Criar identificacao. O visitante deve pensar "e exatamente isso que eu passo".

**Layout:** 3 cards lado a lado (desktop), empilhados (mobile).

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│       Criar dark videos manualmente e insustentavel.            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ ⏰            │  │ 🔄            │  │ 📉            │          │
│  │ Horas por     │  │ Mesmo         │  │ Escalar =     │          │
│  │ video         │  │ processo,     │  │ contratar     │          │
│  │               │  │ toda vez      │  │               │          │
│  │ Editar, sin-  │  │ Download do   │  │ Cada video    │          │
│  │ cronizar,     │  │ post, TTS,    │  │ extra e mais  │          │
│  │ exportar...   │  │ legenda,      │  │ horas ou mais │          │
│  │ repeat.       │  │ render...     │  │ um editor.    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Copy:**

- **Headline** (Syne 700, `text-3xl`, centrado):
  ```
  Criar dark videos manualmente é insustentável.
  ```
  - "insustentavel" em `error` (vermelho) para enfase emocional

- **Card 1 — Tempo**:
  - Icone: Clock (Lucide), `orange-500`
  - Titulo: "Horas por video" (Syne 600, `text-xl`)
  - Descricao: "Editar audio, sincronizar legendas, exportar... Um video de 10 minutos consome 2-4 horas do seu dia." (DM Sans 400, `text-secondary`)

- **Card 2 — Repeticao**:
  - Icone: RefreshCw (Lucide), `orange-500`
  - Titulo: "Mesmo processo, toda vez"
  - Descricao: "Download do post, gerar TTS, criar legenda, renderizar. Os mesmos 15 passos manuais — pra cada video."

- **Card 3 — Escala**:
  - Icone: TrendingDown (Lucide), `orange-500`
  - Titulo: "Escalar = contratar"
  - Descricao: "Quer postar mais? Cada video extra significa mais horas ou mais um editor no payroll."

**Estilo dos cards:**
- bg `bg-surface`, borda `border-subtle`
- Hover: borda `border-medium`, translateY -2px
- Icone em circle bg `orange-500/10%`, padding 12px
- Corner radius: 12px

**Animacao:** Cards fazem staggered fade-up ao entrar na viewport (IntersectionObserver).

> **21st.dev — Componente base:**
> - **Dark Grid** por jasongerard — Grid de cards escuros com icone em square + titulo + descricao. Inclui glow hover sutil (gradient overlay), borda zinc-800, e corner squares decorativos no hover. Adaptar para 1x3 grid, trocar icones/cores para orange-500, usar bg-surface/border-subtle da paleta Nyx.
> - Link: https://21st.dev/jasongerard/dark-grid

---

### S3 — Como Funciona (3 Steps)

**Proposito:** Simplificar o produto em 3 passos mentais. Reduzir complexidade percebida.

**Layout:** Horizontal com linha conectora (desktop), vertical timeline (mobile).

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              Como o Nyx transforma texto em video               │
│                                                                 │
│     ┌─────┐ ─ ─ ─ ─ ─ ┌─────┐ ─ ─ ─ ─ ─ ┌─────┐             │
│     │  1  │             │  2  │             │  3  │             │
│     └─────┘             └─────┘             └─────┘             │
│   Monte seu           Insira o texto      Clique render         │
│   template             e assets            e baixe              │
│                                                                 │
│   "Arraste nodes       "Cole o texto do    "Um clique. O Nyx    │
│    e conecte seu        Reddit, escolha     renderiza, gera      │
│    pipeline de          a voz, e o Nyx      legenda karaoke,     │
│    video visual-        cuida do TTS e      e entrega o MP4      │
│    mente."              das legendas."      pronto."             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Copy:**

- **Headline** (Syne 700, `text-3xl`, centrado):
  ```
  Como o Nyx transforma texto em video
  ```

- **Step 1 — Monte seu template**
  - Numero: circle com `cyan-500` bg, Syne 800
  - Titulo: "Monte seu template" (Syne 600)
  - Descricao: "Arraste nodes e conecte seu pipeline de video visualmente. VideoPool, TTS, Legendas, Layer — tudo plug & play."

- **Step 2 — Insira o conteudo**
  - Titulo: "Insira o conteudo"
  - Descricao: "Cole o texto do Reddit, escolha a voz do TTS, e o Nyx cuida da narracao e da sincronizacao de legendas."

- **Step 3 — Renderize e baixe**
  - Titulo: "Renderize e baixe"
  - Descricao: "Um clique. O Nyx renderiza em background, gera legenda karaoke, e entrega o MP4 pronto para upload."

**Linha conectora:**
- Linha tracejada horizontal `border-subtle` conectando os 3 circles
- Animacao: dashes se movem da esquerda para direita (como dados fluindo)
- Quando cada step entra na viewport, o circle faz scale-up + glow `cyan`

> **21st.dev — Componentes base:**
> - **Feature Section** (FeatureSteps) por DarkInventor — Steps numerados com auto-play, progress indicator circular, imagem que troca por step com animacao slide-up/down. Adaptar para layout horizontal 3 colunas (desktop) com screenshots do editor em cada step. Usar cyan-500 para circles ativos.
> - Link: https://21st.dev/DarkInventor/feature-section
> - **How It Works** por MihailGedworworworworworz — Secao 3-step com numbered circles conectados por linha horizontal, cards com icone + titulo + descricao + bullet list. Estrutura mais proxima do wireframe. Adaptar cores e simplificar bullets.
> - Link: https://21st.dev/MihailGedworworworworworz/how-it-works

---

### S4 — Features Grid

**Proposito:** Mostrar profundidade do produto. Cada feature e uma razao para ficar.

**Layout:** Grid 2x3 (desktop), empilhado (mobile).

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│             Tudo que você precisa e ainda mais.                 │
│                                                                 │
│  ┌───────────────────────┐  ┌───────────────────────┐          │
│  │ ◆ Editor Visual       │  │ ◆ TTS Automatico      │          │
│  │   de Nodes            │  │   Multi-provider      │          │
│  │                       │  │                       │          │
│  │   Drag & drop.        │  │   Play.ht, ElevenLabs │          │
│  │   Conecte VideoPool,  │  │   ou seu proprio      │          │
│  │   TTS, Subtitle,      │  │   audio. Timestamps   │          │
│  │   Layer e Render.     │  │   word-level.          │          │
│  └───────────────────────┘  └───────────────────────┘          │
│  ┌───────────────────────┐  ┌───────────────────────┐          │
│  │ ◆ Legendas Karaoke   │  │ ◆ Status em Tempo     │          │
│  │                       │  │   Real                │          │
│  │   3-4 palavras por    │  │                       │          │
│  │   grupo, estilo       │  │   WebSocket. Veja o   │          │
│  │   customizavel,       │  │   progresso do render │          │
│  │   sincronizado.       │  │   ao vivo no dash.    │          │
│  └───────────────────────┘  └───────────────────────┘          │
│  ┌───────────────────────┐  ┌───────────────────────┐          │
│  │ ◆ Templates           │  │ ◆ Creditos            │          │
│  │   Reutilizaveis       │  │   Transparentes       │          │
│  │                       │  │                       │          │
│  │   Crie uma vez, use   │  │   Pague por minuto    │          │
│  │   infinitas vezes.    │  │   de video. Sem       │          │
│  │   Marketplace em      │  │   mensalidade fixa.   │          │
│  │   breve.              │  │   Sem surpresas.      │          │
│  └───────────────────────┘  └───────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Copy do headline** (Syne 700, `text-3xl`, centrado):
```
Tudo que voce precisa. Nada que nao.
```

**Features:**

| Feature | Icone (Lucide) | Titulo | Descricao |
|---------|---------------|--------|-----------|
| Editor | Workflow | Editor Visual de Nodes | Drag & drop. Conecte VideoPool, TTS, Subtitle, Layer e Render em um pipeline visual. Sem codigo. |
| TTS | AudioLines | TTS Automatico Multi-provider | Play.ht, ElevenLabs ou seu proprio audio. Timestamps word-level automaticos via WhisperX. |
| Legendas | Captions | Legendas Karaoke | 3-4 palavras por grupo, estilo customizavel (fonte, cor, posicao), perfeitamente sincronizadas. |
| Realtime | Radio | Status em Tempo Real | WebSocket integrado. Acompanhe o progresso de cada render ao vivo direto do dashboard. |
| Templates | Copy | Templates Reutilizaveis | Crie uma vez, produza infinitas vezes. Duplique, edite, compartilhe. Marketplace em breve. |
| Creditos | Coins | Creditos Transparentes | Pague por minuto de video renderizado. Sem mensalidade fixa. Breakdown detalhado de gastos. |

**Estilo dos cards:**
- bg `bg-surface`, borda `border-subtle`, padding 24px
- Icone: `cyan-500`, tamanho 24px, dentro de square bg `cyan-900/20`, rounded-lg
- Titulo: Syne 600, `text-lg`, `text-primary`
- Descricao: DM Sans 400, `text-sm`, `text-secondary`
- Hover: borda `cyan-500/30`, bg glow `cyan-glow` sutil

**Animacao:** Grid items fazem staggered fade-up, 2 por vez (mesmo timing para cada row).

> **21st.dev — Componentes base:**
> - **Dark Grid** por jasongerard — Mesmo componente da S2, mas aqui usado em grid 2x3. Cards escuros com icone em rounded square + titulo + descricao, glow gradient no hover, corner highlights. Perfeito para o features grid. Adaptar: icone `cyan-500` em square `cyan-900/20`, hover com `cyan-glow`.
> - Link: https://21st.dev/jasongerard/dark-grid
> - **Features 10** por tailus — Grid 2 colunas com cards que tem icone, titulo, descricao e imagem opcional. Decoradores de canto (border-primary). Alternativa com layout mais assimetrico se quiser variar tamanhos de cards.
> - Link: https://21st.dev/tailus/features-10

---

### S5 — Demo Visual

**Proposito:** Prova tangivel. Mostrar o produto real, nao so descrever.

**Layout:** Secao de largura total com screenshot/video centralizado.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              Veja o Nyx em acao                                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │           [Screenshot / Video do Editor]                │    │
│  │                                                         │    │
│  │    Mostrando o flow completo:                           │    │
│  │    1. Montando nodes no editor                          │    │
│  │    2. Configurando TTS                                  │    │
│  │    3. Clicando render                                   │    │
│  │    4. Video pronto no dashboard                         │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│              [CTA: Teste gratis agora]                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Copy:**
- **Headline** (Syne 700, `text-3xl`): "Veja o Nyx em acao"
- **Subheadline** (DM Sans 400, `text-lg`, `text-secondary`): "De texto bruto a video pronto em minutos — nao em horas."

**Visual:**
- Container com borda `border-subtle`, rounded-2xl
- Glow dramatico: `box-shadow: 0 0 80px rgba(6, 182, 212, 0.08), 0 25px 60px rgba(0,0,0,0.5)`
- Opcao A: Video looping (15-30s) mostrando o editor em uso
- Opcao B: Screenshot estatico com hotspots interativos (hover mostra tooltip)
- Opcao C (MVP): GIF animado do fluxo completo

**Perspectiva:**
- Leve tilt 3D: `perspective(1200px) rotateX(2deg)`
- Reflexo sutil abaixo (gradient mask)

**CTA abaixo do demo:**
- Botao `orange-500`, "Teste gratis agora →"
- Texto auxiliar abaixo: "Sem cartao de credito" em `text-muted`, text-sm

> **21st.dev — Componente base:**
> - **Hero Section** por RubenGrez — Secao com imagem/video centralizado, overlay escuro, container com perspective transform, staggered reveal. Reutilizar a estrutura de imagem com perspective e adaptar para o screenshot/video do editor com borda glow cyan. Nao usar como hero — usar somente o container visual com tilt 3D.
> - Link: https://21st.dev/RubenGrez/hero-section-4
> - **Hero with bg video** por Cruiser0002 — Referencia para o video em loop com overlay. Extrair o pattern de `<video autoPlay loop muted playsInline>` com overlay gradient.
> - Link: https://21st.dev/Cruiser0002/hero-with-bg-video

---

### S6 — Social Proof

**Proposito:** Validacao social. Reduzir incerteza.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│          Criadores que automatizaram com Nyx                    │
│                                                                 │
│  ┌───────────────────┐  ┌───────────────────┐                  │
│  │ "Eu postava 3     │  │ "Meu canal saiu   │                  │
│  │  videos por        │  │  de 2k pra 45k    │                  │
│  │  semana. Agora     │  │  inscritos em 4   │                  │
│  │  posto 12."        │  │  meses com Nyx."  │                  │
│  │                   │  │                   │                  │
│  │  — @darkstories   │  │  — @redditreads   │                  │
│  │    142k subs      │  │    45k subs       │                  │
│  └───────────────────┘  └───────────────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Nota de implementacao:** Essa secao e placeholder para dados reais quando houver usuarios. No MVP, pode ser substituida por uma secao de "Early access" ou removida temporariamente.

**Estilo dos testimonial cards:**
- bg `bg-surface`, borda `border-subtle`
- Quote em DM Sans 500, `text-lg`, `text-primary`, italic
- Nome em Syne 600, `text-sm`, `cyan-500`
- Stats em `text-muted`, text-xs
- Aspas decorativas: `"` em Syne 800, `text-6xl`, `cyan-500/20%`, posicao absolute top-left

> **21st.dev — Componentes base:**
> - **Testimonials** por tailus — Grid masonry de testimonial cards (2+4 layout com featured card maior). Cards com avatar, nome, cargo, blockquote. Adaptar para dark theme com bg-surface, aspas decorativas em cyan-500/20%, e layout 2 colunas.
> - Link: https://21st.dev/tailus/testimonials
> - **Animated Review Card** por NiravJoshi33 — Cards de review empilhados com drag/click para rotacionar. Inclui tema "elegant" (dark zinc) e border beam animado. Alternativa interativa e mais engajante para poucos testimonials (2-3 no MVP).
> - Link: https://21st.dev/NiravJoshi33/animated-review-card

---

### S7 — Pricing Preview

**Proposito:** Transparencia. Mostrar que o modelo de creditos e justo e previsivel.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│     Preco justo. Pague pelo que usar.                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │   Modelo de creditos                                    │    │
│  │                                                         │    │
│  │   Renderizacao    10 creditos / min de video            │    │
│  │   TTS externo      5 creditos / min de audio            │    │
│  │   TTS custom       0 creditos (so renderizacao)         │    │
│  │                                                         │    │
│  │   ┌─────────────────────────────────┐                   │    │
│  │   │ Exemplo: video de 8 min         │                   │    │
│  │   │ = 80 creditos render            │                   │    │
│  │   │ + 40 creditos TTS               │                   │    │
│  │   │ = 120 creditos total            │                   │    │
│  │   └─────────────────────────────────┘                   │    │
│  │                                                         │    │
│  │   [Teste agora — 10 creditos gratis]                     │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Copy:**
- **Headline** (Syne 700, `text-3xl`): "Preco justo. Pague pelo que usar."
- **Subheadline**: "Sem planos mensais. Sem lock-in. Compre creditos e use quando quiser."

**Tabela de precos:**
- Estilo de lista, nao tabela formal
- Cada item: icone + descricao + valor em `cyan-500` (JetBrains Mono 500)
- Separador: linha `border-subtle`

**Exemplo calculado:**
- Card especial com bg `cyan-900/10`, borda `cyan-500/20`
- Numeros em JetBrains Mono
- Total destacado em Syne 700, `orange-500`

**CTA:**
- "Teste agora — 10 creditos gratis →"
- Botao `orange-500`, centralizado
- Texto auxiliar: "Suficiente para seu primeiro video de 30s. Sem cartao de credito." em `text-muted`

> **21st.dev — Componente base:**
> - **Dark Gradient Pricing** por mehdibha — Card de pricing com gradiente dark (zinc-950 → zinc-900), borda zinc-700, blur-in animation, checklist de beneficios. Usar como base para o card unico de creditos. Adaptar: remover tiers (e um unico card de creditos, nao 3 planos), adicionar a tabela de custos e o bloco de exemplo calculado dentro do card.
> - Link: https://21st.dev/mehdibha/dark-gradient-pricing

---

### S8 — CTA Final

**Proposito:** Ultimo push de conversao. Para quem scrollou ate aqui, o interesse e alto.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │        Pare de editar. Comece a escalar.                │    │
│  │                                                         │    │
│  │    Crie sua conta gratuita e renderize seu              │    │
│  │    primeiro video em menos de 10 minutos.               │    │
│  │                                                         │    │
│  │              [Criar conta gratis]                        │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Copy:**
- **Headline** (Syne 800, `text-4xl`):
  ```
  Pare de editar. Comece a escalar.
  ```
  - "escalar" em gradiente `cyan → orange`

- **Subheadline** (DM Sans 400, `text-lg`, `text-secondary`):
  ```
  10 creditos gratis na conta. Seu primeiro video renderizado em menos de 10 minutos.
  ```

**Estilo da secao:**
- Card grande centralizado, bg `bg-surface`
- Borda `border-subtle` com glow `cyan-glow` ambient
- Background interno: gradient radial `cyan-900/5%` para dar calor
- CTA: botao `orange-500` grande (px-10 py-4, text-xl), texto "Teste agora →"

**Gatilhos psicologicos:**
- Contraste "editar vs escalar" (perda vs ganho)
- Especificidade temporal: "menos de 10 minutos" (reduz incerteza)
- Free trial controlado: 10 creditos = 1 video curto (prova valor sem sangrar caixa)

> **21st.dev — Componentes base:**
> - **CTA with Glow** por launch-ui — CTA centralizado com titulo bold, botao, e efeito de glow radial animado abaixo que se move no hover. Adaptar: usar cyan-glow como cor do radial, orange-500 no botao, bg-surface como card.
> - Link: https://21st.dev/launch-ui/cta-with-glow
> - **CTA with Rectangle** por launch-ui — CTA com badge, titulo, descricao, botao, e glow ambient. Inclui fade-in-up animations staggered. Alternativa mais estruturada se quiser badge + descricao alem do headline.
> - Link: https://21st.dev/launch-ui/cta-with-rectangle
> - **CTA 3** por Jeeva-UI — CTA com bordas decorativas (plus icons nos cantos) e linha tracejada central. Estetica mais "blueprint/technical" que combina com o tom do Nyx.
> - Link: https://21st.dev/Jeeva-UI/cta-3

---

### S9 — Footer

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Nyx                    Produto          Legal      Social      │
│  Configure once.        Features         Termos     Twitter     │
│  Produce forever.       Pricing          Privacidade Discord    │
│                         Docs             Cookies    GitHub      │
│                         Changelog                               │
│                                                                 │
│  ──────────────────────────────────────────────────────────     │
│  © 2026 Nyx. Todos os direitos reservados.                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Estilo:**
- bg `bg-void`, borda top `border-subtle`
- Logo "Nyx" em Syne 700, `text-primary`
- Tagline em DM Sans 400, `text-muted`
- Links em `text-secondary`, hover `text-primary`
- Colunas: grid 4 colunas (desktop), 2 colunas (tablet), stack (mobile)
- Copyright: `text-muted`, text-sm, centrado

> **21st.dev — Componente base:**
> - **Large Name Footer** por arihantcodes — Footer com logo + descricao a esquerda, grid de colunas de links a direita (Pages, Socials, Legal), copyright no rodape, e brand name gigante (gradient clip-text) centralizado. Adaptar: usar "NYX" como large name em gradient cyan→orange, remover brand name gigante se preferir minimalismo, manter grid de colunas.
> - Link: https://21st.dev/arihantcodes/large-name-footer

---

## 3. Responsividade

| Breakpoint | Comportamento |
|-----------|---------------|
| **Desktop** (≥1280px) | Layout completo, hero side-by-side, grids 2-3 colunas |
| **Tablet** (768-1279px) | Hero empilhado, grids 2 colunas, sidebar collapse |
| **Mobile** (< 768px) | Tudo empilhado, hamburger nav, CTAs full-width, text sizes reduzidos 1 step |

### Mobile-specific
- Hero visual: abaixo do texto, menor (max-height 300px)
- Feature cards: 1 coluna, full width
- Trust bar: 1 metrica por linha ou horizontal scroll
- CTAs: full width, sticky bottom bar no mobile (last CTA)
- Font scale: headlines 2 steps menores, body mantem

---

## 4. Performance

- **LCP target**: <2.5s — hero headline e text (nao imagem)
- **CLS target**: 0 — reservar espaco para imagens/videos com aspect-ratio
- **Fonts**: preload Syne 700-800 e DM Sans 400-500
- **Images**: WebP/AVIF com fallback, lazy load abaixo do fold
- **Animations**: `will-change: transform, opacity` nos elementos animados
- **Demo video**: lazy load, poster image enquanto nao carrega

---

## 5. SEO & Meta

```html
<title>Nyx — Automacao de Dark Videos para YouTube</title>
<meta name="description" content="Transforme texto em dark videos prontos para o YouTube. Editor visual de nodes, TTS automatico, legendas karaoke. Configure uma vez, produza para sempre." />

<!-- Open Graph -->
<meta property="og:title" content="Nyx — Configure once. Produce forever." />
<meta property="og:description" content="Automacao de dark videos: de texto a video publicavel em minutos." />
<meta property="og:image" content="/og-image.png" /> <!-- 1200x630, screenshot do editor -->
<meta property="og:type" content="website" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Nyx — Automacao de Dark Videos" />
```

---

## 6. Tecnicas de Marketing Aplicadas

| Tecnica | Onde | Como |
|---------|------|------|
| **Anchoring** | Pricing | Mostrar o calculo explicito reduz incerteza sobre custo |
| **Social Proof** | Trust bar + testimonials | Numeros e depoimentos validam a decisao |
| **Loss Aversion** | CTA final | "Pare de editar" (dor atual) vs "Comece a escalar" (ganho) |
| **Specificity** | Subheadlines | "menos de 10 minutos", "3-4 palavras por grupo" — dados concretos geram confianca |
| **Progressive Disclosure** | Scroll flow | Cada secao revela mais profundidade, mantendo engajamento |
| **Friction Reduction** | CTAs | "Sem cartao de credito", "gratis" — remove objecoes antes que aparecam |
| **Authority** | Features tecnicas | Mencionar FFmpeg, WhisperX, WebSocket posiciona como ferramenta seria |
| **Reciprocity + Taste** | Free credits | 10 creditos gratis (1 video de 30s) — o suficiente para provar o valor, pouco o bastante para querer mais |

---

## 7. Resumo de Componentes 21st.dev

| Secao | Componente | Autor | Uso |
|-------|-----------|-------|-----|
| Header | Floating Header | ibelick | Navbar sticky com glassmorphism |
| Hero | Hero | ibelick | Layout com badge, gradient text, grid bg |
| Hero | Hero with bg video | Cruiser0002 | Background video/visual animado |
| Trust Bar | Sliding Number | barvframer | Count-up animado dos numeros |
| Pain Points | Dark Grid | jasongerard | Cards escuros com glow hover |
| Como Funciona | Feature Section | DarkInventor | Steps com auto-play e imagens |
| Como Funciona | How It Works | MihailGedworworworworworz | Steps numerados com linha conectora |
| Features | Dark Grid | jasongerard | Grid 2x3 de feature cards |
| Features | Features 10 | tailus | Grid assimetrico alternativo |
| Demo | Hero Section | RubenGrez | Container com perspective 3D |
| Social Proof | Testimonials | tailus | Grid de testimonial cards |
| Social Proof | Animated Review Card | NiravJoshi33 | Cards empilhados interativos |
| Pricing | Dark Gradient Pricing | mehdibha | Card dark com gradient e blur |
| CTA Final | CTA with Glow | launch-ui | CTA com glow radial animado |
| CTA Final | CTA with Rectangle | launch-ui | CTA com badge e glow |
| CTA Final | CTA 3 | Jeeva-UI | CTA com decoradores "blueprint" |
| Footer | Large Name Footer | arihantcodes | Footer com colunas e brand name |
