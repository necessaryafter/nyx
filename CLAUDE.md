# CLAUDE.md — Dark Video Automation Platform

## Visão Geral

Plataforma SaaS para automação de vídeos estilo "Dark" do YouTube (narração de posts Reddit, histórias, etc.). Usuários montam templates visuais com nodes, fazem upload de assets, e a plataforma renderiza o vídeo automaticamente.

## Stack Técnica

| Camada | Tech |
|---|---|
| API principal | TypeScript (Bun) + Elysia + Drizzle ORM |
| Frontend | React + @xyflow/react + Zustand + TanStack Query |
| Auth | Better Auth |
| Renderer | TypeScript (Bun) + FFmpeg via `child_process` |
| Fila | BullMQ + Redis |
| Banco | PostgreSQL |
| Storage | MinIO (MVP) → S3 (produção) |
| TTS | Abstração multi-provider (Talkify + Custom/WhisperX) |

## Estrutura de Repositório

```
/
├── backend/              # TypeScript (Bun) — API principal (Elysia, Drizzle, Better Auth)
├── renderer/             # TypeScript (Bun) — serviço de renderização (FFmpeg, BullMQ)
├── web/                  # React — frontend (Vite, @xyflow/react, Zustand, TanStack Query)
├── docs/design/          # Design docs das páginas do frontend
├── docker-compose.yml    # Infra local (PostgreSQL, Redis, MinIO)
└── CLAUDE.md
```

Cada serviço tem seu próprio `package.json` e `node_modules` (não usa workspaces).

Os tipos do grafo são definidos em `renderer/src/graph.ts` (source of truth) e espelhados via Zod em `backend/src/lib/schemas.ts`. O contrato entre serviços é o schema JSON do job (documentado abaixo) e o PostgreSQL.

## Serviços e Responsabilidades

### `backend/` (TypeScript — Bun + Elysia)
- Autenticação e sessões (Better Auth)
- Gestão de créditos (débito por minuto de vídeo + TTS)
- CRUD de assets, templates, jobs
- Upload de assets para MinIO
- Publicação de jobs na fila (BullMQ)
- WebSocket para status de jobs em tempo real
- Endpoint de download de vídeo por chunks

### `renderer/` (TypeScript — Bun)
- Consome jobs da fila BullMQ
- Resolve grafo de nodes em ordem topológica
- Chama providers TTS conforme configurado no job
- Executa FFmpeg via `child_process.spawn`
- Faz upload do vídeo renderizado para MinIO
- Atualiza status do job no PostgreSQL

### `web/` (React — Vite)
- Editor visual de templates com @xyflow/react
- Gerenciamento de assets (upload, biblioteca)
- Dashboard de jobs (status, download)
- State management via Zustand, data fetching via TanStack Query
- Drag-and-drop via @dnd-kit, animações via Motion
- Marketplace de templates (futuro)
- Gestão de créditos e planos (futuro)

## Schema do Grafo

### Graph (salvo no DB como JSONB e lido pelo renderer)

```typescript
interface Graph {
  version: 1;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphEdge {
  id: string;
  from: string;       // source node id
  fromHandle: string;  // output handle (ex: "video", "audio", "timestamps")
  to: string;         // target node id
  toHandle: string;    // input handle (ex: "video", "audio", "overlay")
}
```

### Node Configs (discriminated union)

```typescript
type GraphNode =
  | { id: string; type: "VideoPool"; config: VideoPoolConfig }
  | { id: string; type: "MusicPool"; config: MusicPoolConfig }
  | { id: string; type: "Loop"; config: LoopConfig }
  | { id: string; type: "TTS"; config: TTSConfig }
  | { id: string; type: "Subtitle"; config: SubtitleConfig }
  | { id: string; type: "Layer"; config: LayerConfig }
  | { id: string; type: "Render"; config: RenderConfig };

interface VideoPoolConfig {
  assetIds: string[]; // UUIDs dos assets de vídeo
}

interface MusicPoolConfig {
  assetIds: string[]; // UUIDs dos assets de música
}

interface LoopConfig {} // duração vem do input "audio"

interface TTSConfig {
  text?: string;       // opcional no template — injetado na criação do job
  provider: "talkify" | "custom";
  voice?: string;
  speed?: number;
}

interface SubtitleConfig {
  wordsPerGroup: number; // 3-4 palavras por grupo
  style?: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    strokeColor?: string;
    strokeWidth?: number;
    position?: "top" | "center" | "bottom";
  };
}

interface LayerConfig {} // composição definida pelas edges de entrada

interface RenderConfig {
  width: number;
  height: number;
  fps: number;
  format?: "mp4" | "webm";
  musicVolume?: number; // 0.0-1.0, volume da música de fundo (default 0.15)
}
```

### Handles por Node (portas de entrada/saída)

