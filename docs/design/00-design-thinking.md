# Nyx — Design Thinking

## 1. Identidade

| Atributo | Definição |
|----------|-----------|
| **Nome** | Nyx |
| **Tagline** | "Configure once. Produce forever." |
| **Tagline PT** | "Configure uma vez. Produza para sempre." |
| **Posicionamento** | Plataforma de automação de dark videos — de texto a vídeo publicável em minutos, com templates reutilizáveis e renderização em escala |
| **Tom de voz** | Direto, técnico-premium, confiante. Sem excesso de entusiasmo — a ferramenta fala por si |

---

## 2. Público-alvo

### Persona primária: O Produtor de Conteúdo Dark
- Criadores de YouTube que fazem vídeos de narração (Reddit stories, horror, motivação, curiosidades)
- Publicam 3-15 vídeos por semana
- Buscam escalar produção sem contratar editor
- Confortáveis com tecnologia, mas não são desenvolvedores
- Valorizam velocidade e consistência acima de personalização pixel-perfect

### Persona secundária: A Agência/Gestor de Canais
- Gerencia múltiplos canais de dark content
- Precisa de templates padronizados e batch production
- Valoriza dashboard de controle e gestão de créditos
- Busca ROI claro: tempo economizado vs custo da plataforma

---

## 3. Direção Estética: Cinematic Dark

### Conceito
A interface do Nyx é uma **sala de controle cinematográfica**. Inspiração direta em suites de edição profissional (DaVinci Resolve, Runway ML), mas com a acessibilidade de ferramentas modernas (Linear, Vercel). O usuário deve sentir que está operando uma ferramenta poderosa sem precisar de manual.

### Princípios visuais
1. **Profundidade em camadas** — Superfícies se empilham com elevação sutil (não flat, não skeuomorphic)
2. **Luz como informação** — Glow, bordas luminosas e acentos de cor guiam o olhar para o que importa
3. **Escuridão proposital** — O escuro não é decorativo, é funcional: reduz fadiga visual em sessões longas
4. **Movimento com propósito** — Animações comunicam estado (processando, completo, erro), nunca são só cosméticas

### Referências visuais
- DaVinci Resolve — Profundidade de painéis, hierarquia funcional
- Frame.io — Review interface, dark premium
- Runway ML — IA + vídeo, estética tech-cinema
- Linear — Micro-interações e polish

---

## 4. Paleta de Cores

### Conceito cromático: Teal & Orange Cinematic Grading
Inspirado na técnica de color grading mais icônica do cinema — o contraste teal/orange usado em filmes como Mad Max, Blade Runner, e praticamente todo blockbuster moderno. Ciano representa a luz da noite (Nyx), laranja representa a energia e as ações.

### Tokens

```
/* Backgrounds — do mais profundo ao mais elevado */
--nyx-bg-void:       #06060B;    /* fundo absoluto, atrás de tudo */
--nyx-bg-deep:       #0A0A12;    /* background principal */
--nyx-bg-surface:    #11111C;    /* cards, painéis */
--nyx-bg-elevated:   #1A1A28;    /* modais, popovers, dropdowns */
--nyx-bg-hover:      #222234;    /* hover states */

/* Primary — Cyan (moonlight) */
--nyx-cyan-500:      #06B6D4;    /* cor principal */
--nyx-cyan-400:      #22D3EE;    /* hover / ativo */
--nyx-cyan-300:      #67E8F9;    /* glow / destaque forte */
--nyx-cyan-600:      #0891B2;    /* pressed */
--nyx-cyan-900:      #083344;    /* bg tint sutil */
--nyx-cyan-glow:     rgba(6, 182, 212, 0.15);  /* glow ambient */

/* Accent — Orange (energy) */
--nyx-orange-500:    #F97316;    /* CTAs, ações primárias */
--nyx-orange-400:    #FB923C;    /* hover */
--nyx-orange-300:    #FDBA74;    /* destaque */
--nyx-orange-600:    #EA580C;    /* pressed */
--nyx-orange-glow:   rgba(249, 115, 22, 0.15); /* glow ambient */

/* Texto */
--nyx-text-primary:  #F1F5F9;    /* texto principal (slate-100) */
--nyx-text-secondary:#94A3B8;    /* texto secundário (slate-400) */
--nyx-text-muted:    #64748B;    /* texto terciário (slate-500) */
--nyx-text-disabled: #475569;    /* desabilitado */

/* Bordas */
--nyx-border-subtle: #1E1E2E;    /* borda padrão */
--nyx-border-medium: #2A2A3C;    /* borda com mais contraste */
--nyx-border-strong: #3D3D52;    /* borda enfática */

/* Status */
--nyx-success:       #10B981;    /* verde — done, sucesso */
--nyx-warning:       #F59E0B;    /* amarelo — processando */
--nyx-error:         #EF4444;    /* vermelho — falha */
--nyx-info:          #06B6D4;    /* cyan — informação (reusa primary) */

/* Especiais */
--nyx-glass:         rgba(17, 17, 28, 0.80);   /* glassmorphism */
--nyx-glass-border:  rgba(255, 255, 255, 0.06); /* borda de glass */
--nyx-grain-opacity: 0.03;       /* textura de grain overlay */
```

