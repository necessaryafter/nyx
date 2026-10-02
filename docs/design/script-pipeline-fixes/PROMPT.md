# Prompt para implementação (usar em outra sessão)

Cole isto numa nova sessão do Claude Code, na raiz do repo `nyx`, branch `slayer`.

```
Implemente os 3 fixes já especificados em docs/design/script-pipeline-fixes/SPEC.md
(fase Specify já concluída, Open Questions já respondidas: item 1 = bug ocorreu
DEPOIS do fix de WrapStyle de ontem; item 2 = sanitização sempre ligada, sem toggle).

Ative o plugin/skill ponytail full: root-cause, menor diff possível, sem abstração
não pedida, sem código morto, teste mínimo (self-check) só onde tem lógica real.

ITEM 1 — legenda pulando no início de parágrafo
  Status: inconclusivo. Frames extraídos de /home/diegoeduardo/Downloads/output(16).mp4
  (voz pt-BR-AntonioNeural, a única que o usuário usa) em pontos de início de trecho
  não mostraram pulo óbvio — pode já estar resolvido pelo WrapStyle:2 (commit e131803),
  ou ser um pulo pequeno demais pra ver em frame estático.
  Antes de codar: gerar um render de teste real com um texto de 2 parágrafos (pedir
  pro usuário o exemplo se não estiver disponível), voz AntonioNeural, preset "reddit"
  (highlightColor + wordsPerGroup:2 + position:center), e OLHAR RODANDO (não frame a
  frame) especificamente na transição entre parágrafos. Só mexer em
  renderer/src/ffmpeg/filters/subtitle.ts se achar causa nova confirmada em código.
  Se não reproduzir: marcar como resolvido, não inventar fix pra bug que não existe.

ITEM 2 — TTS falando símbolos/markdown (ex.: "*" → "asterisco")
  Local certo: renderer/src/tts/base.provider.ts (hoje classe abstrata vazia).
  Virar synthesize() em método concreto que sanitiza o texto e delega pra
  doSynthesize() abstrato — assim cobre renderer/src/audioWorker.ts (fila) E
  renderer/src/prepare/audio.ts (chamada direta do editor), sem duplicar nada.
  EdgeTTSProvider e TalkifyProvider passam a implementar doSynthesize() em vez de
  synthesize().
  Sanitizar (remove o símbolo, mantém o texto, não "traduz"): * ** _ __ # (início de
  linha) ` ~~ > (início de linha) e [texto](url) → texto.
  Sempre ligado, sem flag de config.
  Teste: self-check novo (renderer/test/*.selfcheck.ts) com casos reais de cada símbolo
  + um caso sem símbolo nenhum pra garantir que não quebra o texto normal.

ITEM 3 — última parte falar "Parte final" (configurável)
  backend/src/database/schema/schedulers.ts       → + coluna finalPartLabel (text,
                                                        not null, default 'Parte final.')
  backend/src/lib/schemas.ts                       → + campo no schema do scheduler
  backend/src/lib/ai/seriesScript.ts (assembleParts) → parte 1: cleanTitle
                                                        parte 2..N-1: cleanTitle + " Parte {n}."
                                                        parte N (última, N>1): cleanTitle + " " + finalPartLabel
  backend/src/routes/schedulers.ts                 → repassa o campo novo
  web/src/pages/SchedulerFormPage.tsx              → campo novo do lado de ctaTemplate/
                                                        finalCtaTemplate, mesmo componente CtaInput
  web/src/hooks/useSchedulers.ts, web/src/lib/types.ts → tipos (SchedulerInput, Scheduler)
  Migration: bun run db:generate + scripts/migrate.ts, default garante compatibilidade
  com schedulers existentes.
  Teste: estender teste existente de assembleParts (ou criar um pequeno) cobrindo a
  última parte com finalPartLabel customizado e com o default.

Ordem sugerida: item 3 primeiro (sem ambiguidade, isolado), item 2 depois (também
isolado), item 1 por último (depende de confirmação visual antes de codar qualquer
coisa — pode terminar sem exigir mudança de código nenhuma).

Rodar bunx tsc --noEmit em backend/renderer/web depois de cada item.
```
