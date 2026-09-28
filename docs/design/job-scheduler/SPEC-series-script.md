# Spec: `series-script` — Roteiro em N partes que cabe no tempo

> Módulo do mapa `capability-map.md`. Depende de `ai-keys` (chave e cliente Gemini).
> Status: rascunho para revisão.

## Objetivo

Dado um tema, um número de partes e minutos por parte, produzir **uma história contínua** dividida em partes, cada parte com o texto final de narração já montado: abertura ("título" na parte 1, "Parte N." nas seguintes), corpo escrito pela IA no tamanho certo, e o CTA no fim das partes não-finais — tudo determinístico exceto o corpo.

É uma **função pura de serviço** (sem banco, sem fila): o `scheduler` chama; a UI pode chamar via endpoint de preview.

**Sucesso:** pedir 3 partes × 1 min gera 3 textos de ~150 palavras cada (±15%), que formam uma história só, com gancho no fim das partes 1 e 2, CTA "Curta e comente para a parte 2/3" faladas no lugar certo, e sem CTA na parte 3.

## Regras de negócio

### Orçamento de palavras
```
wordsPerMinute      = 150            // constante; medido: 110 palavras ≈ 44–45 s com Antonio
targetWords(part)   = round(minutesPerPart × wordsPerMinute) − words(abertura) − words(cta da parte)
tolerância          = ±15% do targetWords
```
Se uma parte sair fora da tolerância: **uma** nova chamada só para aquela parte pedindo "expanda/encurte para ~N palavras mantendo o conteúdo". Se ainda ficar fora, aceita e marca `outOfBudget: true` (o scheduler só loga; não falha).

### Montagem do texto final de cada parte
```
parte 1:          "{title} {body} {cta(1)}"          // title termina em . ! ou ? (garantir)
parte n (2..N-1): "Parte {n}. {body} {cta(n)}"
parte N (final):  "{body} {finalCta}"                 // finalCta opcional; vazio = nada
N = 1 (vídeo único): "{title} {body} {finalCta}"      // sem CTA intermediário
```
`cta(n)` = `ctaTemplate` com `{n}` → n, `{next}` → n+1, `{total}` → N. Default: `"Curta e comente para a parte {next}."`. Garantir ponto final.

Por que a abertura e o CTA são montados por código e não pela IA: o número da parte é responsabilidade do sistema (o usuário pediu isso explicitamente), e a primeira frase da parte 1 vira o card de título do renderer — precisa ser exatamente o `title`.

### Prompt
- **System:** reutilizar `BASE_SYSTEM_PROMPT` de `routes/ai.ts` (exportar) + bloco de série:
  - história única e contínua, cada parte termina com gancho (exceto a última, que fecha);
  - **não** escrever "Parte N", **não** escrever CTA, **não** repetir o título dentro do corpo — o sistema faz isso;
  - cada parte com ~`targetWords[i]` palavras (passar a lista);
  - frases curtas, pontuação normal, parágrafos separados por linha em branco (o TTS respeita);
  - `title`: pergunta ou frase curta de impacto no estilo de post (ex.: "Eu sou o babaca por…?");
  - se `avoidTitles` vier, "não repita estas histórias já usadas: …".
- **Saída estruturada:** `responseMimeType: "application/json"` + `responseSchema { title: string, parts: [{ text: string }] }`. Parser tolerante a cerca de código ```` ```json ```` por segurança.
- `temperature: 0.9` (variedade entre execuções recorrentes do mesmo tema).

## Contratos

```ts
// backend/src/lib/ai/seriesScript.ts
export interface SeriesScriptInput {
  apiKey: string;
  model: string;
  theme: string;
  parts: number;                 // 1..10
  minutesPerPart: number;        // 0.5..10
  ctaTemplate?: string;          // default "Curta e comente para a parte {next}."
  finalCtaTemplate?: string;     // opcional, só na última parte
  avoidTitles?: string[];        // títulos de execuções anteriores do mesmo scheduler
  wordsPerMinute?: number;       // default 150
}

