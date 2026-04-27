# Nyx — Credits

> Objetivo: Pagina de gestao financeira — o usuario ve seu saldo de creditos, historico de transacoes, breakdown de gastos por mes, e pode comprar pacotes de creditos.
> Rota: `/credits`
> Auth: Requer autenticacao

---

## 1. Estrategia

### Principios
- **Transparencia total** — O usuario sabe exatamente quanto gastou, em que, e quando. Sem custos escondidos.
- **Saldo sempre visivel** — O saldo atual e o elemento mais proeminente da pagina. Qualquer debito/credito e imediatamente refletido.
- **Compra sem friccao** — Pacotes claros com preco unico. Um click para comprar, sem formularios complexos.
- **Historico auditavel** — Cada transacao lista motivo (render, tts, purchase), job associado, e timestamp.

### Metricas-alvo
- **Balance visibility**: saldo carrega em <500ms
- **Purchase conversion**: >60% dos usuarios que visitam a pagina compram creditos
- **Churn prevention**: alerta de saldo baixo antes de renderizar (no Template Editor)

---

## 2. Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Sidebar  │                        Credits                                  │
│           │─────────────────────────────────────────────────────────────────│
│  ≡ Dash   │                                                                 │
│  ≡ Templ  │  ┌─────────────────────────────────────────────────────────┐   │
│  ≡ Assets │  │          Seu saldo                                      │   │
│  ≡ Jobs   │  │                                                         │   │
│  ≡ Credit │  │          847 creditos                                   │   │
│  ≡ Market │  │                                                         │   │
│           │  │  Este mes: -320 cr (render) · -80 cr (tts)              │   │
│           │  │                                      [+ Comprar]        │   │
│           │  └─────────────────────────────────────────────────────────┘   │
│           │                                                                 │
│           │  ─── PACOTES ───                                               │
│           │                                                                 │
│           │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│           │  │ Starter  │  │ Creator  │  │ Pro      │  │ Studio   │      │
│           │  │ 100 cr   │  │ 500 cr   │  │ 1500 cr  │  │ 5000 cr  │      │
│           │  │ R$ 19    │  │ R$ 79    │  │ R$ 199   │  │ R$ 499   │      │
│           │  │ [Comprar]│  │ [Comprar]│  │ [Comprar]│  │ [Comprar]│      │
│           │  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│           │                                                                 │
│           │  ─── HISTORICO ───                                             │
│           │                                                                 │
│           │  [Todos ▾]  [Render ▾]  [De: ___] [Ate: ___]                  │
│           │                                                                 │
│           │  ┌──────────────────────────────────────────────────────┐      │
│           │  │ Data        │ Tipo     │ Descricao      │ Creditos  │      │
│           │  ├─────────────┼──────────┼────────────────┼───────────┤      │
│           │  │ 01/03 14:30 │ Render   │ Job #c00..088  │ -30 cr    │      │
│           │  │ 01/03 10:15 │ TTS      │ Job #c00..087  │ -10 cr    │      │
│           │  │ 28/02 20:00 │ Compra   │ Pacote Creator │ +500 cr   │      │
│           │  │ 27/02 16:45 │ Render   │ Job #c00..086  │ -25 cr    │      │
│           │  └──────────────┴──────────┴────────────────┴───────────┘      │
│           │                                                                 │
│           │  Mostrando 4 de 38 transacoes         [← 1 2 3 →]             │
│           │                                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Desktop (>=1024px):** Layout em 1 coluna: balance card full-width → pacotes em grid 4 cols → historico tabela full-width.
**Tablet (768-1023px):** Pacotes em grid 2 cols. Historico sem coluna "Descricao".
**Mobile (<768px):** Balance card compacto. Pacotes em grid 1 col (scroll horizontal alternativa). Historico em cards.

---

## 3. Balance Card

### Estrutura

