# Arquitetura do Grafo de Renderização

## 1. Visão Geral

O renderer recebe um `Graph` (JSON) e executa cada node em **ordem topológica**.
Dados fluem entre nodes através de **edges com handles tipados**.

```
Graph { version: 1, nodes: GraphNode[], edges: GraphEdge[] }
```

---

## 2. Nodes e seus Handles

Cada node é uma unidade de processamento com portas de entrada (inputs) e saída (outputs).

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NODES DO GRAFO                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐         ┌──────────────┐                         │
│  │  VideoPool   │         │     TTS      │                         │
│  │              │         │              │                         │
│  │ config:      │         │ config:      │                         │
│  │  assetIds[]  │         │  text        │                         │
│  │              │         │  provider    │                         │
│  │      [video]─┤         │  voice?      │                         │
│  │              │         │  speed?      │                         │
│  └──────────────┘         │              │                         │
│   sem inputs              ├─[audio]      │                         │
│   1 output                ├─[timestamps] │                         │
│                           └──────────────┘                         │
│                            sem inputs                              │
│                            2 outputs                               │
│                                                                     │
│  ┌──────────────┐         ┌──────────────┐                         │
│  │     Loop     │         │   Subtitle   │                         │
│  │              │         │              │                         │
│  │ config: {}   │         │ config:      │                         │
│  │              │         │  wordsPerGrp │                         │
│  ├─[video]      │         │  style?      │                         │
│  ├─[audio]      │         │              │                         │
│  │              │         ├─[timestamps] │                         │
│  │      [video]─┤         │              │                         │
│  └──────────────┘         │     [filter]─┤                         │
│   2 inputs                └──────────────┘                         │
│   1 output                 1 input                                 │
│   (loopa vídeo até        1 output                                 │
│    duração do áudio)      (filtro FFmpeg de legenda)               │
│                                                                     │
│  ┌──────────────┐         ┌──────────────┐                         │
│  │    Layer     │         │    Render    │                         │
│  │              │         │              │                         │
│  │ config: {}   │         │ config:      │                         │
│  │              │         │  width       │                         │
│  ├─[base]       │         │  height      │                         │
│  ├─[overlay] *N │         │  fps         │                         │
│  │  (múltiplo,  │         │  format?     │                         │
│  │  ord. por    │         │              │                         │
│  │  edge.order) │         │              │                         │
│  │      [video]─┤         ├─[video]      │                         │
│  └──────────────┘         ├─[audio]      │                         │
│   1 + N inputs            │              │                         │
│   1 output                │       [file]─┤                         │
│   (composição visual)     │              │                         │
│                           └──────────────┘                         │
│                            2 inputs                                │
│                            1 output (arquivo final)                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Fluxo Típico — "Dark Video"

Um vídeo estilo Reddit/narração usa todos os 6 nodes:

```
 ┌────────────┐              ┌────────────┐
 │ VideoPool  │              │    TTS     │
 │            │              │            │
 │ assetIds:  │              │ text: "..."│
 │ [uuid,uuid]│              │ provider:  │
 │            │              │ "talkify"  │
 └─────┬──────┘              └──┬─────┬───┘
       │video                   │audio│timestamps
       │                        │     │
       │    ┌───────────────────┘     │
       │    │                         │
       ▼    ▼                         ▼
 ┌────────────┐              ┌────────────┐
 │    Loop    │              │  Subtitle  │
 │            │              │            │
 │ Loopa até  │              │ wordsPerGrp│
 │ duração do │              │ : 3        │
 │ áudio      │              │ style: ... │
 └─────┬──────┘              └─────┬──────┘
       │video                      │filter
       │                           │
       ▼                           ▼
 ┌─────────────────────────────────────────┐
 │                Layer                     │
 │                                          │
 │  base = vídeo loopado                    │
 │  overlay = [filtro legendas, ...]        │
 │  (N overlays, ordenados por edge.order)  │
 │                                          │
 │  Compõe vídeo + overlays via FFmpeg      │
 └────────────────────┬────────────────────┘
                      │video
                      │
       ┌──────────────┘
       │          ┌─────────── (TTS.audio reutilizado)
       ▼          ▼
 ┌────────────────────┐
 │       Render       │
 │                    │
 │  1080x1920, 30fps  │
 │  format: "mp4"     │
 │                    │
 │  Muxing final:     │
 │  vídeo + áudio     │
 └─────────┬──────────┘
           │file
           ▼
     video_final.mp4
```

