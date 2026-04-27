# Nyx — Assets Library

> Objetivo: Biblioteca centralizada onde o usuario gerencia todos os seus assets (videos, audios, textos). Os assets sao referenciados pelos nodes VideoPool e MusicPool nos templates.
> Rota: `/assets`
> Auth: Requer autenticacao

---

## 1. Estrategia

### Principios
- **Tudo em um lugar** — O usuario nao precisa sair do flow para gerenciar arquivos. A biblioteca e acessivel tanto como pagina dedicada quanto como modal dentro do Template Editor.
- **Upload sem friccao** — Drag-and-drop na area principal, sem formularios desnecessarios. O tipo do asset e detectado automaticamente pela extensao/MIME.
- **Visual-first** — Thumbnails para videos, waveform placeholder para audios, icone de texto para .txt. O usuario identifica o asset visualmente, nao lendo nomes de arquivo.
- **Filtro rapido** — Tabs por tipo (All, Video, Audio, Text) + busca por nome. Nenhum asset deve ficar "perdido".

### Metricas-alvo
- **Upload success rate**: >99% (erros claros se falhar)
- **Time to find asset**: <5s (busca + filtro)
- **Asset reuse**: >3x por asset (indica boa organizacao)

---

## 2. Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Sidebar  │                    Assets Library                               │
│           │─────────────────────────────────────────────────────────────────│
│  ≡ Dash   │  [All] [Video] [Audio] [Text]     🔍 Buscar assets...   [↑ Up] │
│  ≡ Templ  │─────────────────────────────────────────────────────────────────│
│  ≡ Assets │                                                                 │
│  ≡ Jobs   │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  ≡ Credit │  │ ▶ thumb   │  │ ▶ thumb   │  │ ♪ wave    │  │ ♪ wave    │   │
│  ≡ Market │  │           │  │           │  │           │  │           │   │
│           │  │ bg-city   │  │ bg-rain   │  │ horror-bg │  │ lofi-beat │   │
│           │  │ .mp4 12MB │  │ .mp4 8MB  │  │ .mp3 4MB  │  │ .mp3 3MB  │   │
│           │  │ [⋮]       │  │ [⋮]       │  │ [⋮]       │  │ [⋮]       │   │
│           │  └───────────┘  └───────────┘  └───────────┘  └───────────┘   │
│           │                                                                 │
│           │  ┌───────────┐  ┌───────────┐                                  │
│           │  │ 📄 txt    │  │ 📄 txt    │                                  │
│           │  │           │  │           │                                  │
│           │  │ script-01 │  │ narration │                                  │
│           │  │ .txt 2KB  │  │ .txt 1KB  │                                  │
│           │  │ [⋮]       │  │ [⋮]       │                                  │
│           │  └───────────┘  └───────────┘                                  │
│           │                                                                 │
│           │  Mostrando 6 de 24 assets          [← 1 2 3 4 →]              │
│           │                                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Desktop (>=1024px):** Grid 4 colunas (com sidebar). Cards 1:1 aspect ratio.
**Tablet (768-1023px):** Grid 3 colunas. Sidebar colapsada.
**Mobile (<768px):** Grid 2 colunas. Cards menores. Upload via botao (sem dropzone visivel).

---

## 3. Header + Filtros

### Estrutura

```
┌──────────────────────────────────────────────────────────────────────┐
│  [All]  [Video]  [Audio]  [Text]          🔍 Buscar...    [↑ Upload] │
└──────────────────────────────────────────────────────────────────────┘
```

**Tabs de tipo:**
- All (default), Video, Audio, Text
- Mapeiam diretamente ao campo `type` do asset no banco
- Contagem por tab: "Video (12)", "Audio (8)", etc.
- Tab ativa: underline `cyan-500` + `text-primary`
- Tab inativa: `text-secondary`, hover `text-primary`

**Busca:**
- Input com icone `Search` (Lucide)
- Placeholder: "Buscar por nome..."
- Debounced (300ms) — filtra client-side se <100 assets, senao server-side
- Loading spinner enquanto busca

**Botao Upload:**
- Primary: `cyan-500`, icone `Upload` (Lucide), texto "Upload"
- Click: abre file picker do sistema
- Alternativa: area de dropzone visivel no estado vazio

> **21st.dev — Componente base (busca):**
> - **Input** (Search with Loader) — Input de busca com icone search, loading spinner debounced, e icone de microfone. Base perfeita para a busca de assets.
> - Link: https://21st.dev/input
> - Adaptar: remover icone de microfone, manter search + loader, aplicar cores Nyx.

---

## 4. Upload de Assets