export interface SeriesScriptPart {
  index: number;                 // 1-based
  text: string;                  // narração final (abertura + corpo + CTA)
  body: string;                  // corpo puro devolvido pela IA
  targetWords: number;
  actualWords: number;           // de `text`
  outOfBudget: boolean;
}

export interface SeriesScript {
  title: string;
  parts: SeriesScriptPart[];
  model: string;
}

export async function generateSeriesScript(input: SeriesScriptInput): Promise<SeriesScript>;

// funções puras exportadas para teste
export function wordBudget(minutes: number, wpm: number, overheadWords: number): number;
export function applyCta(template: string, n: number, total: number): string;
export function assembleParts(title: string, bodies: string[], opts: { ctaTemplate: string; finalCtaTemplate?: string }): SeriesScriptPart[];
export function countWords(text: string): number;
```

### Endpoint de preview (usado pelo botão "Testar roteiro" da UI)
`POST /api/ai/series-script` — body = `SeriesScriptInput` sem `apiKey` (resolvida via `ai-keys`) e sem `wordsPerMinute`. Resposta: `SeriesScript`. Mesmo `requireAuth` e rate limit do `/api/ai`. Não persiste nada.

## Estrutura

```
backend/src/lib/ai/seriesScript.ts            → serviço + funções puras
backend/src/lib/ai/prompts.ts                 → BASE_SYSTEM_PROMPT (movido de routes/ai.ts, re-exportado lá) + SERIES_RULES
backend/src/routes/ai.ts                      → + POST /series-script
backend/src/__tests__/series-script.test.ts   → testes das funções puras + parser
```

## Estilo

Funções puras pequenas, sem classe. Erros do Gemini propagam como `Error` com mensagem legível (o worker do scheduler decide o que fazer). Sem retry genérico aqui além do retry de orçamento descrito.

## Testes (`bun test`, sem rede)

- `wordBudget(1, 150, 7)` → 143; `wordBudget(0.5, 150, 0)` → 75.
- `applyCta("Curta e comente para a parte {next}.", 1, 4)` → "…parte 2."; `{n}` e `{total}` substituídos; template sem ponto final ganha ponto.
- `assembleParts` com 3 corpos: parte 1 começa com título e termina com CTA(1); parte 2 começa com "Parte 2." e termina com CTA(2); parte 3 não tem CTA nem "Parte 3."; com `finalCtaTemplate`, parte 3 termina com ele; com N=1 não há CTA intermediário.
- Título sem pontuação final recebe "."; título terminando em "?" fica como está.
- Parser JSON aceita resposta pura e com cerca ```` ```json ````; rejeita (`Error`) quando `parts.length !== parts pedido`.
- `generateSeriesScript` com cliente Gemini mockado: chama uma vez quando dentro do orçamento; chama uma segunda vez só para a parte fora do orçamento; marca `outOfBudget` se persistir.

## Critérios de sucesso

1. Entrada `parts: 3, minutesPerPart: 1` → 3 partes, cada `actualWords` dentro de ±15% de `targetWords` na maioria das execuções (aceitável falhar em uma e marcar `outOfBudget`).
2. A abertura e o CTA nunca vêm da IA (verificável: `body` não contém "Parte " nem "Curta e comente").
3. Executar duas vezes com o mesmo tema e `avoidTitles` = título da primeira → título diferente.
4. `POST /api/ai/series-script` devolve o mesmo formato que o worker usa; a UI consegue mostrar o preview parte por parte.
5. `bun test` verde.

## Questões abertas

1. **Idioma:** só pt-BR na v1 (o prompt base já é pt-BR). Ok?
2. **Parte 2+ falada como "Parte N."** — alternativa é a IA abrir com um micro-recap ("Na parte anterior…"). Proposta: "Parte N." na v1; recap como opção depois.
3. **Shorts têm teto de 3 min.** Avisar na UI quando `minutesPerPart > 3`? (Não bloquear.)
