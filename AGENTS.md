# AGENTS.md — Instruções por Serviço

Leia esse arquivo junto com o CLAUDE.md para entender o contexto completo do projeto.

---

## `apps/api` — TypeScript API

### Responsabilidades
- Auth via Better Auth
- CRUD: usuários, assets, templates, jobs
- Upload de assets para MinIO
- Publicar jobs no BullMQ
- WebSocket para status de jobs
- Download de vídeo por chunks
- Gestão de créditos

### Padrões
- Framework: ElysiaJS (leve e performático)
- ORM: Drizzle ORM com PostgreSQL
- Validação: Zod em todos os endpoints
- Erros: sempre retornar `{ error: string, code: string }`
- Auth middleware em todas as rotas protegidas
- Utilize Bun invés de pnpm/npm.

### Estrutura de pastas sugerida
```
apps/api/src/
├── routes/
│   ├── auth.ts
│   ├── assets.ts
│   ├── templates.ts
│   ├── jobs.ts
│   └── credits.ts
├── services/
│   ├── storage.ts      # MinIO
│   ├── queue.ts        # BullMQ
│   ├── credits.ts      # lógica de débito
│   └── websocket.ts
├── db/
│   ├── schema.ts       # Drizzle schema
│   └── migrations/
└── lib/
    └── minio.ts
```

### Publicar job na fila
```typescript
// Sempre publicar só o jobId — renderer busca os detalhes no banco
await jobQueue.add('render', { jobId }, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 }
});
```

---

## `apps/renderer` — TypeScript Renderer

### Responsabilidades
- Consumir jobs do BullMQ
- Resolver grafo de nodes (ordem topológica)
- Chamar TTS provider
- Executar FFmpeg
- Upload para MinIO
- Atualizar status no PostgreSQL

### Padrões
- Framework de fila: BullMQ (worker)
- ORM: Drizzle ORM com PostgreSQL
- Erros sempre explícitos — nunca silenciar exceções
- FFmpeg via `child_process.spawn` (nunca libs wrapper)
- Logs estruturados (pino)
- Utilize Bun invés de pnpm/npm

### Estrutura de pastas sugerida
```
apps/renderer/src/
├── index.ts            # entry point, inicia o worker
├── worker.ts           # consome BullMQ, orquestra o job
├── nodes/
│   ├── executor.ts     # interface NodeExecutor + factory
│   ├── videopool.ts
│   ├── loop.ts
│   ├── tts.ts
│   ├── subtitle.ts
│   ├── layer.ts
│   └── render.ts
├── tts/
│   ├── types.ts        # interface TTSProvider
│   ├── talkify.ts
│   └── custom.ts       # forced alignment via WhisperX
├── ffmpeg/
│   ├── builder.ts      # monta args do FFmpeg
│   └── runner.ts       # child_process.spawn
└── storage/
    └── minio.ts
```

### Interface de Node (runtime)

Separar o schema serializado (Graph/GraphNode do CLAUDE.md) da interface de execução:

```typescript
// Dados que fluem entre nodes via handles
type HandleData = string | Buffer | WordTimestamp[] | number;

interface NodeExecutor {
  readonly nodeId: string;
  readonly type: GraphNode["type"];
  execute(inputs: Record<string, HandleData>): Promise<Record<string, HandleData>>;
}
```

Cada implementação retorna um `Record<handle, data>` correspondente aos outputs documentados no CLAUDE.md:
- `VideoPoolExecutor.execute({})` → `{ video: "/tmp/xyz.mp4" }`
- `TTSExecutor.execute({})` → `{ audio: "/tmp/xyz.wav", timestamps: [...] }`
- `LoopExecutor.execute({ video, audio })` → `{ video: "/tmp/looped.mp4" }`
- `SubtitleExecutor.execute({ timestamps })` → `{ filter: "subtitles=..." }`
- `LayerExecutor.execute({ base, overlay })` → `{ video: "/tmp/composed.mp4" }`
- `RenderExecutor.execute({ video, audio })` → `{ file: "/tmp/final.mp4" }`

### FFmpeg runner
```typescript
import { spawn } from "child_process";

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    proc.stderr.pipe(process.stderr); // sempre logar stderr do ffmpeg
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
  });
}
```

---

## `apps/web` — React Frontend

### Responsabilidades
- Editor visual de templates (React Flow)
- Biblioteca de assets (upload, listagem)
- Dashboard de jobs
- Marketplace de templates
- Gestão de créditos

### Padrões
- Vite + React + TypeScript
- Tailwind para estilo
- React Query para fetch/cache de dados da API
- Zustand para estado global (template editor)
- React Flow para o editor de nodes

### Nodes no React Flow
Cada tipo de node tem um componente próprio em `components/nodes/`.
Nomes seguem o padrão do `GraphNode["type"]` (sem sufixo "Node"):
```
apps/web/src/
├── components/
│   ├── nodes/
│   │   ├── VideoPoolNode.tsx    # type: "VideoPool"
│   │   ├── LoopNode.tsx         # type: "Loop"
│   │   ├── TTSNode.tsx          # type: "TTS"
│   │   ├── SubtitleNode.tsx     # type: "Subtitle"
│   │   ├── LayerNode.tsx        # type: "Layer"
│   │   └── RenderNode.tsx       # type: "Render"
│   └── editor/
│       ├── TemplateEditor.tsx   # React Flow canvas
│       └── NodePanel.tsx        # painel lateral de propriedades
├── stores/
│   └── editorStore.ts           # Zustand
└── hooks/
    └── useJobStatus.ts          # WebSocket para status do job
```

Cada componente deve registrar seus handles (input/output ports) de acordo com a tabela de handles do CLAUDE.md. Exemplo: `TTSNode.tsx` expõe handles `audio` e `timestamps` como outputs.

---

## Banco de Dados — Schema Principal

Schema definido com Drizzle ORM em `backend/src/database/schema/`. A fonte de verdade é o código Drizzle — o SQL abaixo é referência.

```sql
-- Usuários gerenciados pelo Better Auth

CREATE TYPE asset_type AS ENUM ('video', 'audio', 'text');
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'done', 'failed');
CREATE TYPE credit_reason AS ENUM ('render', 'tts', 'purchase');

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type asset_type NOT NULL,
  storage_key TEXT NOT NULL,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX assets_user_id_idx ON assets(user_id);

CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  graph JSONB NOT NULL, -- Graph { version, nodes, edges }
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX templates_user_id_idx ON templates(user_id);

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  status job_status NOT NULL DEFAULT 'pending',
  graph JSONB NOT NULL, -- snapshot do Graph no momento do job
  video_key TEXT,
  duration_seconds INT,
  credits_charged INT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX jobs_user_id_idx ON jobs(user_id);
CREATE INDEX jobs_status_idx ON jobs(status);

CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  amount INT NOT NULL,
  reason credit_reason NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX credit_transactions_user_id_idx ON credit_transactions(user_id);
```

---

## Regras Gerais

1. **Nunca** commitar `.env` — sempre usar `.env.example`
2. **Nunca** implementar rendering distribuído agora
3. **Nunca** usar GPU no MVP
4. Assets de vídeos são deletados do MinIO após 24h via lifecycle policy
5. Jobs com status `failed` devem estornar créditos automaticamente
