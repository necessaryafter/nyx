# Nyx — Settings

> Objetivo: Pagina de configuracoes da conta — perfil, preferencias, seguranca, e zona de perigo (deletar conta). Centraliza tudo que o usuario precisa gerenciar sobre sua conta.
> Rota: `/settings`
> Auth: Requer autenticacao

---

## 1. Estrategia

### Principios
- **Organizado por contexto** — Tabs separam perfil, preferencias, e seguranca. O usuario encontra a configuracao certa sem scroll infinito.
- **Feedback imediato** — Cada alteracao e salva individualmente com feedback visual (toast ou inline "Salvo").
- **Zona de perigo isolada** — Acoes destrutivas (deletar conta) ficam separadas, com confirmacao dupla. Impossivel acionar acidentalmente.
- **Minimalismo** — Apenas configuracoes que o usuario realmente precisa. Sem opcoes que nunca serao usadas.

### Metricas-alvo
- **Profile completion**: >80% dos usuarios com nome e avatar preenchidos
- **Settings change rate**: <2 clicks para alterar qualquer configuracao
- **Account deletion friction**: 2 confirmacoes (dialog + digitar "DELETAR")

---

## 2. Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Sidebar  │                       Settings                                  │
│           │─────────────────────────────────────────────────────────────────│
│  ≡ Dash   │                                                                 │
│  ≡ Templ  │  [Perfil]  [Preferencias]  [Seguranca]                         │
│  ≡ Assets │                                                                 │
│  ≡ Jobs   │  ─── PERFIL ───                                                │
│  ≡ Credit │                                                                 │
│  ≡ Market │  ┌──────────────────────────────────────────────────────┐      │
│  ≡ Settin │  │                                                      │      │
│           │  │  [Avatar]   João Silva                               │      │
│           │  │  ( editar ) joao@email.com                           │      │
│           │  │                                                      │      │
│           │  └──────────────────────────────────────────────────────┘      │
│           │                                                                 │
│           │  Nome                                                          │
│           │  [João Silva                        ]                          │
│           │                                                                 │
│           │  Email                                                         │
│           │  [joao@email.com                    ]  (somente leitura)       │
│           │                                                                 │
│           │  Bio                                                           │
│           │  [Criador de conteudo dark...       ]                          │
│           │                                                                 │
│           │                                   [Salvar alteracoes]          │
│           │                                                                 │
│           │  ─── ZONA DE PERIGO ───                                        │
│           │                                                                 │
│           │  ┌──────────────────────────────────────────────────────┐      │
│           │  │  Deletar conta                                       │      │
│           │  │  Essa acao e irreversivel. Todos os seus dados,      │      │
│           │  │  templates, assets e historico serao apagados.       │      │
│           │  │                                                      │      │
│           │  │                              [Deletar minha conta]  │      │
│           │  └──────────────────────────────────────────────────────┘      │
│           │                                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Desktop (>=1024px):** Conteudo centralizado com `max-w-2xl`. Sidebar visivel.
**Tablet (768-1023px):** Conteudo full-width. Sidebar colapsada.
**Mobile (<768px):** Conteudo full-width. Tabs como scroll horizontal.

---

## 3. Tabs

```
┌──────────────────────────────────────────────────┐
│  [Perfil]    [Preferencias]    [Seguranca]       │
└──────────────────────────────────────────────────┘
```

| Tab | Conteudo |
|---|---|
| **Perfil** | Avatar, nome, email (read-only), bio |
| **Preferencias** | Notificacoes, idioma, tema (futuro) |
| **Seguranca** | Alterar senha, sessoes ativas, zona de perigo |

**Visual:**
- Tab ativa: underline `cyan-500`, `text-primary`, `font-medium`
- Tab inativa: `text-secondary`, hover `text-primary`
- Transicao: underline desliza entre tabs (`duration-fast`)

> **21st.dev — Componente base (tabs):**
> - **Tabs** (shadcn/ui) — Tabs com "Account" e "Password" contendo Cards com formularios. Padrao classico de settings page.
> - Link: https://21st.dev/tabs
> - Adaptar: 3 tabs (Perfil, Preferencias, Seguranca), conteudo customizado por tab.

---

## 4. Tab: Perfil

### Avatar + identidade

```
┌───────────────────────────────────────────┐
│                                             │
│   ┌─────┐                                  │
│   │     │   João Silva                     │
│   │  JS │   joao@email.com                 │
│   │     │   Membro desde Jan 2026          │
│   └─────┘                                  │
│   [Alterar foto]                           │
│                                             │
└───────────────────────────────────────────┘
```

**Avatar:**
- Circulo 80x80px
- Se sem foto: iniciais (2 letras), background gradiente `cyan-500` → `orange-500`
- Hover: overlay escuro com icone `Camera`
- Click "Alterar foto": abre file picker, aceita imagens (jpg, png, webp), crop circular

