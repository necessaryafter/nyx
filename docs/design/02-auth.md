# Nyx — Auth (Login / Register)

> Objetivo: Converter visitante em usuario com o menor atrito possivel.
> Rotas: `/login`, `/register`
> Auth: Nao requer (redireciona para `/dashboard` se ja autenticado)

---

## 1. Estrategia

### Principios
- **Atrito minimo** — O menor numero de campos possivel. OAuth como caminho preferencial.
- **Single page, dois modos** — Login e Register na mesma estrutura visual, alternando com tab/link. Sem navegacao de pagina.
- **Continuidade visual** — A pagina de auth e uma extensao da landing, nao uma quebra. Mesma paleta, mesma tipografia, mesma atmosfera.

### Fluxos suportados (Better Auth)
1. **Email + Senha** — Register com nome, email, senha. Login com email, senha.
2. **Discord OAuth** — Um clique. Ideal para o publico-alvo (criadores de conteudo ja estao no Discord).
3. **Google OAuth** — Um clique. Alternativa universal.

### Pos-registro
- Redireciona para `/dashboard`
- 10 creditos gratis creditados automaticamente na criacao da conta
- Toast de boas-vindas: "10 creditos na conta. Suficiente para seu primeiro video."

---

## 2. Layout

### Estrutura: Split Screen (desktop) / Full card (mobile)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────┐    │
│  │                      │  │                              │    │
│  │   Painel visual      │  │  [Logo Nyx]                  │    │
│  │                      │  │                              │    │
│  │   Background          │  │  Crie sua conta             │    │
│  │   cinematografico     │  │                              │    │
│  │   com o editor de    │  │  [Discord] [Google]          │    │
│  │   nodes desfocado    │  │                              │    │
│  │   e glow ambient     │  │  ── ou continue com email ── │    │
│  │                      │  │                              │    │
│  │   Tagline:           │  │  Nome  [____________]        │    │
│  │   "Configure once.   │  │  Email [____________]        │    │
│  │    Produce forever." │  │  Senha [____________]        │    │
│  │                      │  │                              │    │
│  │                      │  │  [Criar conta]               │    │
│  │                      │  │                              │    │
│  │                      │  │  Ja tem conta? Entrar        │    │
│  │                      │  │                              │    │
│  └──────────────────────┘  └──────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Desktop (≥1024px):** Split 50/50. Painel visual a esquerda, formulario a direita.
**Tablet (768-1023px):** Painel visual escondido. Formulario centralizado com max-w-md.
**Mobile (<768px):** Formulario full-width com padding lateral. Background sutil (sem painel visual).

> **21st.dev — Componente base (layout geral):**
> - **Auth Page** por alihassan — Split screen auth com painel visual a esquerda (floating SVG paths animados + logo + blockquote) e formulario a direita (OAuth buttons + separador "OR" + email input). Inclui radial gradient decorativo no background do form. Adaptar: trocar floating paths por screenshot do editor desfocado com glow ambient, usar paleta Nyx (bg-void, cyan/orange gradients).
> - Link: https://21st.dev/alihassan/auth-page
> - **Auth Form** por tomisloading — Auth form animado com motion fade-in, social buttons (grid 2 colunas + full-width SSO), separador "OR", campos email/senha, termos. Background com grid SVG decorativo. Alternativa se preferir formulario centralizado sem split screen.
> - Link: https://21st.dev/tomisloading/auth-form

---

## 3. Painel Visual (lado esquerdo)

**Proposito:** Reforcar a identidade da marca enquanto o usuario preenche o form. Nao e decorativo — comunica o produto.

**Composicao:**
- Background: `bg-void`
- Screenshot do editor de nodes desfocado (`blur(8px)`, `opacity: 0.3`) como textura de fundo
- Gradient overlay: `linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(249, 115, 22, 0.05))`
- Grain texture overlay (mesma da landing)

**Conteudo centralizado vertical:**
- Logo "Nyx" — Syne 800, `text-4xl`, `text-primary`
- Tagline — DM Sans 400, `text-lg`, `text-secondary`, max-w-xs
  ```
  Configure once. Produce forever.
  ```
- Mini trust bar (opcional):
  ```
  ▶ 12,847 videos renderizados
  ```
  Syne 600, `text-sm`, `cyan-500` para o numero, `text-muted` para o label

**Animacao:**
- Glow ambient pulsando lentamente (8s cycle) — `radial-gradient` de `cyan-glow` que se move sutilmente
- Nada chamativo — e background, nao protagonista

