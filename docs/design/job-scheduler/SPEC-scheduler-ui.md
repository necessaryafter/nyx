# Spec: `scheduler-ui` — Telas do Job Scheduler

> Módulo do mapa `capability-map.md`. Depende de `scheduler` (API) e usa `ai-keys` (lista de modelos) e `series-script` (preview).
> Status: rascunho para revisão.

## Objetivo

Copiar o **estilo** da tela de Jobs (cards, drawer lateral, badges de status, ações no cabeçalho) para três telas novas, sem criar linguagem visual nova. O usuário: cria o scheduler num formulário único; vê a lista com o estado do último disparo e o próximo; abre um scheduler e vê as execuções, cada uma abrindo suas partes com botão de download.

**Sucesso:** sem ler documentação, o usuário cria um scheduler de 4 partes, clica em "Rodar agora", acompanha as 4 partes ficarem prontas ao vivo e baixa as 4.

## Rotas e navegação

```
/schedulers          → SchedulersPage        (lista)         — protegida, com layout/sidebar
/schedulers/new      → SchedulerFormPage     (criar)         — protegida
/schedulers/:id/edit → SchedulerFormPage     (editar)        — protegida
/schedulers/:id      → SchedulerDetailPage   (execuções → partes → download)
```
Item novo na sidebar, logo abaixo de "Jobs": **Schedulers** (ícone `CalendarClock` do lucide). Mesmo componente de item dos demais.

## Telas

### 1. Lista — `SchedulersPage`
Espelho de `JobsPage`: grid de cards + busca por nome + botão primário "Novo scheduler".
Card mostra: nome, template (nome), formato ("4 partes × 1 min" ou "Único · 3 min"), cadência ("Toda segunda 09:00" / "Só manual"), próximo disparo relativo ("em 2 dias") ou "pausado", último disparo com `StatusBadge` da execução (pendente / gerando roteiro / renderizando / concluído / parcial / falhou) e progresso "3/4 partes".
Ações no card: abrir (clique), menu ⋯ com **Rodar agora**, **Pausar/Retomar**, **Editar**, **Excluir** (confirmação: "Os vídeos já gerados continuam em Jobs.").
Estado vazio: ilustração simples + "Nenhum scheduler ainda. Crie um pra gerar séries de vídeos sozinho." + botão.

### 2. Formulário — `SchedulerFormPage` (criar e editar, mesmo componente)
Página única com seções (não wizard — os campos são poucos e independentes):

1. **Nome** — input.
2. **Template** — seletor com os templates do usuário (`useTemplates`). Ao escolher, mostra abaixo o provider/voz/velocidade lidos do `NarrationSource` ("Narração: Edge TTS · pt-BR-AntonioNeural · +2%") e avisa em vermelho, desabilitando o envio, se o template tiver `SceneSource` ("Este template usa slots de cena; o scheduler só funciona com templates de fundo fixo.").
3. **Tema** — textarea (placeholder: "Ex.: histórias de traição no trabalho, contadas em primeira pessoa, com final surpreendente"). Contador 10–2000.
4. **Assets** — dois `AssetPicker` (já existe em `components/editor/`): fundo (video/image, múltiplo) e trilha (audio, múltiplo). Legenda: "Vazio = usa os do template."
5. **Formato** — toggle `Vídeo único` | `Em partes`. Único: campo minutos (0,5–10, passo 0,5). Partes: quantidade (2–10) e minutos por parte (0,5–10). Aviso amarelo se minutos > 3: "Shorts têm limite de 3 min."
6. **CTA** — input do texto das partes não-finais com chips clicáveis `{next}` `{n}` `{total}` e prévia ao vivo ("Curta e comente para a parte 2."); input opcional do texto da última parte. Oculto quando formato = único (mantém só o final).
7. **IA** — select de modelo via `useAiModels()`. Se o hook devolver 503, mostra "Configure sua chave do Gemini em Configurações → Integrações" com link. Botão secundário **Testar roteiro** → `POST /api/ai/series-script` → abre drawer com as partes e contagem de palavras (não salva nada).
8. **Agendamento** — select de cadência: `Só manual` · `Diário às HH:mm` · `Semanal (dia + HH:mm)` · `Personalizado (cron)`. Gera `cronPattern` a partir dos presets; o campo cron aparece só no personalizado. Timezone enviada automaticamente (`Intl.DateTimeFormat().resolvedOptions().timeZone`), mostrada em cinza. Checkbox **Rodar agora ao salvar** (só na criação).
9. **Rodapé fixo** — estimativa em tempo real via `GET /api/schedulers/estimate` ("4 partes · ~150 palavras cada · ~60 créditos por execução · saldo atual 9.850") e botão **Criar scheduler** / **Salvar**.

Validação no cliente espelha o Zod da API (mesmos limites); erros da API (400 `details`) aparecem por campo.