**Campos do formulario:**
- **Nome:** Input text, editavel, `min-length: 1`
- **Email:** Input text, read-only (cinza), icone `Lock`. Email vem do auth provider.
- **Bio:** Textarea, opcional, max 200 chars. Placeholder: "Conte um pouco sobre voce..."

**Botao salvar:**
- `cyan-500`, alinhado a direita
- Disabled se nao houve alteracoes
- Loading spinner durante save
- Sucesso: toast "Perfil atualizado"

> **21st.dev — Componente base (perfil):**
> - **Account Settings** — Componente completo de settings com avatar editing (crop via react-easy-crop), separadores, dialogs. Base para a secao de perfil.
> - Link: https://21st.dev/account-settings
> - Adaptar: manter avatar + form, remover campos nao necessarios.

---

## 5. Tab: Preferencias

### Notificacoes

```
┌───────────────────────────────────────────────────────────┐
│  Notificacoes                                               │
│                                                             │
│  Render concluido                                          │
│  Receber notificacao quando um render terminar    [● ON]   │
│                                                             │
│  Render falhou                                             │
│  Receber notificacao quando um render falhar      [● ON]   │
│                                                             │
│  Saldo baixo                                               │
│  Alertar quando creditos estiverem abaixo de 50   [○ OFF]  │
│                                                             │
│  Email marketing                                           │
│  Novidades, dicas e atualizacoes do Nyx           [○ OFF]  │
│                                                             │
└───────────────────────────────────────────────────────────┘
```

**Toggle switches:**
- On: `cyan-500`
- Off: `bg-elevated`
- Transicao: thumb desliza (`duration-fast`)
- Cada toggle salva automaticamente (sem botao "Salvar" separado)
- Feedback: micro-toast "Preferencia atualizada" ou check inline

### Idioma (futuro)

```
│  Idioma                                                    │
│  [Portugues (Brasil)  ▾]                                  │
```

### Tema (futuro)

```
│  Tema                                                      │
│  (●) Dark   ( ) Light   ( ) Sistema                       │
```

---

## 6. Tab: Seguranca

### Alterar senha

```
┌───────────────────────────────────────────────────────────┐
│  Alterar senha                                              │
│                                                             │
│  Senha atual                                               │
│  [••••••••                              ] [👁]             │
│                                                             │
│  Nova senha                                                │
│  [                                      ] [👁]             │
│  Min. 8 caracteres                                         │
│                                                             │
│  Confirmar nova senha                                      │
│  [                                      ] [👁]             │
│                                                             │
│                              [Alterar senha]               │
│                                                             │
└───────────────────────────────────────────────────────────┘
```

**Validacoes:**
- Senha atual obrigatoria
- Nova senha: min 8 chars
- Confirmar: deve ser igual a nova senha
- Erros inline abaixo de cada campo em `error`
- Sucesso: toast "Senha alterada com sucesso", limpa campos

### Sessoes ativas (futuro)

```
│  Sessoes ativas                                            │
│                                                             │
│  Chrome · Windows · Sao Paulo                              │
│  Sessao atual · Ultimo acesso: agora        [Esta sessao] │
│                                                             │
│  Safari · macOS · Rio de Janeiro                           │
│  Ultimo acesso: ha 2 dias                   [Encerrar]    │
│                                                             │
│  [Encerrar todas as outras sessoes]                        │
```

### Zona de Perigo

