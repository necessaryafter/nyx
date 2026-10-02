# Spec: 3 correções no pipeline de roteiro/render do job-scheduler

> Status: rascunho para revisão. Investigação de código já feita (ver seção de cada item);
> item 1 tem uma questão em aberto genuína antes de codar qualquer coisa.

## Objetivo

Três correções pontuais, sem relação estrutural entre si além de todas tocarem o
caminho roteiro → TTS → legenda do job-scheduler:

1. Legenda "pulando" de posição no início de parágrafo.
2. TTS falando símbolos/markdown em voz alta (ex.: "*" → "asterisco").
3. Última parte falar "Parte final" (configurável) em vez de "Parte N.".

---

## Item 1 — Legenda pula no início de parágrafo

### O que já foi investigado (código, não suposição)

- `groupWords`/`buildASS` (`renderer/src/ffmpeg/filters/subtitle.ts`) **não têm nenhuma
  lógica que varia posição por conteúdo ou por gap de tempo** — confirmado lendo o loop
  inteiro: `\an2`/`\an5`/`\an8` é fixo, calculado uma vez, aplicado igual em toda linha;
  não existe `\pos()`/`\move()`; `MarginV` é fixo no Style, nunca sobrescrito por linha.
- O modo karaoke (destaque de palavra) **não gera sobreposição de eventos** no boundary
  de grupo — a aritmética do `lineEnd` confirma que o último evento de um grupo termina
  exatamente no fim da última palavra, nunca invade o próximo grupo.
- O `SILENCE_MS` que adicionei hoje no `edge.provider.ts` **não é a causa** — só entra em
  ação quando o texto passa de 2500 caracteres e é dividido em chunks; uma parte normal
  do scheduler não bate nisso.
- **O preset "reddit"** (`web/src/lib/graphPresets.ts`) — que bate com o estilo do exemplo
  do usuário (narração em primeira pessoa, card de subreddit) — usa
  `highlightColor: "#FFD700"` + `position: "center"` (`\an5`) + `wordsPerGroup: 2`. O
  preset padrão (sem highlight) usa `position: "bottom"` (`\an2`). Ou seja, o usuário
  quase certamente está usando o modo karaoke centralizado.
- **O fix de hoje (`WrapStyle: 2`, commit `e131803`)** já elimina a única causa
  code-confirmada de variação de altura de bloco (quebra automática de linha mudando
  quantas linhas o grupo ocupa). Esse fix já está rodando no ambiente local desde as
  ~22h40 de ontem.

### Questão em aberto (preciso da sua resposta antes de codar)

O vídeo onde você viu esse pulo — **foi gerado antes ou depois desse fix de `WrapStyle`
de ontem?** A execução do scheduler que rodou depois desse fix (5/5 partes, terminou
ontem à noite) já deveria estar sem esse problema, segundo a investigação de código.

- Se foi **antes**: não preciso mudar nada de código pra isso — só confirmar com um
  render novo. Marco o item 1 como "já corrigido, aguardando confirmação" e sigo só
  com os itens 2 e 3.
- Se foi **depois** (ou seja, o pulo aconteceu mesmo com o fix de ontem já valendo):
  isso é um bug genuinamente diferente, ainda sem causa confirmada em código — vou
  precisar gerar um render de teste real com texto de parágrafos (igual seu exemplo) e
  inspecionar frame a frame pra achar a causa de verdade, em vez de tentar mais um
  palpite. Isso muda o tamanho da tarefa (pode precisar investigar comportamento do
  próprio libass/ffmpeg, fora do nosso código).

**Pergunta:** qual dos dois é o caso?

---

## Item 2 — TTS falando símbolos/markdown

### Investigação

Ponto único mais upstream, compartilhado por **todo** texto de narração (gerado pelo
scheduler OU digitado manualmente no editor), antes de qualquer provider de TTS:

```
renderer/src/audioWorker.ts:31  synthesize(narration, talkifyApiKey, workDir)
  → linha 38-42: branch "edge"    → EdgeTTSProvider.synthesize(text, config)
  → linha 58-64: branch "talkify" → TalkifyProvider.synthesize(text, config)
```

Só que esse ponto **não cobre** `renderer/src/prepare/audio.ts` (fluxo separado, usado
pelo `NarrationSource` do editor de grafo direto, sem passar pela fila de áudio) —
esse chama `provider.synthesize(...)` direto, sem passar pelo `audioWorker.ts`.

**Decisão de design:** em vez de duplicar a sanitização nos dois pontos de entrada
(`audioWorker.ts` e `prepare/audio.ts`), o lugar certo é dentro de
`renderer/src/tts/base.provider.ts` — hoje uma classe abstrata vazia
(`BaseTTSProvider`). Viro `synthesize()` num método concreto que sanitiza o texto e
delega pra um `doSynthesize()` abstrato (que `EdgeTTSProvider`/`TalkifyProvider`
implementam) — assim **qualquer** chamador, presente ou futuro, passa pela sanitização
automaticamente, sem precisar lembrar de chamar nada extra.

### O que sanitizar