### Dropzone (estado vazio ou area dedicada)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│                     [Icone UploadCloud]                            │
│                                                                    │
│              Arraste arquivos aqui ou                              │
│              clique para selecionar                                │
│                                                                    │
│     Formatos: .mp4, .webm, .mp3, .wav, .txt                      │
│     Tamanho maximo: 500MB por arquivo                              │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Comportamento:**
- Drag-and-drop: borda muda para `cyan-500` + glow ao arrastar sobre a area
- Aceita multiplos arquivos simultaneamente
- Tipo do asset detectado automaticamente pelo MIME type:
  - `video/*` → type "video"
  - `audio/*` → type "audio"
  - `text/*` → type "text"
- Upload via `POST /api/assets/upload` (multipart/form-data)
- Progress bar por arquivo durante upload
- Toast de sucesso por arquivo: "bg-city.mp4 enviado com sucesso"
- Toast de erro se falhar: "Erro ao enviar bg-city.mp4: arquivo muito grande"

**Upload inline (quando ja tem assets):**
- Botao "Upload" no header abre file picker
- Drag-and-drop funciona em qualquer lugar da pagina (nao apenas na dropzone)
- Indicador visual full-page ao arrastar: overlay `cyan-500/10%` + borda `cyan-500`

> **21st.dev — Componente base (upload):**
> - **File Upload** (animated) — Upload com drag-and-drop, progress bars por arquivo, thumbnails para imagens/videos, botao de delete por arquivo, animacoes de feedback (icone bounce, borda glow). Base completa para o upload de assets.
> - Link: https://21st.dev/file-upload
> - Adaptar: manter progress bars e thumbnails, trocar cores para paleta Nyx, adicionar deteccao automatica de tipo.

---

## 5. Grid de Assets

### Card de asset

```
┌─────────────────────┐
│ ┌─────────────────┐ │
│ │                 │ │  ← Thumbnail / Preview
│ │   ▶ (video)     │ │     Video: frame do video com icone play
│ │   ♪ (audio)     │ │     Audio: waveform placeholder + icone
│ │   📄 (text)     │ │     Text: icone documento
│ │                 │ │
│ └─────────────────┘ │
│                       │
│  bg-city-night.mp4    │  ← Nome (truncado)
│  Video · 12.4 MB      │  ← Tipo + tamanho
│  Enviado ha 2 dias    │  ← Data relativa
│                   [⋮] │  ← Menu de acoes
└─────────────────────┘
```

**Visual do card:**
- Background: `bg-surface`
- Borda: `border-subtle`
- Border-radius: `0.75rem`
- Hover: borda `border-medium`, sombra sutil
- Selecionado (dentro do Template Editor modal): borda `cyan-500` + glow

**Thumbnail por tipo:**
- **Video:** Primeiro frame do video (gerado no upload via ffprobe/thumbnail futuro). Fallback: gradiente dark com icone `Play` centralizado. Icone de duracao no canto inferior direito: "0:45".
- **Audio:** Waveform estilizado (gradiente `cyan-500` → `orange-500`) ou fallback com icone `Music` centralizado. Duracao no canto inferior direito.
- **Text:** Background `bg-elevated` com icone `FileText` grande centralizado, `text-muted`.

**Menu de acoes (⋮):**
- Renomear
- Download
- Deletar (com confirmacao)

**Grid layout:**
- CSS Grid: `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`
- Gap: `1rem`
- Responsive: 4 cols (desktop) → 3 cols (tablet) → 2 cols (mobile)

> **21st.dev — Componente base (grid):**
> - **Layout Grid** — Grid responsivo com cards clicaveis, animacao de expansao (Framer Motion layoutId), suporte a thumbnails e conteudo overlay. Referencia para o grid de assets.
> - Link: https://21st.dev/layout-grid
> - Adaptar: cards sem expansao (click abre detalhes ou seleciona), manter grid responsivo, thumbnails por tipo de asset.

---

## 6. Modal de Selecao (dentro do Template Editor)

Quando o usuario clica "Adicionar video" no VideoPool ou "Adicionar musica" no MusicPool dentro do Template Editor, abre um modal com a biblioteca filtrada.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│  Selecionar Videos                               [X]              │
│                                                                    │
│  🔍 Buscar...                                                     │
│                                                                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ ✓       │  │ ▶       │  │ ▶       │  │ ▶       │            │
│  │ bg-city │  │ bg-rain │  │ bg-road │  │ bg-dark │            │
│  │ 12MB    │  │ 8MB     │  │ 15MB    │  │ 6MB     │            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
│                                                                    │
│  2 selecionados                  [Cancelar]  [Confirmar]          │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Comportamento:**
- Filtrado automaticamente pelo tipo do node (VideoPool → videos, MusicPool → audios)
- Multi-select: click para toggle selecao
- Cards selecionados: borda `cyan-500` + checkmark no canto superior
- Contador de selecionados no footer
- Botao "Confirmar" adiciona os assetIds ao node config
- Botao "Upload" disponivel dentro do modal para upload rapido

---