```
┌──────────────────────────────────────────────────────────────┐
│                                                                │
│  ⚠ Zona de Perigo                                            │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  Deletar conta                                         │  │
│  │                                                        │  │
│  │  Essa acao e permanente e irreversivel.                │  │
│  │  Todos os seus dados serao apagados:                   │  │
│  │  • Templates e configuracoes                           │  │
│  │  • Assets (videos, audios, textos)                     │  │
│  │  • Historico de jobs e renders                         │  │
│  │  • Creditos restantes (sem reembolso)                  │  │
│  │                                                        │  │
│  │                            [Deletar minha conta]       │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

**Visual:**
- Secao separada com borda `error` (vermelha)
- Background: `bg-surface`
- Header "Zona de Perigo": `text-error`, icone `AlertTriangle`
- Botao "Deletar": variante `destructive` — `bg-red-600`, hover `bg-red-700`

**Dialog de confirmacao (2 etapas):**

Etapa 1:
```
┌──────────────────────────────────────────┐
│                                          │
│  ⚠ Deletar conta                       │
│                                          │
│  Tem certeza? Essa acao nao pode        │
│  ser desfeita. Todos os seus dados      │
│  serao permanentemente apagados.        │
│                                          │
│  Digite "DELETAR" para confirmar:       │
│  [                              ]       │
│                                          │
│  [Cancelar]        [Confirmar delete]   │
│                                          │
└──────────────────────────────────────────┘
```

- Botao "Confirmar delete" so ativa quando o usuario digita "DELETAR" exatamente
- Botao `destructive`, disabled ate confirmacao

> **21st.dev — Componente base (danger zone):**
> - **Alert Dialog** (shadcn/ui) — Dialog com variante destructive para "Delete Account". Overlay, animacao open/close, botoes Cancel/Continue. Base para a confirmacao de delete.
> - Link: https://21st.dev/alert-dialog
>
> - **Dialog Deactivate** — Dialog com icone de warning vermelho, titulo, descricao, e botoes Cancel/Deactivate. Visual mais estilizado para deactivation flows.
> - Link: https://21st.dev/dialog-deactivate

---

## 7. Copy & Microcopy

| Elemento | Texto |
|---|---|
| Titulo da pagina | Configuracoes |
| Tab perfil | Perfil |
| Tab preferencias | Preferencias |
| Tab seguranca | Seguranca |
| Avatar alterar | Alterar foto |
| Nome label | Nome |
| Email label | Email |
| Email note | Gerenciado pelo provedor de autenticacao |
| Bio label | Bio |
| Bio placeholder | Conte um pouco sobre voce... |
| Salvar perfil | Salvar alteracoes |
| Perfil salvo | Perfil atualizado |
| Notif render done | Render concluido |
| Notif render fail | Render falhou |
| Notif low balance | Saldo baixo |
| Notif marketing | Email marketing |
| Senha atual | Senha atual |
| Nova senha | Nova senha |
| Confirmar senha | Confirmar nova senha |
| Senha min | Min. 8 caracteres |
| Senha mismatch | As senhas nao coincidem |
| Senha sucesso | Senha alterada com sucesso |
| Danger title | Zona de Perigo |
| Danger delete | Deletar minha conta |
| Danger desc | Essa acao e permanente e irreversivel. |
| Danger items | Templates, Assets, Jobs, Creditos (sem reembolso) |
| Danger confirm prompt | Digite "DELETAR" para confirmar |
| Danger confirm button | Confirmar delete |
| Account deleted | Conta deletada. Redirecionando... |

---

## 8. Animacoes

### Tabs
- **Troca de tab:** Underline desliza (`duration-fast`), conteudo faz crossfade
- **Tab content entra:** Fade-in + translate-x sutil (direcao depende da tab)

### Formularios
- **Toggle switch:** Thumb desliza, cor transiciona (`duration-fast`)
- **Salvar:** Botao faz loading spinner, sucesso mostra check icon (1s)
- **Erro de validacao:** Campo faz shake sutil, mensagem de erro faz fade-in

### Zona de perigo
- **Dialog abre:** Fade-in + scale `0.95 → 1`, backdrop fade
- **Input "DELETAR":** Borda muda para `error` ao comecar a digitar
- **Botao ativa:** Fade-in + cor transiciona de disabled para `destructive`

---

## 9. Responsividade

| Breakpoint | Layout | Tabs | Formulario |
|---|---|---|---|
| **>=1024px** | `max-w-2xl` centralizado | Horizontal | Full-width dentro do container |
| **768-1023px** | Full-width | Horizontal | Full-width |
| **<768px** | Full-width | Scroll horizontal | Campos empilhados |

---

## 10. Notas Tecnicas

### API endpoints
- `GET /api/auth/session` — Dados do usuario logado (Better Auth)
- `PATCH /api/user/profile` — Atualizar nome e bio (futuro)
- `POST /api/user/avatar` — Upload de avatar (futuro)
- `POST /api/auth/change-password` — Alterar senha (Better Auth)
- `DELETE /api/user/account` — Deletar conta (futuro)

### Better Auth integration
- Sessao e gerenciada pelo Better Auth
- Email e read-only (vem do provider)
- Alterar senha usa endpoint do Better Auth
- Deletar conta deve: cancelar jobs pendentes, remover assets do MinIO, soft-delete no banco

### Preferencias
- Salvas no banco (tabela `user_preferences`)
- Defaults sensoriais: render done ON, render failed ON, saldo baixo OFF, marketing OFF
- Toggle salva via `PATCH /api/user/preferences`

### Avatar
- Upload para MinIO bucket `avatars/`
- Max: 5MB, formatos: jpg, png, webp
- Crop circular client-side antes do upload
- Fallback: iniciais com gradiente

---

## 11. Componentes 21st.dev — Resumo

| Secao | Componente | Link | Uso |
|---|---|---|---|
| Layout de tabs | Tabs (shadcn/ui) | https://21st.dev/tabs | Tabs com Card forms para Account/Settings |
| Perfil / Avatar | Account Settings | https://21st.dev/account-settings | Avatar com crop, form de perfil completo |
| Confirmacao de delete | Alert Dialog (destructive) | https://21st.dev/alert-dialog | Dialog de confirmacao para deletar conta |
| Delete (alternativa) | Dialog Deactivate | https://21st.dev/dialog-deactivate | Dialog com icone warning vermelho |