### 3. Detalhe — `SchedulerDetailPage`
Cabeçalho: nome, template, formato, cadência, próximo disparo; botões **Rodar agora**, **Pausar/Retomar**, **Editar**, **Excluir**.
Lista de **execuções** (mais recente primeiro), cada linha: data, origem (manual/agendado), `StatusBadge`, título da história, progresso "2/4". Clique expande:
- **Partes**: linha por parte — "Parte 1", status do job (badge igual ao de Jobs), duração, botão **Baixar** (`useJobDownload(jobId)`), botão **Ver job** (link para `/jobs` com drawer aberto) e **Tentar novamente** quando `failed` (usa `useRetryJob`).
- **Baixar todas** — dispara os downloads das partes `done` em sequência (sem zip na v1).
- **Roteiro** — accordion com o texto de cada parte e contagem de palavras.
- Erro da execução, quando houver, em caixa vermelha com "Copiar erro" (mesmo padrão do drawer de Jobs).
Atualização ao vivo: `useSchedulersWebSocket()` escuta `run:status` e `job:status` e invalida `["schedulers", id]`.

## Estrutura

```
web/src/pages/SchedulersPage.tsx
web/src/pages/SchedulerFormPage.tsx
web/src/pages/SchedulerDetailPage.tsx
web/src/components/schedulers/SchedulerCard.tsx
web/src/components/schedulers/RunStatusBadge.tsx
web/src/components/schedulers/RunRow.tsx          (execução + partes expansíveis)
web/src/components/schedulers/CadencePicker.tsx   (presets → cronPattern)
web/src/components/schedulers/CtaInput.tsx        (chips + prévia)
web/src/hooks/useSchedulers.ts                    (useSchedulers, useScheduler, useCreateScheduler, useUpdateScheduler,
                                                   useRunScheduler, usePauseScheduler, useResumeScheduler,
                                                   useDeleteScheduler, useSchedulerEstimate, useSchedulersWebSocket)
web/src/hooks/useAiModels.ts                      (vem de ai-keys)
web/src/lib/types.ts                              (+ Scheduler, SchedulerRun, RunPart, SeriesScript)
web/src/App.tsx                                   (+ 4 rotas)
web/src/components/layout/Sidebar*.tsx            (+ item)
```

## Contratos consumidos (da API do `scheduler`)

```ts
interface Scheduler {
  id: string; name: string; templateId: string; templateName: string; theme: string;
  assetIds: string[]; musicAssetIds: string[];
  mode: "single" | "parts"; totalMinutes: number | null; partsCount: number | null; minutesPerPart: number | null;
  ctaTemplate: string; finalCtaTemplate: string | null;
  aiProvider: "gemini"; aiModel: string;
  cronPattern: string | null; timezone: string; enabled: boolean;
  lastRunAt: string | null; nextRunAt: string | null; createdAt: string; updatedAt: string;
}
type RunStatus = "pending" | "scripting" | "rendering" | "done" | "partial" | "failed";
interface SchedulerRun { id: string; status: RunStatus; triggeredBy: "manual" | "schedule"; title: string | null; partsTotal: number; partsDone: number; error: string | null; createdAt: string; completedAt: string | null; parts: RunPart[]; }
interface RunPart { jobId: string; partIndex: number; status: JobStatus; durationSeconds: number | null; hasVideo: boolean; }
```

## Estilo

```tsx
// padrão de hook (igual useJobs.ts)
export function useRunScheduler(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ runQueued: true }>(`/api/schedulers/${id}/run`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedulers"] }),
  });
}
```
Reusar `StatusBadge`, `Button`, drawer e classes `nyx-*` das telas atuais. Textos em pt-BR, curtos, sem exclamação. Mapa de rótulos de status da execução: pendente · gerando roteiro · renderizando · concluído · parcial · falhou.

## Testes

- `bunx tsc -b` e `bun run lint` verdes.
- Unit (bun:test, sem DOM) para as funções puras extraídas: `cadenceToCron({ kind: "daily", time: "09:00" })` → `"0 9 * * *"`; semanal segunda → `"0 9 * * 1"`; `formatSpeedPct`-like para formato ("4 partes × 1 min"); `applyCtaPreview`.
- Checklist manual (anexar no PR): criar → lista mostra card → rodar agora → detalhe atualiza ao vivo → baixar parte → pausar (próximo disparo vira "pausado") → editar tema → excluir (jobs seguem em Jobs).

## Limites específicos

- **Sempre:** reaproveitar `AssetPicker`, `StatusBadge`, `useJobDownload`, `useRetryJob`; manter os três caminhos de criação de job existentes intocados.
- **Perguntar antes:** adicionar biblioteca (ex.: de cron builder ou de zip); redesenhar cards/drawer.
- **Nunca:** chamar Gemini direto do navegador (sempre via API); guardar a chave no front.

## Critérios de sucesso

1. Todas as ações do usuário-exemplo (criar 4 partes × 1 min → rodar → ver 4 partes → baixar 4) acontecem sem sair das telas deste módulo, exceto o clique em "Ver job".
2. Estimativa de créditos exibida bate com o que a execução cobra.
3. Template com `SceneSource` não pode ser escolhido (aviso + envio desabilitado).
4. Sem chave Gemini, o formulário orienta a ir em Integrações em vez de falhar ao salvar.
5. Estado da execução muda na tela sem recarregar (WS).

## Questões abertas

1. "Baixar todas" sem zip abre N downloads seguidos — o navegador pode pedir permissão para múltiplos downloads. Aceitável na v1?
2. Mostrar os jobs de scheduler também na tela de Jobs (com etiqueta "Parte 2/4 · <nome do scheduler>") ou esconder de lá? Proposta: mostrar com etiqueta — é o comportamento natural de "é um job".
