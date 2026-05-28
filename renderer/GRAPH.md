# Arquitetura do Grafo de Renderizacao V2

O renderer agora recebe `Graph { version: 2, settings, nodes, edges }`.

O canvas continua node-based, mas os nodes nao representam mais apenas arquivos
passando por handles. Eles declaram uma blueprint de edicao:

```txt
Sources -> Events -> Actions -> Render
```

## Contrato

```ts
interface Graph {
  version: 2;
  settings: { width: number; height: number; fps: number; format?: "mp4" | "webm"; musicVolume?: number };
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
}

interface BlueprintEdge {
  id: string;
  from: string;
  to: string;
  role?: "media" | "sfx" | "music" | "overlay" | "narration" | "scene" | "trigger";
}
```

## Nodes Core

- Sources: `NarrationSource`, `AssetSource`, `SceneSource`, `MusicSource`
- Events: `OnTime`, `OnWord`, `OnSentence`, `OnSilence`, `OnSceneStart`, `OnSceneEnd`
- Actions: `SetMedia`, `ShowOverlay`, `SetSubtitleStyle`, `PlaySfx`, `SetMusic`, `CameraEffect`
- Output: `Render`

## Pipeline Interno

1. Worker recebe `{ jobId }` da fila `render`.
2. Worker busca o job no banco e valida `graph.version === 2`.
3. Worker resolve UUIDs de assets para storage keys.
4. `renderGraphV2` prepara audio/timestamps via `NarrationSource`.
5. `buildEventTimeline` normaliza eventos de tempo, fala, silencio e cena.
6. `resolveActions` transforma edges `event -> action` em acoes resolvidas.
7. O renderer monta tracks visuais/audio/texto e executa FFmpeg.
8. Worker faz upload do arquivo final e marca o job como `done`.

`RenderPlan` e mantido somente em memoria.

## Compatibilidade

Nao ha compatibilidade com Graph V1. Templates antigos devem ser removidos ou
recriados como V2.