```
┌──────────────────────────────────────────────────────────────┐
│                                                                │
│  Seu saldo                                                    │
│                                                                │
│  847                                             [+ Comprar]  │
│  creditos                                                     │
│                                                                │
│  ─────────────────────────────────────────────                │
│  Este mes: -320 cr (render) · -80 cr (tts) · +500 cr (compra)│
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

**Visual:**
- Background: gradiente sutil `bg-surface` → `bg-elevated`
- Borda: `border-subtle`
- Border-radius: `1rem`
- Numero de creditos: `Syne 700`, `text-4xl`, `text-primary`
  - Cor muda se saldo baixo (<50 cr): `warning`
  - Cor muda se saldo critico (<10 cr): `error`
- Label "creditos": `text-lg`, `text-secondary`
- Resumo do mes: `text-sm`, `text-muted`, `JetBrains Mono`
  - Debitos em `text-muted`
  - Creditos em `success`
- Botao "Comprar": Primary `orange-500`, icone `Plus`

> **21st.dev — Componente base (balance):**
> - **Statistics Card 5** — Card de saldo com numero grande, indicador delta (+5.7%), botao "Topup", e breakdown por categoria com barra segmentada colorida. Base perfeita para o balance card.
> - Link: https://21st.dev/statistics-card-5
> - Adaptar: trocar moeda por creditos, breakdown por razao (render/tts/purchase), cores Nyx.

---

## 4. Pacotes de Creditos

### Grid de pricing cards

```
┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│                │  │                │  │    POPULAR     │  │                │
│   Starter      │  │   Creator      │  │   Pro          │  │   Studio       │
│                │  │                │  │                │  │                │
│   100          │  │   500          │  │   1.500        │  │   5.000        │
│   creditos     │  │   creditos     │  │   creditos     │  │   creditos     │
│                │  │                │  │                │  │                │
│   R$ 19        │  │   R$ 79        │  │   R$ 199       │  │   R$ 499       │
│   (R$0.19/cr)  │  │   (R$0.16/cr)  │  │   (R$0.13/cr)  │  │   (R$0.10/cr)  │
│                │  │                │  │                │  │                │
│   ~3 renders   │  │   ~16 renders  │  │   ~50 renders  │  │   ~166 renders │
│                │  │                │  │                │  │                │
│   [Comprar]    │  │   [Comprar]    │  │   [Comprar]    │  │   [Comprar]    │
│                │  │                │  │                │  │                │
└────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘
```

**Elementos de cada card:**
- Nome do pacote: `Syne 600`, `text-lg`, `text-primary`
- Badge "POPULAR": no pacote Pro, `orange-500`
- Quantidade de creditos: `Syne 700`, `text-3xl`, `text-primary`
- Preco: `text-xl`, `text-secondary`
- Preco por credito: `text-sm`, `text-muted`
- Estimativa de renders: `text-sm`, `text-muted`, icone `Clapperboard`
- Botao comprar: `cyan-500` (normal), `orange-500` (popular)

**Visual:**
- Background: `bg-surface`
- Borda: `border-subtle`, pacote popular: `border-orange-500`
- Pacote popular: sombra `orange-glow` sutil
- Hover: borda `border-medium`, sombra intensifica
- Border-radius: `1rem`

**Comportamento:**
- Click "Comprar" → Stripe Checkout (ou gateway futuro)
- Apos compra: toast "500 creditos adicionados!", saldo atualiza instantaneamente
- Pagamento processado no backend, credita via `creditTransactions` com reason "purchase"

> **21st.dev — Componente base (pricing):**
> - **Pricing Card** (Compound Component) — Card de pricing com header, nome do plano, badge "Popular", preco com strikethrough original, lista de features com CheckCircle. Padrao compound component (`PricingCard.Card`, `.Header`, `.Price`, etc.).
> - Link: https://21st.dev/pricing-card
> - Adaptar: trocar features por estimativa de renders, trocar moeda para BRL, adicionar badge "Popular" no pacote Pro.

---

## 5. Historico de Transacoes

### Filtros

```
┌──────────────────────────────────────────────────────────────┐
│  [Todos ▾]  [De: 01/01/2026]  [Ate: 01/03/2026]            │
└──────────────────────────────────────────────────────────────┘
```

**Filtro de tipo (dropdown):**
- Todos (default)
- Render — debitos de renderizacao
- TTS — debitos de text-to-speech
- Compra — creditos adicionados

**Filtro de data:**
- Date pickers "De" e "Ate"
- Atalhos: "Ultimo mes", "Ultimos 3 meses", "Este ano"

### Tabela de transacoes

| Coluna | Conteudo | Largura |
|---|---|---|
| **Data** | Timestamp (DD/MM HH:mm) | 130px |
| **Tipo** | Badge: Render/TTS/Compra | 100px |
| **Descricao** | Job ID (link) ou "Pacote {nome}" | Flex |
| **Creditos** | Amount (+/-) | 100px |

**Cores por tipo:**
| Tipo | Badge cor | Amount cor |
|---|---|---|
| Render | `orange-500` | `text-muted` (negativo) |
| TTS | `cyan-500` | `text-muted` (negativo) |
| Compra | `success` | `success` (positivo) |

**Visual da tabela:**
- Mesmos estilos da tabela de Jobs (secao 3 de 06-jobs.md)
- Paginacao: 20 items por pagina
- Amounts negativos: sem sinal, `text-muted`
- Amounts positivos: `+`, `success`
- Job ID como link: click navega para `/jobs` com job selecionado

> **21st.dev — Componente base (tabela):**
> - **Table** (shadcn/ui) — Tabela simples com header, body, footer. Demo de invoices com Status badges e total no footer. Base leve sem dependencias extras.
> - Link: https://21st.dev/table

---

## 6. Breakdown Mensal (opcional/futuro)

### Mini-chart de gastos por mes

```
┌──────────────────────────────────────────────────┐
│  Gastos mensais                                    │
│                                                    │
│  Mar ████████████████████░░░░  -400 cr            │
│  Fev ██████████████░░░░░░░░░░  -280 cr            │
│  Jan ████████░░░░░░░░░░░░░░░░  -160 cr            │
│                                                    │
│  ██ Render  ░░ TTS                                │
│                                                    │
└──────────────────────────────────────────────────┘
```

- Dados da API `GET /api/credits/breakdown`
- Barras horizontais empilhadas: render (orange) + tts (cyan)
- Hover mostra valores exatos por razao
- Implementacao futura — v2

---

## 7. Estado Vazio

### Sem transacoes (usuario novo)

```
┌──────────────────────────────────────────────────────────────┐
│                                                                │
│                      [Icone Coins]                            │
│                                                                │
│             Bem-vindo ao Nyx!                                 │
│                                                                │
│   Seu saldo: 0 creditos                                       │
│                                                                │
│   Compre seu primeiro pacote de creditos                      │
│   para comecar a renderizar videos                            │
│                                                                │
│             [+ Comprar creditos]                               │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Copy & Microcopy