| Node | Inputs | Outputs | Descrição |
|---|---|---|---|
| `VideoPool` | — | `videos` | Retorna todos os assets como lista de paths |
| `MusicPool` | — | `audios` | Retorna todos os assets de música como lista de paths |
| `Loop` | `videos`, `audio` | `video` | Concatena vídeos aleatoriamente até a duração do áudio |
| `TTS` | — | `audio`, `timestamps` | Chama provider TTS |
| `Subtitle` | `timestamps` | `filter` | Legenda karaokê 3-4 palavras |
| `Layer` | `base`, `overlay*` | `video` | Composição visual (base + overlays) |
| `Render` | `video`, `audio`, `music` | `file` | Output final — mixa narração + música de fundo |

### Fluxo típico de edges

```
VideoPool.videos   → Loop.videos
TTS.audio          → Loop.audio
TTS.timestamps     → Subtitle.timestamps
Loop.video         → Layer.base
Subtitle.filter    → Layer.overlay
Layer.video        → Render.video
TTS.audio          → Render.audio
MusicPool.audios   → Render.music
```

### Narração per-render (não per-template)

O template define a "máquina" (provider, voz, velocidade, pool de vídeos/músicas, estilo de legenda). A narração (texto TTS ou áudio custom) é injetada na criação do job:

```typescript
// createJobSchema
{
  templateId: string;  // UUID
  narration:
    | { type: "tts"; text: string }      // texto para TTS
    | { type: "audio"; assetId: string }  // áudio custom (WhisperX alignment)
}
```

Na criação do job, o backend injeta a narração no TTS node do grafo do template antes de salvar no banco.

## TTS Providers

Interface que todo provider deve implementar (TypeScript):

```typescript
interface TTSProvider {
  synthesize(text: string, config: TTSConfig): Promise<TTSResult>;
}

interface TTSResult {
  audio: Buffer;
  wordTimestamps: WordTimestamp[];
}

interface WordTimestamp {
  word: string;
  startMs: number;
  endMs: number;
}
```

Providers implementados:
- `TalkifyProvider` — API Talkify (retorna timestamps por palavra nativamente)
- `CustomAudioProvider` — áudio já pronto, usa WhisperX para forced alignment

## Fluxo de Renderização

```
1. Usuário clica "Renderizar" no frontend, envia narração (texto ou áudio)
2. API valida template + narração, injeta narração no TTS node do grafo
3. API cria Job no PostgreSQL (status: pending) com grafo completo
4. API debita créditos estimados
5. API publica { jobId } no BullMQ
6. Renderer disponível consome o job
7. Renderer busca detalhes completos do job no PostgreSQL
8. Renderer baixa todos os assets do MinIO (vídeos + músicas)
9. Renderer chama TTS provider (ou WhisperX para áudio custom)
10. Renderer concatena vídeos aleatoriamente até duração do áudio (Loop)
11. Renderer concatena músicas aleatoriamente e mixa com narração (Render)
12. Renderer compõe layers (base + subtitles) via FFmpeg
13. Renderer faz upload do vídeo final para MinIO
14. Renderer atualiza job no PostgreSQL (status: done + videoKey)
15. API notifica usuário via WebSocket
16. Usuário faz download via presigned URL do MinIO
```

## Modelo de Créditos

- **Renderização:** X créditos por minuto de vídeo
- **TTS externo:** X créditos por minuto de áudio gerado
- **TTS custom (upload):** apenas créditos de renderização
- Créditos são debitados no momento do job (estimativa) e ajustados ao final se necessário

## Retenção de Vídeos

Vídeos renderizados ficam disponíveis por **24 horas** no MinIO, depois são deletados automaticamente via lifecycle policy.

## Convenções de Código

- TypeScript: ESM, strict mode, Zod para validação de schemas (todos os serviços)
- Erros explícitos — nunca silenciar exceções, sempre propagar ou logar
- Commits: conventional commits (`feat:`, `fix:`, `chore:`, etc.)
- Variáveis de ambiente: sempre via `.env` com exemplo em `.env.example`

## Infra Local

A infra de desenvolvimento (PostgreSQL, Redis, MinIO) sobe via `docker-compose.yml` na raiz. O MinIO init cria automaticamente os buckets `studio-assets` e `studio-videos`.

```bash
docker compose up -d
```

## Variáveis de Ambiente Importantes

```env
# API
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
MINIO_ENDPOINT=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
BETTER_AUTH_SECRET=...

# Renderer
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
MINIO_ENDPOINT=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
TALKIFY_API_KEY=...

# Web
VITE_API_URL=...
```

## O que NÃO fazer

- Não implementar rendering distribuído (chunked paralelo) agora — isso é otimização futura
- Não usar libs wrapper de FFmpeg — usar `child_process.spawn` direto
- Não migrar para Kafka agora — BullMQ é suficiente para o MVP
- Não suportar GPU ainda — rendering CPU é suficiente e mais simples de deployar
- Não usar localStorage em artifacts React