Baseado no exemplo (`*` → "asterisco") e no tipo de coisa que uma IA de texto às vezes
solta mesmo sendo instruída a não usar markdown:
- `*`, `**` (bold/italic markdown)
- `_`, `__` (itálico/bold alternativo)
- `#` no início de linha (headers markdown)
- `` ` `` (code/inline code)
- `~~` (strikethrough)
- `>` no início de linha (blockquote)
- Colchetes de link markdown `[texto](url)` → mantém só o texto

Regra: **remove o símbolo, mantém o texto** (não tenta "traduzir" pra outra coisa) —
`"isso é *importante*"` vira `"isso é importante"`, não `"isso é ênfase importante"`.

**Assunção:** isso deve rodar em TODO texto de narração, sempre, sem opção de desligar
(não é uma feature configurável, é uma correção de robustez). Corrija-me se você quiser
que seja opcional.

---

## Item 3 — "Parte final" configurável

### Investigação

`assembleParts` (`backend/src/lib/ai/seriesScript.ts`) monta a abertura de cada parte:

```ts
const opener = isFirst ? cleanTitle : `${cleanTitle} Parte ${n}.`;
```

Isso aplica "Parte N." a **todas** as partes não-primeiras, inclusive a última. Não
existe hoje nenhuma distinção pra parte final (diferente do CTA, que já tem
`ctaTemplate` vs `finalCtaTemplate` separados).

### Design (espelha o padrão que já existe)

- Novo campo no scheduler: `finalPartLabel` (string, template com os mesmos
  placeholders de `ctaTemplate`: `{n}`, `{total}`, `{next}` — mesmo sem muito uso
  prático aqui, mantém consistência).
- Default: **`"Parte final."`** (exatamente o que você pediu).
- `assembleParts` passa a decidir:
  ```
  parte 1:              cleanTitle
  parte 2..N-1:          cleanTitle + " Parte {n}."
  parte N (última, N>1): cleanTitle + " " + finalPartLabel
  ```
- Campo novo na tela do scheduler, do lado do `ctaTemplate`/`finalCtaTemplate` — mesmo
  componente `CtaInput`, mesmo estilo.
- Coluna nova em `schedulers` (texto, not null, default `'Parte final.'`) — migration.

Sem questão em aberto aqui — o padrão já existe no código pra eu copiar.

---

## Tech Stack

Sem mudança: Bun + Elysia (backend), Bun (renderer), React + Vite (web), Drizzle ORM,
Zod, Bun test nativo.

## Commands

```
Typecheck backend: cd backend && bunx tsc --noEmit
Typecheck renderer: cd renderer && bunx tsc --noEmit
Typecheck web: cd web && bunx tsc -b
Test backend: cd backend && bun test
Migration: cd backend && bun run db:generate && bun run scripts/migrate.ts
Lint web: cd web && bun run lint
```

## Project Structure (arquivos que este trabalho toca)

```
backend/src/database/schema/schedulers.ts   → + finalPartLabel
backend/src/lib/schemas.ts                  → + finalPartLabel no schema
backend/src/lib/ai/seriesScript.ts          → assembleParts usa finalPartLabel
backend/src/routes/schedulers.ts            → passa o campo novo adiante
web/src/pages/SchedulerFormPage.tsx         → campo novo no formulário
web/src/hooks/useSchedulers.ts              → SchedulerInput
web/src/lib/types.ts                        → Scheduler

renderer/src/tts/base.provider.ts           → sanitização compartilhada
renderer/src/tts/providers/edge.provider.ts    → implementa doSynthesize
renderer/src/tts/providers/talkify.provider.ts → implementa doSynthesize
renderer/src/ffmpeg/filters/subtitle.ts     → só se item 1 precisar de mudança de verdade
```

## Code Style

Mesmo padrão já estabelecido no resto do projeto: comentários `// ponytail:` pra corte
deliberado, Zod pra validação, testes via `bun:test` (backend) ou self-check scripts em
`renderer/test/*.selfcheck.ts` (renderer).

## Testing Strategy

- `sanitizeNarrationText` (novo, provavelmente em `base.provider.ts` ou um arquivo
  utilitário): self-check dedicado com casos reais (`*`, `_`, `#`, `` ` ``, link
  markdown, texto sem nenhum símbolo pra garantir que não quebra o normal).
- `assembleParts` com `finalPartLabel`: já tem `backend/src/__tests__/scheduler-overrides.test.ts`-like
  cobertura? Checar se `seriesScript.ts` já tem testes de `assembleParts` — se sim,
  estender; se não, criar um pequeno.
- Item 1: só ganha teste automatizado se a investigação apontar uma causa de verdade
  no nosso código. Se for confirmado "já corrigido", nenhum teste novo — só uma
  verificação manual (render real + visual).

## Boundaries

- **Sempre:** manter compatibilidade com schedulers já existentes (campo novo com
  default, não quebra os que já têm `finalPartLabel` ausente).
- **Perguntar antes:** mudar a lista de símbolos sanitizados além do que está listado
  aqui, se descobrir mais casos durante o teste.
- **Nunca:** sanitizar de um jeito que mude o SENTIDO do texto (só remove pontuação
  decorativa, não reescreve palavras).

## Success Criteria

1. Vídeo com `*ênfase*` no roteiro: TTS fala "ênfase", não "asterisco ênfase asterisco".
2. Scheduler em modo partes, `finalPartLabel` default: última parte fala "Parte final."
   em vez de "Parte 5." (ou o número que for).
3. Campo `finalPartLabel` editável na tela do scheduler, igual `ctaTemplate`.
4. Item 1: ou confirmado já resolvido pelo fix de ontem (render de teste sem o pulo),
   ou causa raiz nova identificada e corrigida com verificação visual real.

## Open Questions

1. **[Bloqueia o item 1]** O render onde você viu o pulo de legenda é de antes ou
   depois do fix de `WrapStyle: 2` de ontem à noite (~22h40)?
2. Sanitização (item 2) sempre ligada, sem opção de desligar — confirma?