### Uso

| Contexto | Cor |
|----------|-----|
| Botão primário (CTAs) | `orange-500` com glow |
| Links e elementos interativos | `cyan-500` |
| Seleção ativa / foco | `cyan-400` com borda glow |
| Backgrounds de cards | `bg-surface` |
| Modais e overlays | `glass` + blur |
| Status de jobs (done) | `success` |
| Status de jobs (processing) | `warning` com pulse animation |
| Status de jobs (failed) | `error` |

---

## 5. Tipografia

### Sistema tipográfico

| Uso | Fonte | Peso | Por quê |
|-----|-------|------|---------|
| **Display / Headings** | **Syne** | 700-800 | Geométrica, futurista, bold. Personalidade forte sem ser decorativa. Perfeita para headings cinematográficos |
| **Body / UI** | **DM Sans** | 400-500 | Geométrica, extremamente legível em telas. Clean mas não genérica. Ótimo kerning nativo |
| **Monospace / Data** | **JetBrains Mono** | 400-500 | Para o editor de nodes, timestamps, dados numéricos, créditos. Ligaduras tipográficas distintas |

### Escala tipográfica

```
--nyx-text-xs:    0.75rem  / 1rem;     /* 12px — labels, badges */
--nyx-text-sm:    0.875rem / 1.25rem;  /* 14px — body small, captions */
--nyx-text-base:  1rem     / 1.5rem;   /* 16px — body padrão */
--nyx-text-lg:    1.125rem / 1.75rem;  /* 18px — body large */
--nyx-text-xl:    1.25rem  / 1.75rem;  /* 20px — subtítulos */
--nyx-text-2xl:   1.5rem   / 2rem;     /* 24px — títulos de seção */
--nyx-text-3xl:   1.875rem / 2.25rem;  /* 30px — headings */
--nyx-text-4xl:   2.25rem  / 2.5rem;   /* 36px — hero sub */
--nyx-text-5xl:   3rem     / 1;        /* 48px — hero */
--nyx-text-6xl:   3.75rem  / 1;        /* 60px — display */
--nyx-text-7xl:   4.5rem   / 1;        /* 72px — hero landing */
```

---

## 6. Efeitos e Texturas

### Grain overlay
Noise texture sutil sobre toda a interface. Emula a textura de película cinematográfica.
```css
.grain::after {
  content: "";
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,..."); /* noise pattern */
  opacity: var(--nyx-grain-opacity);
  pointer-events: none;
  z-index: 9999;
}
```

### Glow (light bloom)
Elementos interativos e de status emitem glow sutil — como luz vazando de uma tela de cinema.
```css
.glow-cyan {
  box-shadow: 0 0 20px var(--nyx-cyan-glow),
              0 0 60px rgba(6, 182, 212, 0.05);
}
.glow-orange {
  box-shadow: 0 0 20px var(--nyx-orange-glow),
              0 0 60px rgba(249, 115, 22, 0.05);
}
```

### Glassmorphism
Cards e modais usam backdrop-blur com background semi-transparente.
```css
.glass {
  background: var(--nyx-glass);
  backdrop-filter: blur(16px);
  border: 1px solid var(--nyx-glass-border);
}
```

### Gradients
Gradients sutis de background para criar profundidade, nunca como decoração chamativa.
```css
.gradient-radial {
  background: radial-gradient(
    ellipse at top,
    rgba(6, 182, 212, 0.08) 0%,
    transparent 60%
  );
}
```

---

## 7. Motion Design

### Princípios
1. **Enter > Exit** — Entradas são mais longas e teatrais, saídas são rápidas
2. **Stagger reveals** — Elementos aparecem em cascata com delay incremental
3. **Easing cinematográfico** — `cubic-bezier(0.16, 1, 0.3, 1)` para movimentos fluidos
4. **Glow pulses** — Status "processando" pulsa com glow suave

### Tokens de animação
```
--nyx-duration-fast:    150ms;   /* hover, toggle */
--nyx-duration-normal:  250ms;   /* transições padrão */
--nyx-duration-slow:    400ms;   /* modais, painéis */
--nyx-duration-reveal:  600ms;   /* page load reveals */

--nyx-ease-out:     cubic-bezier(0.16, 1, 0.3, 1);      /* saída suave */
--nyx-ease-in-out:  cubic-bezier(0.65, 0, 0.35, 1);     /* simétrica */
--nyx-ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);  /* bounce sutil */
```

