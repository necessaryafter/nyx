# Spec: `scene-detection` — Detecção de cortes por ffmpeg

> Módulo do mapa `capability-map.md`. Sem dependências — função pura, sem banco, sem fila.
> Status: rascunho para revisão.

## Objetivo

Dado um arquivo de vídeo local, devolver os pontos onde a cena muda bruscamente (corte de edição, não uma pausa de câmera) — pra depois recortar cada trecho como um asset separado.

**Sucesso:** um vídeo de 3 minutos com 5 clipes diferentes colados um atrás do outro devolve ~5 segmentos (menos se dois clipes muito parecidos não gerarem um salto grande o bastante, mais nunca — falso positivo é mais tolerável que perder um corte real). Um vídeo de gravação contínua sem edição devolve 1 segmento só (o vídeo inteiro).

## Como funciona

Usa o próprio ffmpeg — sem lib nova, sem serviço novo. O filtro `select` com a expressão `scene` compara histograma entre frames consecutivos e produz um score de 0 a 1; acima de um limiar, é considerado corte.

```
ffmpeg -i <input> -filter:v "select='gt(scene,{threshold})',showinfo" -an -f null - 
```

O `stderr` traz uma linha por frame selecionado, tipo:
```
[Parsed_showinfo_1 @ 0x...] n:   3 pts: 12345 pts_time:12.345 ...
```
Extrai `pts_time` de toda linha contendo `Parsed_showinfo` — cada uma é um ponto onde um novo segmento começa.

- `threshold` default **0.4** (valor clássico do próprio ffmpeg pra corte abrupto; abaixo disso pega demais — câmera balançando ou zoom rápido também sobe o score).
- Cortes a menos de `minSegmentMs` do corte anterior são **descartados** (não geram um segmento novo — em vez disso, o segmento anterior só continua). Default **1500ms** (decisão já tomada com o usuário).
- Se nenhum corte sobrar depois do filtro de duração mínima: devolve **1 segmento só**, do tamanho do vídeo inteiro — quem decide o que fazer com isso é o módulo `asset-import`, não este.

## Contratos

```ts
// renderer/src/scene-detection/detect.ts
export interface DetectedSegment {
  index: number;    // 1-based
  startMs: number;
  endMs: number;
}

export interface DetectSegmentsOptions {
  threshold?: number;     // default 0.4
  minSegmentMs?: number;  // default 1500
}

/** Roda o ffmpeg de verdade — I/O, não é pura. */
export async function detectSceneCuts(filePath: string, threshold?: number): Promise<number[]>; // timestamps em ms, ordenados, sem incluir 0

/** Função pura — fácil de testar sem rodar ffmpeg de verdade. */
export function buildSegments(cutTimestampsMs: number[], durationMs: number, minSegmentMs: number): DetectedSegment[];

/** Junta as duas: roda o ffmpeg, filtra, monta os segmentos. */
export async function detectSegments(filePath: string, durationMs: number, opts?: DetectSegmentsOptions): Promise<DetectedSegment[]>;

/** Estratégia alternativa (fallback), usada pelo asset-import quando o usuário escolhe
 *  dividir em pedaços fixos por não ter corte detectável. Pura, sem ffmpeg. */
export function splitFixedInterval(durationMs: number, intervalMs: number): DetectedSegment[];
```

`buildSegments`: recebe os timestamps de corte brutos (podem estar muito próximos um do outro), devolve a lista final de segmentos já respeitando `minSegmentMs` — percorre os cortes em ordem, só aceita um novo corte se ele estiver a pelo menos `minSegmentMs` de distância do último corte aceito; os demais são descartados (o trecho continua no segmento anterior). Sempre inclui `0` como início do primeiro segmento e `durationMs` como fim do último.

`splitFixedInterval`: `Math.ceil(durationMs / intervalMs)` segmentos de `intervalMs`, o último pode ser mais curto (resto da divisão) — se o resto for menor que `minSegmentMs` (500ms como piso mínimo aqui, não o de detecção), gruda no penúltimo em vez de virar um segmento anão.

## Estrutura

```
renderer/src/scene-detection/detect.ts       → detectSceneCuts, buildSegments, detectSegments, splitFixedInterval
renderer/src/scene-detection/detect.test.ts  → (ou test/scene-detection.selfcheck.ts, ver Testes)
```

Por que em `renderer/` e não `backend/`: é onde o ffmpeg já roda hoje (`renderer/src/ffmpeg/runner.ts`, `probe.ts`) — o backend não tem ffmpeg no ambiente. Ver `SPEC-asset-import.md` pra como o worker do `asset-import` (que também vive em `renderer/`) usa isso.

## Estilo

Seguir `renderer/src/ffmpeg/probe.ts` — `spawn` direto, sem lib de child-process, parse manual do stderr:
```ts
// padrão existente (probe.ts) — detect.ts segue o mesmo formato
const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
const stderr: Buffer[] = [];
proc.stderr.on("data", (chunk) => stderr.push(chunk));
proc.on("close", (code) => { /* parse Buffer.concat(stderr).toString() */ });
```

## Testes

`buildSegments` e `splitFixedInterval` são puras — testáveis sem rodar ffmpeg de verdade:
- `buildSegments([5000, 5200, 12000], 20000, 1500)` → descarta o corte em 5200 (só 200ms depois do de 5000), resultado: `[{0,5000},{5000,12000},{12000,20000}]`.
- `buildSegments([], 10000, 1500)` → `[{0,10000}]` (1 segmento, sem corte).
- `splitFixedInterval(100000, 45000)` → 3 pedaços (`45000, 45000, 10000`); se o resto fosse < 500ms, vira 2 pedaços com o último maior.
- `detectSceneCuts`/`detectSegments`: sem mock de ffmpeg pra isso (função de I/O real) — cobrir com um **self-check manual** (`renderer/test/scene-detection.selfcheck.ts`, padrão de `test/titleCard.selfcheck.ts`): gera 3 clipes sintéticos de cor sólida diferente com `ffmpeg -f lavfi -i color=...`, concatena, roda `detectSegments` no resultado, `assert` que devolve 3 segmentos com duração aproximada da esperada.

## Limites

- **Sempre:** timeout no processo ffmpeg (vídeo de 2h decodificando pode demorar minutos — não travar pra sempre; matar o processo depois de um teto, ex. 10 min, e propagar erro).
- **Nunca:** carregar o vídeo inteiro em memória — o `select`+`showinfo` já processa frame a frame via stream, não mudar isso.

## Critérios de sucesso

1. Vídeo sintético com 3 cores sólidas diferentes concatenadas (corte abrupto de verdade) → `detectSegments` acha os 3 segmentos.
2. Vídeo de cor única do início ao fim (sem corte nenhum) → `detectSegments` devolve 1 segmento.
3. `buildSegments` e `splitFixedInterval` passam nos casos de teste acima sem tocar em ffmpeg.

## Questões abertas

1. `threshold = 0.4` é o ponto de partida clássico do ffmpeg — pode precisar de ajuste depois de testar com vídeo real (gameplay com movimento de câmera pode gerar falso positivo). Deixo como constante única, fácil de tunar depois.
2. Vídeos com fade/dissolve entre clipes (transição suave, não corte seco) não geram um pico de `scene` tão claro — podem não ser detectados. Fora de escopo pra v1 (o pedido original foi sobre cortes colados, não com transição).