> **21st.dev — Referencia para o painel visual:**
> - **Auth Page** por alihassan — O painel esquerdo usa `FloatingPaths` (SVG paths animados com motion, strokeOpacity pulsante, pathOffset cycling). Trocar por screenshot do editor com blur + glow ambient pulsante. Manter a estrutura de `gradient-to-t from-background` overlay + logo + blockquote no bottom.
> - Link: https://21st.dev/alihassan/auth-page

---

## 4. Formulario

### Header do formulario

**Register:**
- Titulo: "Crie sua conta" (Syne 700, `text-2xl`, `text-primary`)
- Subtitulo: "10 creditos gratis para seu primeiro video." (DM Sans 400, `text-sm`, `text-secondary`)

**Login:**
- Titulo: "Bem-vindo de volta" (Syne 700, `text-2xl`, `text-primary`)
- Subtitulo: "Entre para continuar produzindo." (DM Sans 400, `text-sm`, `text-secondary`)

---

### OAuth Buttons (prioridade visual)

```
┌─────────────────────────────────────────┐
│  [🎮 Continuar com Discord]             │   ← botao principal
├─────────────────────────────────────────┤
│  [G  Continuar com Google]              │   ← botao secundario
└─────────────────────────────────────────┘
```

**Estilo Discord:**
- bg `#5865F2` (cor oficial Discord), texto branco
- Icone Discord a esquerda
- Full width, py-3, rounded-lg
- Hover: brightness 1.1 + shadow sutil

**Estilo Google:**
- bg `bg-elevated`, borda `border-subtle`, texto `text-primary`
- Icone Google colorido a esquerda
- Full width, py-3, rounded-lg
- Hover: borda `border-medium`

**Por que Discord primeiro:**
O publico-alvo (criadores de dark content) e heavy user de Discord. Comunidades de YouTube, troca de assets, networking — tudo acontece la. Discord OAuth e o caminho de menor atrito para essa persona.