## 7. Estado Vazio

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│                      [Icone FolderOpen]                            │
│                                                                    │
│               Nenhum asset encontrado                             │
│                                                                    │
│     Faca upload de videos, audios e textos para                   │
│     usar nos seus templates                                       │
│                                                                    │
│                  [↑ Fazer primeiro upload]                         │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Com filtro ativo (busca/tab sem resultados):**
- "Nenhum {tipo} encontrado para "{busca}""
- Botao "Limpar filtros"

---

## 8. Copy & Microcopy

| Elemento | Texto |
|---|---|
| Titulo da pagina | Assets |
| Tab All | Todos |
| Tab Video | Videos |
| Tab Audio | Audios |
| Tab Text | Textos |
| Busca placeholder | Buscar por nome... |
| Botao upload | Upload |
| Dropzone principal | Arraste arquivos aqui ou clique para selecionar |
| Dropzone formatos | Formatos: .mp4, .webm, .mp3, .wav, .txt |
| Dropzone tamanho | Tamanho maximo: 500MB por arquivo |
| Upload sucesso | "{nome}" enviado com sucesso |
| Upload erro | Erro ao enviar "{nome}": {motivo} |
| Delete confirm | Tem certeza que deseja deletar "{nome}"? Essa acao nao pode ser desfeita. |
| Delete confirm note | Se este asset esta sendo usado em algum template, a renderizacao pode falhar. |
| Delete sucesso | "{nome}" deletado |
| Empty state title | Nenhum asset encontrado |
| Empty state desc | Faca upload de videos, audios e textos para usar nos seus templates |
| Empty filtered | Nenhum {tipo} encontrado para "{busca}" |
| Modal selecao titulo | Selecionar {tipo} |
| Modal contador | {N} selecionados |

---

## 9. Animacoes

### Upload
- **Dropzone drag-over:** Borda pulsa `cyan-500`, icone UploadCloud faz bounce sutil
- **Progress bar:** Fill animado `cyan-500`, `duration: proporcional ao progresso real`
- **Upload completo:** Progress bar faz flash `success`, card do asset aparece no grid com fade-in + scale `0.95 → 1`

### Grid
- **Cards entram:** Staggered fade-in (0.05s delay entre cards)
- **Card hover:** Sombra intensifica, borda muda, `duration-fast`
- **Card delete:** Fade-out + scale `1 → 0.95`, grid re-layout suave
- **Filtro/tab muda:** Cards fazem crossfade (`duration-normal`)

### Modal de selecao
- **Abre:** Fade-in + scale `0.95 → 1` + backdrop fade
- **Card seleciona:** Checkmark aparece com scale `0 → 1`, borda anima para `cyan-500`
- **Fecha:** Fade-out reverso

---

## 10. Responsividade

| Breakpoint | Grid | Upload | Busca | Detalhes |
|---|---|---|---|---|
| **>=1280px** | 4 colunas | Dropzone visivel + botao | Input expandido | Card com info completa |
| **1024-1279px** | 3 colunas | Dropzone visivel + botao | Input expandido | Card com info completa |
| **768-1023px** | 3 colunas | Botao only (sem dropzone visivel) | Input colapsado (icone) | Card sem data relativa |
| **<768px** | 2 colunas | Botao only | Input colapsado (icone) | Card: apenas thumbnail + nome |

---

## 11. Notas Tecnicas

### API endpoints usados
- `GET /api/assets?limit=20&offset=0` — Lista paginada
- `POST /api/assets/upload` — Upload (multipart/form-data: `file`, `name`, `type`)
- `DELETE /api/assets/:id` — Deletar asset

### Upload flow
1. Usuario seleciona/arrasta arquivo(s)
2. Frontend detecta tipo pelo MIME type
3. Frontend envia `POST /api/assets/upload` para cada arquivo
4. Backend salva no MinIO + registra no PostgreSQL
5. Frontend atualiza grid com novo asset

### Thumbnails (futuro)
- Videos: extrair primeiro frame via ffprobe no momento do upload (backend job)
- Audios: gerar waveform SVG (client-side ou backend)
- Por enquanto: placeholders com icone por tipo

### Tamanho maximo
- Configuravel via variavel de ambiente
- Default: 500MB por arquivo (limitado pelo MinIO/S3)
- Rate limit: 20 uploads por minuto

### Cache
- Lista de assets cacheada via React Query (staleTime: 30s)
- Invalidacao automatica apos upload ou delete

---

## 12. Componentes 21st.dev — Resumo

| Secao | Componente | Link | Uso |
|---|---|---|---|
| Busca de assets | Input (Search with Loader) | https://21st.dev/input | Input de busca debounced com loading spinner |
| Upload de arquivos | File Upload (animated) | https://21st.dev/file-upload | Dropzone com progress bars, thumbnails, animacoes |
| Grid de assets | Layout Grid | https://21st.dev/layout-grid | Grid responsivo com cards e thumbnails |
| Filtro por tipo | UltraQualityTabs | https://21st.dev/ultra-quality-tabs | Tabs acessiveis (Headless UI) para filtro All/Video/Audio/Text |