---

## 4. Edges (conexões entre handles)

Cada edge conecta **um output handle** de um node a **um input handle** de outro:

```
Edge { id, from, fromHandle, to, toHandle, order? }
```

O campo `order` (opcional) controla a ordem de composição quando múltiplas edges
apontam pro mesmo handle (ex: `Layer.overlay`). Menor order = camada mais ao fundo.

Para o fluxo acima, as 7 edges seriam:

```
  from         fromHandle    →    to          toHandle    order
  ──────────── ────────────       ─────────── ──────────  ─────
  VideoPool    video         →    Loop        video
  TTS          audio         →    Loop        audio
  TTS          timestamps    →    Subtitle    timestamps
  Loop         video         →    Layer       base
  Subtitle     filter        →    Layer       overlay     0
  Layer        video         →    Render      video
  TTS          audio         →    Render      audio
```

Notas:
- **TTS.audio** tem duas edges saindo — vai pro `Loop` (pra calcular duração) e pro `Render` (pra muxar no vídeo final). Um output pode alimentar múltiplos inputs.
- **Layer.overlay** aceita múltiplas edges. O resolver agrupa os valores num array ordenado por `order`. Handles com uma única edge recebem o valor direto (sem array).

---

## 5. Ordem de Execução (Topológica)

O renderer resolve as dependências e executa nesta ordem:

```
Nível 0 (sem dependências):  VideoPool, TTS     ← podem rodar em paralelo
Nível 1 (depende do 0):     Loop, Subtitle      ← podem rodar em paralelo
Nível 2 (depende do 1):     Layer
Nível 3 (depende do 2):     Render
```

```
tempo ──────────────────────────────────────────────►

  ┌──────────┐
  │VideoPool │━━━━┓
  └──────────┘    ┃   ┌──────┐         ┌───────┐         ┌────────┐
                  ┣━━▶│ Loop │━━━━━━━━▶│ Layer │━━━━━━━━▶│ Render │━▶ done
  ┌──────────┐   ┃   └──────┘    ┌━━━▶│       │    ┌━━━▶│        │
  │   TTS    │━━━┫               ┃    └───────┘    ┃    └────────┘
  └──────────┘   ┃   ┌──────────┐┃                 ┃
                  ┗━━▶│ Subtitle │┛                 ┃
                  ┃   └──────────┘                  ┃
                  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                         (TTS.audio direto pro Render)
```

---

## 6. Tipos de Dados nos Handles

| Handle       | Tipo em runtime         | Exemplo                              |
|-------------|------------------------|--------------------------------------|
| `video`     | `string` (path)        | `"/tmp/job-abc/looped.mp4"`          |
| `audio`     | `string` (path)        | `"/tmp/job-abc/tts.wav"`             |
| `timestamps`| `WordTimestamp[]`       | `[{word:"hello", startMs:0, endMs:500}]` |
| `filter`    | `string` (FFmpeg filter)| `"subtitles=/tmp/job-abc/subs.ass"`  |
| `file`      | `string` (path)        | `"/tmp/job-abc/final.mp4"`           |

---

## 7. Hierarquia de Classes

```
BaseNodeExecutor<T>          (abstract)
  ├── VideoPoolExecutor      config: { assetIds: string[] }
  ├── LoopExecutor           config: {}
  ├── TTSExecutor            config: { text, provider, voice?, speed? }
  ├── SubtitleExecutor       config: { wordsPerGroup, style? }
  ├── LayerExecutor          config: {}
  └── RenderExecutor         config: { width, height, fps, format? }

BaseTTSProvider              (abstract)
  ├── TalkifyProvider        API externa, retorna timestamps nativamente
  └── CustomAudioProvider    áudio pronto + WhisperX forced alignment

createExecutor(GraphNode) → BaseNodeExecutor   (factory)
```

---

## 8. Como o Worker Processa

```
1. Recebe jobId do BullMQ
2. Busca job no PostgreSQL → obtém Graph (JSONB)
3. Cria executors: graph.nodes.map(createExecutor)
4. Resolve ordem topológica a partir de graph.edges
5. Para cada nível:
   a. Coleta inputs de cada node (outputs dos nodes anteriores via edges)
   b. Executa todos os nodes do nível (paralelo quando possível)
   c. Armazena outputs no mapa de resultados
6. O output do RenderExecutor é o arquivo final
7. Upload do arquivo final pro MinIO
8. Atualiza job no PostgreSQL (status: done, videoKey)
```