| Elemento | Texto |
|---|---|
| Titulo da pagina | Creditos |
| Balance label | Seu saldo |
| Balance unit | creditos |
| Resumo mes | Este mes: {render} (render) · {tts} (tts) |
| Botao comprar (balance) | + Comprar |
| Secao pacotes | Pacotes de creditos |
| Badge popular | Popular |
| Preco por credito | R${valor}/cr |
| Estimativa renders | ~{N} renders |
| Botao comprar (card) | Comprar |
| Compra sucesso | {N} creditos adicionados ao seu saldo! |
| Secao historico | Historico de transacoes |
| Filtro todos | Todos |
| Filtro render | Render |
| Filtro tts | TTS |
| Filtro compra | Compra |
| Saldo baixo warning | Saldo baixo! Considere comprar mais creditos. |
| Saldo insuficiente | Creditos insuficientes para este render. |

---

## 9. Animacoes

### Balance card
- **Saldo carrega:** Numero anima de 0 ate o valor real (counter animation, `duration-normal`)
- **Saldo atualiza (apos compra/render):** Numero faz transicao animada do antigo para o novo (NumberFlow-style)
- **Saldo baixo:** Numero pulsa `warning` 2x ao carregar

### Pacotes
- **Cards entram:** Staggered fade-in + translate-y (`0.1s` delay entre cards)
- **Hover:** Sombra intensifica, card sobe 2px (`duration-fast`)
- **Click comprar:** Botao faz loading spinner, card faz pulse sutil

### Historico
- **Rows carregam:** Staggered fade-in
- **Nova transacao (apos compra):** Row aparece no topo com highlight `success/10%` que faz fade-out

---

## 10. Responsividade

| Breakpoint | Balance | Pacotes | Historico |
|---|---|---|---|
| **>=1280px** | Card full-width | Grid 4 colunas | Tabela completa |
| **1024-1279px** | Card full-width | Grid 4 colunas | Tabela sem "Descricao" |
| **768-1023px** | Card compacto | Grid 2 colunas | Tabela sem "Descricao" |
| **<768px** | Numero + botao inline | Grid 1 coluna (scroll) | Cards empilhados |

---

## 11. Notas Tecnicas

### API endpoints usados
- `GET /api/credits/balance` — Saldo atual
- `GET /api/credits/history?limit=20&offset=0&reason=render&from=2026-01-01&to=2026-03-01` — Historico filtrado
- `GET /api/credits/breakdown` — Breakdown mensal por razao

### Integracoes futuras
- Stripe Checkout para pagamento
- Webhook Stripe → backend → credita `creditTransactions` com reason "purchase"
- Webhook de falha → notifica usuario

### Cache
- Balance: React Query, `staleTime: 10s`, invalidado apos render ou compra
- Historico: React Query, `staleTime: 30s`, invalidado apos qualquer transacao

### Alertas de saldo
- Widget no Dashboard (03-dashboard.md) mostra saldo
- Template Editor (04-template-editor.md) mostra estimativa antes de render
- Se saldo < estimativa: botao "Render" desabilitado + link "Comprar creditos"

---

## 12. Componentes 21st.dev — Resumo

| Secao | Componente | Link | Uso |
|---|---|---|---|
| Balance card | Statistics Card 5 | https://21st.dev/statistics-card-5 | Card de saldo com numero grande e breakdown |
| Pricing cards | Pricing Card (Compound) | https://21st.dev/pricing-card | Cards de pacotes com badge, preco, features |
| Tabela de transacoes | Table (shadcn/ui) | https://21st.dev/table | Tabela leve para historico de transacoes |
| Transacoes (alternativa) | Transaction List | https://21st.dev/transaction-list | Lista animada com expand-to-detail (mobile-friendly) |