> **21st.dev — Referencia para OAuth buttons:**
> - **Auth Page** por alihassan — Botoes OAuth full-width empilhados verticalmente (Google, Apple, GitHub) com icone a esquerda + texto. Layout `space-y-2` com `Button size="lg" className="w-full"`. Adaptar: Discord como primeiro (bg #5865F2 custom), Google como segundo (variant outline com borda border-subtle).
> - Link: https://21st.dev/alihassan/auth-page
> - **Login** por tailus — Botoes OAuth com icone SVG inline + texto, `variant="outline" size="lg"`, full-width, `flex items-center gap-3`. Referencia para o estilo mais limpo de botoes com icone SVG embutido.
> - Link: https://21st.dev/tailus/login

---

### Separador

```
──────────  ou continue com email  ──────────
```

- Linha: `border-subtle`
- Texto: DM Sans 400, `text-xs`, `text-muted`, uppercase, tracking-widest
- Layout: flex com linhas horizontais + texto centralizado

> **21st.dev — Referencia para separador:**
> - **Auth Page** por alihassan — Componente `AuthSeparator` inline: `div.flex > div.bg-border.h-px.w-full + span.text-muted-foreground.px-2.text-xs("OR") + div.bg-border.h-px.w-full`. Mesmo pattern exato, so trocar "OR" por "ou continue com email" e aplicar uppercase + tracking-widest.
> - Link: https://21st.dev/alihassan/auth-page

---

### Campos do formulario

**Register (3 campos):**

| Campo | Tipo | Placeholder | Validacao |
|-------|------|-------------|-----------|
| Nome | text | "Seu nome" | Min 1 char |
| Email | email | "email@exemplo.com" | Email valido |
| Senha | password | "Minimo 8 caracteres" | Min 8 chars |

**Login (2 campos):**

| Campo | Tipo | Placeholder | Validacao |
|-------|------|-------------|-----------|
| Email | email | "email@exemplo.com" | Email valido |
| Senha | password | "Sua senha" | Required |

**Estilo dos inputs:**
- bg `bg-deep`
- Borda: `border-subtle` (1px)
- Focus: borda `cyan-500` + `box-shadow: 0 0 0 3px var(--nyx-cyan-glow)`
- Texto: `text-primary`, DM Sans 400
- Placeholder: `text-muted`
- Label: acima do input, DM Sans 500, `text-sm`, `text-secondary`
- Border-radius: 8px
- Padding: px-4 py-3
- Transicao: borda + shadow em `duration-normal`

**Erro de validacao:**
- Borda muda para `error`
- Mensagem abaixo: DM Sans 400, `text-xs`, `error`
- Icone AlertCircle (Lucide) ao lado da mensagem
- Animacao: shake sutil no input (translateX ±4px, 3 cycles, 300ms)

**Senha — toggle visibilidade:**
- Icone Eye/EyeOff (Lucide) dentro do input, lado direito
- `text-muted`, hover `text-secondary`
- Cursor pointer

> **21st.dev — Referencia para inputs:**
> - **Auth Page** por alihassan — Input com icone a esquerda (`peer ps-9` + div absolute com icone), placeholder, focus ring. Usar como base e adaptar: bg-deep, borda border-subtle, focus borda cyan-500 com glow, label acima (nao inline).
> - Link: https://21st.dev/alihassan/auth-page
> - **Login** por tailus — Inputs com Label (Radix) acima + Input com `ring-foreground/15 border-input ring-1`. Pattern mais proximo do design Nyx (label acima, input separado). Incluir toggle de visibilidade de senha com Eye/EyeOff.
> - Link: https://21st.dev/tailus/login

---

### Botao de submit

**Register:**
```
[Criar conta →]
```

**Login:**
```
[Entrar →]
```

**Estilo:**
- bg `orange-500`, texto branco, full width
- py-3, rounded-lg, Syne 600, `text-base`
- Hover: glow `orange-glow` + scale 1.01
- Active/pressed: `orange-600`, scale 0.99
- Disabled: `opacity-50`, cursor not-allowed

**Estado de loading:**
- Texto substituido por spinner (circle animado, 20px, branco)
- Botao fica disabled
- Duracao: ate resposta da API

---

### Link de alternancia

**Na tela de Register:**
```
Ja tem conta? Entrar
```

**Na tela de Login:**
```
Nao tem conta? Criar conta
```

- DM Sans 400, `text-sm`, `text-muted`
- "Entrar" / "Criar conta" em `cyan-500`, hover underline
- Acao: troca o modo do form (transicao suave, nao navegacao de pagina)

**Transicao entre modos:**
- Campos fazem crossfade (opacity 0→1, 200ms)
- O campo "Nome" entra/sai com height transition (0→auto)

> **21st.dev — Referencia para link de alternancia:**
> - **Login** por tailus — Footer section separado com `border-t border-border` contendo `text-sm text-muted-foreground` + `Button asChild variant="link"` para o link de troca. Pattern limpo e acessivel.
> - Link: https://21st.dev/tailus/login

---

### Forgot password (apenas no Login)

```
Esqueceu a senha?
```
- Abaixo do campo de senha, alinhado a direita
- DM Sans 400, `text-xs`, `cyan-500`, hover underline
- Acao: abre modal ou redireciona para `/forgot-password`

> **21st.dev — Referencia:**
> - **Auth Form** por tomisloading — Link "Forgot?" alinhado a direita ao lado da label "Password", com `text-sm text-blue-600`. Mesmo pattern, adaptar cor para cyan-500.
> - Link: https://21st.dev/tomisloading/auth-form

---

## 5. Estados e Feedback

### Erro de autenticacao (credenciais invalidas)

```
┌─────────────────────────────────────────┐
│ ⚠ Email ou senha incorretos.            │
└─────────────────────────────────────────┘
```

- Aparece acima do formulario
- bg `error/10%`, borda `error/20%`, rounded-lg, padding 12px
- Icone AlertTriangle (Lucide), `error`
- Texto: DM Sans 400, `text-sm`, `error`
- Animacao: slide-down + fade-in (200ms)

### Erro de registro (email ja existe)

```
┌─────────────────────────────────────────┐
│ ⚠ Este email ja esta cadastrado.        │
│   Entrar com esta conta →                │
└─────────────────────────────────────────┘
```

- Mesmo estilo do erro acima
- Link "Entrar com esta conta" em `cyan-500` — alterna para modo login e preenche o email

### Sucesso (registro)
- Redireciona imediatamente para `/dashboard`
- Toast (Sonner) aparece no dashboard: "Conta criada. 10 creditos na conta."
- Toast estilo: bg `bg-elevated`, borda `success/20%`, icone CheckCircle `success`

### OAuth erro
- Se o provedor retornar erro, mostra banner no topo do form:
  ```
  Nao foi possivel conectar com Discord. Tente novamente.
  ```

---

## 6. Seguranca UX

| Aspecto | Implementacao |
|---------|--------------|
| **CSRF** | Handled by Better Auth (cookie-based tokens) |
| **Rate limiting** | API ja tem 100 req/min global. Mostrar "Muitas tentativas. Aguarde." apos 5 falhas |
| **Senha strength** | Indicador visual abaixo do campo: barra de 4 segmentos (fraca → forte) com cores `error → warning → success` |
| **Autocomplete** | `autocomplete="email"` e `autocomplete="current-password"` nos inputs |
| **Autofocus** | Primeiro campo recebe autofocus na montagem |

### Password strength meter (apenas Register)

```
[████░░░░░░░░] Fraca
[████████░░░░] Media
[████████████] Forte
```

- 4 segmentos, cada um preenche conforme criterios:
  1. ≥8 caracteres
  2. Tem numero
  3. Tem letra maiuscula
  4. Tem caractere especial
- Cores: 1 seg = `error`, 2 seg = `warning`, 3-4 seg = `success`
- Label: DM Sans 400, `text-xs`, cor do status atual
- Animacao: segmentos preenchem com transition width (150ms)

---

## 7. Animacoes de Entrada

**Staggered reveal ao carregar a pagina:**

| Elemento | Delay | Animacao |
|----------|-------|----------|
| Logo (se mobile) | 0ms | fade-in |
| Titulo do form | 100ms | fade-up |
| Subtitulo | 150ms | fade-up |
| Botao Discord | 250ms | fade-up |
| Botao Google | 300ms | fade-up |
| Separador | 350ms | fade-in (opacity only) |
| Campos | 400ms | fade-up (todos juntos) |
| Botao submit | 500ms | fade-up |
| Link alternancia | 550ms | fade-in |

**Easing:** `--nyx-ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`)
**Duracao base:** `--nyx-duration-reveal` (600ms)

