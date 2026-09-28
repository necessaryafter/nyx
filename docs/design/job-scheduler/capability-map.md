# Mapa de Capacidades — Job Scheduler

> Status: **rascunho para revisão**. Nada abaixo foi implementado. Fase atual: SPECIFY.
> Próximas fases (PLAN → TASKS → IMPLEMENT) só começam depois da aprovação deste mapa e das specs por módulo.

## Contexto

Hoje cada vídeo nasce de uma ação manual: escolher template → escrever/gerar roteiro → gerar áudio → renderizar → baixar. O usuário quer configurar **uma vez** (template, tema, assets, formato) e receber **séries de vídeos prontas em lote**, repetidas automaticamente num agendamento.

Exemplo do próprio usuário:

> Crio um scheduler, seleciono template X, informo o tema e os assets. Digo se quero vídeo completo de até X minutos ou dividido em até Y partes (4 partes = 4 vídeos de ~1 min). Escolho a IA. Ela gera um texto que caiba nesse tempo total e quebra em partes. No fim de cada parte (menos a última) entra um texto tipo "Curta e comente para a parte 2", com o número gerenciado pelo sistema. Os vídeos ficam prontos em lote: clico na série de 4 partes e aparecem os 4 pra baixar.

## Decisões já tomadas com o usuário

| Pergunta | Decisão |
|---|---|
| O scheduler roda quando? | **Recorrente (cron)**, além de poder rodar na hora ("Rodar agora"). Cada execução gera uma série nova com o mesmo tema. |
| O que os assets do scheduler fazem? | **Substituem o pool de fundo** do template (AssetSource de vídeo/imagem). Se nenhum for escolhido, valem os do template. Música idem, opcional. |
| Como entra o CTA do fim de cada parte? | **Falado + legendado**: vai pro fim do texto da narração. Zero código novo no renderer pra isso. |
| Quais IAs? | **Só Gemini, com chave por usuário** (salva em Configurações → Integrações, como o Talkify). Escolha de modelo no scheduler. Desenho deixa a porta aberta pra outros provedores. |

## Módulos

| Módulo | Responsabilidade | Depende de |
|---|---|---|
| `ai-keys` | Chave Gemini por usuário em Integrações; lista dinâmica de modelos; `/api/ai/*` passa a usar a chave do usuário | — |
| `series-script` | Gerar roteiro em N partes que caiba no tempo pedido, com título, abertura de parte e CTA aplicados deterministicamente | `ai-keys` |
| `scheduler` | Entidade Scheduler + Execuções (runs); agendamento cron; worker que transforma uma execução em N jobs renderizados; API REST + eventos WS | `series-script` |
| `scheduler-ui` | Telas: lista, criação/edição, detalhe com execuções → partes → download; item no menu | `scheduler` |

**Ordem de construção:** `ai-keys` → `series-script` → `scheduler` → `scheduler-ui`

Cada módulo tem sua spec: `SPEC-ai-keys.md`, `SPEC-series-script.md`, `SPEC-scheduler.md`, `SPEC-scheduler-ui.md`. Este arquivo é o índice; não adivinhar por nome de arquivo.

Sem ciclos: a UI só fala com a API do `scheduler`; o `scheduler` só chama funções do `series-script`; o `series-script` só pede a chave ao `ai-keys`.

## Glossário

- **Scheduler** — a configuração reutilizável (template, tema, assets, formato, IA, cron). Nome mantido como o usuário pediu.
- **Execução (run)** — uma rodada do scheduler. Produz **uma série**: um título, um roteiro dividido em partes, N jobs.
- **Parte** — um vídeo da série. É um `job` normal (mesma tabela, mesma tela de Jobs, mesmo download), ligado à execução por `runId` + `partIndex`.
- **CTA** — texto falado no fim de cada parte não-final. Placeholders: `{n}` (parte atual), `{next}` (próxima), `{total}`.

## Contexto técnico comum (vale para todas as specs)

### Stack

- Backend: Bun + Elysia, Drizzle ORM (PostgreSQL 16), BullMQ 5.76 (Redis 7), Zod 4, better-auth. Já tem `@google/genai`.
- Renderer: Bun worker BullMQ, ffmpeg. Só entra aqui com uma mudança pequena no card de título (ver `SPEC-scheduler.md`).
- Web: React 19, Vite 7, TanStack Query 5, React Router 7, Zustand, Tailwind 4, lucide-react.
- Infra local: `docker compose up -d` (Postgres 5433, Redis, MinIO) + container `nyx-whisperx`.

### Comandos

```
# backend
cd backend && bun run dev                 # API com --watch
cd backend && bun test                    # testes (bun:test, mocks em src/__tests__/helpers)
cd backend && bun run db:generate         # gera migration a partir do schema Drizzle
cd backend && bun run scripts/migrate.ts  # aplica migrations

# renderer
cd renderer && bun run dev
cd renderer && bunx tsc --noEmit

# web
cd web && bun run dev
cd web && bunx tsc -b                     # typecheck (o build roda isso)
cd web && bun run lint
```

### Estrutura relevante