### Padrões de animação
| Elemento | Animação |
|----------|----------|
| Page load | Fade-up staggered (50ms delay entre itens) |
| Modal open | Scale 0.95→1 + fade, backdrop blur-in |
| Card hover | Elevação sutil (translateY -2px) + borda glow |
| Job status pulse | Glow pulse infinito no ícone de status |
| Node connections (React Flow) | Animated dashes no edge ativo |
| Download ready | Flash glow no botão + badge pulse |
| Toast notifications | Slide-in lateral + auto-dismiss fade |

---

## 8. Componentes — Design Language

### Botões

| Variante | Visual |
|----------|--------|
| **Primary** | bg `orange-500`, texto branco, hover glow orange, rounded-lg |
| **Secondary** | bg `bg-elevated`, borda `border-subtle`, texto `text-primary`, hover bg-hover |
| **Ghost** | bg transparent, texto `cyan-500`, hover bg `cyan-900/30` |
| **Danger** | bg `error/10%`, texto `error`, hover bg `error/20%` |

### Cards
- Background: `bg-surface`
- Borda: `border-subtle` (1px)
- Hover: borda transiciona para `border-medium` + elevação sutil
- Border-radius: `0.75rem` (12px)
- Padding: `1.25rem` (20px)

### Inputs
- Background: `bg-deep`
- Borda: `border-subtle`
- Focus: borda `cyan-500` com glow sutil
- Texto: `text-primary`
- Placeholder: `text-muted`
- Border-radius: `0.5rem` (8px)

### Badges / Status pills
- Estilo: pill shape, bg semi-transparente da cor do status
- Done: bg `success/15%`, texto `success`
- Processing: bg `warning/15%`, texto `warning`, pulse animation
- Failed: bg `error/15%`, texto `error`
- Pending: bg `text-muted/15%`, texto `text-muted`

### Sidebar
- Background: `bg-deep`
- Borda direita: `border-subtle`
- Item ativo: bg `cyan-900/30`, borda esquerda `cyan-500` (2px)
- Item hover: bg `bg-hover`

---

## 9. Diferencial de Produto: Automação Total

### Mensagem central
> "Configure uma vez. Produza para sempre."

A promessa do Nyx é que o criador investe tempo **uma vez** montando seu template perfeito e depois produz vídeos em massa com mínimo esforço. Isso se traduz na UI como:

### Pilares de UX

1. **Template como produto** — O template é o ativo mais valioso. O editor deve fazer o usuário sentir que está construindo uma "máquina de vídeos"
2. **Um clique para render** — De template pronto a vídeo renderizado, o caminho deve ser o mais curto possível
3. **Visibilidade de progresso** — Jobs em tempo real com WebSocket. O usuário nunca fica no escuro sobre o que está acontecendo
4. **Reutilização acima de tudo** — Templates favoritos, duplicar, marketplace. O valor cresce com o tempo
5. **Controle de custos** — Créditos visíveis a todo momento, breakdown claro, sem surpresas

---

## 10. Mapa de Páginas

| # | Página | Propósito | Prioridade |
|---|--------|-----------|------------|
| 1 | **Landing Page** | Conversão — atrair, explicar, converter visitante em usuário | P0 |
| 2 | **Auth (Login/Register)** | Entrada — email/password + Discord/Google OAuth | P0 |
| 3 | **Dashboard** | Hub central — visão geral de jobs recentes, créditos, atalhos | P0 |
| 4 | **Template Editor** | Core product — editor visual de nodes com React Flow | P0 |
| 5 | **Assets Library** | Gestão — upload, organizar, deletar vídeos/áudios/textos | P0 |
| 6 | **Jobs** | Monitoramento — lista de renders, status real-time, download | P0 |
| 7 | **Credits** | Billing — saldo, histórico, breakdown, compra de créditos | P1 |
| 8 | **Marketplace** | Crescimento — templates públicos da comunidade | P1 |
| 9 | **Settings** | Conta — perfil, preferências, API keys, danger zone | P2 |

---

## 11. Stack Frontend

| Camada | Tecnologia |
|--------|-----------|
| Framework | React 19 (Vite) |
| Routing | React Router v7 |
| State | Zustand (leve, sem boilerplate) |
| Node Editor | React Flow |
| Styling | Tailwind CSS v4 |
| Animações | Motion (framer-motion) |
| Forms | React Hook Form + Zod |
| HTTP Client | ky ou fetch nativo |
| WebSocket | Native WebSocket API |
| Icons | Lucide React |
| Toasts | Sonner |
| Componentes base | Radix UI (headless) + Tailwind |