> **21st.dev — Referencia para animacoes:**
> - **Auth Form** por tomisloading — Wrapper `motion.div` com `initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.25, ease: "easeInOut" }}` no container do form inteiro. Simplificacao: animar o container todo em vez de cada elemento individual. Para stagger individual, usar `motion` do framer-motion com `staggerChildren` como no Hero da landing.
> - Link: https://21st.dev/tomisloading/auth-form

---

## 8. Responsividade

| Breakpoint | Layout |
|-----------|--------|
| **Desktop** (≥1024px) | Split 50/50 — painel visual + formulario. Form card com max-w-sm, centrado vertical no lado direito |
| **Tablet** (768-1023px) | Sem painel visual. Formulario centralizado, max-w-md, bg `bg-deep` full page |
| **Mobile** (<768px) | Formulario full-width, px-6. Logo Nyx no topo (substituindo painel visual). Background `bg-deep` + gradient radial sutil |

### Mobile-specific
- Logo "Nyx" acima do titulo (Syne 700, `text-xl`, `cyan-500`)
- OAuth buttons mantem full-width
- Inputs mantem full-width
- Teclado virtual: `scroll-padding-bottom` para garantir que o campo ativo nao fique atras do teclado

---

## 9. Notas Tecnicas

| Aspecto | Detalhe |
|---------|---------|
| **Form library** | React Hook Form + Zod schema |
| **OAuth redirect** | Better Auth handles via `/api/auth/sign-in/discord` e `/api/auth/sign-in/google` |
| **Session** | Cookie `better-auth.session_token` setado automaticamente pelo Better Auth |
| **Redirect apos login** | Checar query param `?redirect=` para deep linking (ex: link direto para template) |
| **Loading states** | Disable form durante submit. Spinner no botao. OAuth buttons ficam disabled quando um e clicado |
| **Persisted email** | Se usuario veio do erro "email ja existe" → preencher email automaticamente no modo login |

---

## 10. Resumo de Componentes 21st.dev

| Secao | Componente | Autor | Uso |
|-------|-----------|-------|-----|
| Layout geral | Auth Page | alihassan | Split screen com painel visual + form, floating paths, OAuth + email |
| Layout alternativo | Auth Form | tomisloading | Form centralizado com motion, social grid, background grid |
| OAuth buttons | Auth Page | alihassan | Botoes full-width empilhados com icone + texto |
| OAuth buttons | Login | tailus | Botoes outline com SVG icons inline |
| Separador | Auth Page | alihassan | AuthSeparator com linhas + texto "OR" |
| Inputs | Login | tailus | Label (Radix) + Input com ring focus |
| Forgot password | Auth Form | tomisloading | Link alinhado a direita ao lado da label |
| Link alternancia | Login | tailus | Footer com border-t e Button variant="link" |
| Animacoes | Auth Form | tomisloading | motion.div com fade-up no container |