```
backend/src/routes/        → um arquivo por recurso REST (Elysia com prefix)
backend/src/lib/           → regras compartilhadas (credits.ts, schemas.ts, queue.ts)
backend/src/lib/ai/        → NOVO: gemini.ts, seriesScript.ts
backend/src/workers/       → NOVO: scheduler.worker.ts (BullMQ Worker no processo do backend)
backend/src/database/schema/ → uma tabela por arquivo; migrations geradas em database/migrations
backend/src/__tests__/     → *.test.ts + helpers/ (mock-db, mock-session, setup)
web/src/pages/             → uma página por rota; wizard em pages/wizard/
web/src/hooks/             → um hook-file por recurso (useJobs.ts, useTemplates.ts…)
web/src/components/<área>/ → componentes por área (editor/, jobs/, layout/, ui/)
docs/design/               → PRDs e specs (este diretório)
```

### Estilo de código (exemplo real do repo)

```ts
// backend/src/routes/jobs.ts — padrão de rota: zod safeParse, 400 com details, escopo por userId
.post("/draft", async ({ body, session, set }) => {
  const parsed = createDraftJobSchema.safeParse(body);
  if (!parsed.success) {
    set.status = 400;
    return { error: "invalid fields", details: parsed.error.flatten() };
  }
  const [template] = await database
    .select()
    .from(templates)
    .where(and(eq(templates.id, parsed.data.templateId), eq(templates.userId, session.user.id)))
    .limit(1);
  if (!template) { set.status = 404; return { error: "template not found" }; }
  // ...
})
```

```ts
// web/src/hooks/useJobs.ts — padrão de hook: TanStack Query + api client, invalidação por queryKey
export function useStartAudio(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (narration: Narration) => api.post<{ status: string }>(`/api/jobs/${jobId}/audio`, { narration }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}
```

Convenções: nomes em inglês no código, textos de UI em pt-BR direto e sem hype (ver `PRODUCT.md`); erros HTTP como `{ error: string, details? }`; toda query filtra por `userId` da sessão; comentários curtos explicando o *porquê*, não o *o quê*; atalhos deliberados marcados com `// ponytail:` dizendo o teto e o próximo passo.

### Estratégia de testes

- **Backend:** `bun test`. Unit para funções puras (orçamento de palavras, CTA, override de grafo, máquina de estados da execução). Rotas com os mocks existentes (`mock-db`, `mock-session`), no estilo de `credits-routes.test.ts`. Nada de rede real: Gemini e BullMQ mockados.
- **Renderer:** `bunx tsc --noEmit` + um `assert` de auto-checagem pra duração mínima do card.
- **Web:** `bunx tsc -b` + `bun run lint` + checklist manual por tela (sem framework de UI test hoje; não adicionar um agora).
- **Ponta a ponta (manual, antes de dar por pronto):** criar scheduler de 2 partes × 1 min no template "Teste - Storytime Realista", rodar agora, ver 2 jobs nascerem, baixar os 2, conferir CTA falado no fim da parte 1 e ausente na 2.

### Limites (valem para todos os módulos)

- **Sempre:** rodar `bun test` (backend) e `bunx tsc -b` (web) antes de commitar; gerar migration com `db:generate`, nunca editar SQL na mão; filtrar por `userId` em toda query; criptografar chaves com `encrypt()` de `@nyx/shared`; manter `.env` fora do git.
- **Perguntar antes:** adicionar dependência (nenhuma prevista — BullMQ, Zod, Drizzle e `@google/genai` já existem); alterar schema além do listado nas specs; mexer em preço de créditos; mudar o renderer além dos dois campos do card de título; alterar comportamento das rotas de jobs existentes (só extrair, não mudar).
- **Nunca:** commitar chave de API; guardar chave em texto puro; remover/pular teste que falha; rodar cron dentro do processo web; apagar jobs/vídeos já renderizados ao apagar um scheduler.

## Suposições gerais (corrija se estiver errado)

1. Templates suportados na v1: só os **sem `SceneSource`** (fundo fixo/pool). Template com slots de cena exige escolha manual de mídia por cena, incompatível com lote automático. A criação do scheduler valida e recusa com mensagem clara.
2. Velocidade de fala pra converter minutos em palavras: **150 palavras/minuto** (medido nos testes com Antonio: 110 palavras → 44–45 s). Constante configurável, não por voz na v1.
3. Duração é **aproximada** (±15%). Não regeneramos infinitamente pra bater o tempo exato.
4. Partes 2+ começam faladas repetindo **o título + "Parte N."** e o card de título mostra o título da história com "— Parte N". Parte 1 começa só com o título (que já vira o card).
4b. O card (subreddit/usuário/tag/votos/comentários/tempo) é **dinâmico por execução**: subreddit/usuário/tag vêm da IA junto do roteiro (combinando com o tema), votos/comentários/tempo são sorteados em código — nunca fica congelado no template. Todas as partes da mesma execução compartilham a mesma identidade (é o mesmo "post"); execuções diferentes do mesmo scheduler geram identidades diferentes.
5. Créditos: cada parte cobra como um job normal (TTS + render). Antes de começar a execução o worker checa saldo pro total estimado e falha cedo se não der.
6. Limites v1: até **10 partes**, de **0,5 a 10 min** cada; até **10 schedulers ativos** por usuário.
7. Timezone do cron: a do navegador de quem cria (enviada pelo front), default `America/Sao_Paulo`.
8. Worker de orquestração roda **dentro do processo do backend** (único processo, concorrência 1). Suficiente pra uma máquina; escalar depois é mover pra processo próprio — nada no desenho impede.
9. Manter o fallback pra `GOOGLE_AI_STUDIO_KEY` do servidor quando o usuário não tem chave própria (conveniência de dev). Em produção pode-se desligar por env.
