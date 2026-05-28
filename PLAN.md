# Arquitetura Nyx V2: Blueprint com Event Triggers

## Summary

Implementar a nova arquitetura como `Graph version: 2`, mantendo o fluxo operacional atual: template/job em JSONB, fila BullMQ com `{ jobId }`, renderer buscando o job no banco e gerando o vídeo final. A mudança principal fica dentro do contrato do grafo e do renderer: nodes deixam de ser apenas um DAG de arquivos e passam a declarar fontes, eventos e ações aplicadas sobre uma timeline.

Decisões fechadas:

- Canvas continua em modelo **Fluxo + Eventos**.
- Reset MVP: templates antigos não precisam ser compatíveis.
- Eventos core: **tempo, fala e cena**.
- Ações core: **visual, áudio e texto**.
- Geração por IA acontece **pré-render**, não durante o render final.
- `RenderPlan` será **compilado internamente no renderer**, sem novo contrato público inicial.

## Key Changes

- Criar `GraphV2` com nodes classificados em:
  - `source`: narração, assets, cenas, mídia gerada/preparada.
  - `event`: `OnTime`, `OnWord`, `OnSentence`, `OnSilence`, `OnSceneStart`, `OnSceneEnd`.
  - `action`: `SetMedia`, `ShowOverlay`, `SetSubtitleStyle`, `PlaySfx`, `SetMusic`, `CameraEffect`.
  - `output`: `Render`.
- Manter `templates.graph` e `jobs.graph`, mas validar somente `version: 2` após o reset.
- Manter `{ jobId }` na fila `render`; o renderer continua responsável por buscar job, resolver assets e produzir/uploadar o vídeo.
- Substituir o runtime topológico atual por duas fases internas:
  - `prepareGraphV2`: resolve assets, áudio, timestamps, cenas automáticas e overrides.
  - `renderTimeline`: avalia event/action rules, monta tracks e executa FFmpeg.
- Criar tipos internos no renderer:
  - `EventTimeline`: lista normalizada de eventos com `type`, `startMs`, `endMs`, `payload`.
  - `RenderAction`: ação resolvida com `kind`, `target`, `startMs`, `endMs`, `params`.
  - `RenderPlan`: settings finais, assets resolvidos, events, actions e tracks.
- Cenas v2:
  - padrão: segmentação automática por parágrafos quando houver roteiro estruturado;
  - fallback: pausas longas nos timestamps;
  - override: usuário/IA pode ajustar mídia por cena antes do render.
- Editor web:
  - adicionar nodes de evento conectáveis a nodes de ação;
  - propriedades detalhadas ficam no painel lateral do node selecionado;
  - presets de gênero serão apenas templates prontos em cima do mesmo motor, não lógica especial.

## Interfaces

- `GraphV2` mínimo:
  - `version: 2`
  - `nodes: BlueprintNode[]`
  - `edges: BlueprintEdge[]`
  - `settings: { width, height, fps, format }`
- Event nodes emitem eventos, não arquivos.
- Action nodes não executam isoladamente; eles declaram efeitos aplicados quando o evento conectado dispara.
- Um edge `event -> action` significa: "quando este evento ocorrer, execute esta ação".
- Um edge `source -> action` fornece asset/configuração usada pela ação.
- O renderer compila tudo para `RenderPlan` em memória; persistência do plano compilado fica fora do MVP, salvo se debug exigir depois.

## Implementation Plan

- Backend:
  - trocar schemas Zod de graph v1 para graph v2;
  - remover validações específicas de handles antigos;
  - manter rotas de templates/jobs e fluxo staged, ajustando validação para blueprint v2;
  - no reset MVP, aceitar que templates existentes v1 falhem validação ou sejam apagados por script manual.
- Renderer:
  - criar módulo `blueprint/` com tipos, validação estrutural e compilador v2;
  - manter worker, BullMQ, MinIO, Sentry e lifecycle de job;
  - implementar `prepareGraphV2` para áudio, timestamps, cenas e asset resolution;
  - implementar avaliação determinística dos event nodes;
  - gerar tracks finais e filtros FFmpeg a partir das actions.
- Web:
  - atualizar tipos espelhados para graph v2;
  - substituir palette atual por categorias `Sources`, `Events`, `Actions`, `Output`;
  - criar componentes visuais genéricos para event/action nodes;
  - validar no editor que todo blueprint tenha `Render` e pelo menos uma fonte visual ou ação visual capaz de produzir imagem.

## Test Plan

- Backend:
  - valida `GraphV2` válido;
  - rejeita edge incompatível entre evento/ação;
  - cria template/job v2;
  - staged job mantém estados atuais.
- Renderer:
  - compila eventos por palavra, frase, silêncio e cena;
  - aplica ação visual em `OnSceneStart`;
  - aplica SFX em `OnWord`;
  - aplica legenda/estilo em eventos de fala;
  - falha explicitamente quando asset exigido não existe.
- E2E:
  - blueprint simples com narração + cenas automáticas + mídia por cena;
  - blueprint de short com overlay/SFX disparado por palavra;
  - blueprint educacional com troca de imagem por cena;
  - render final gera arquivo, faz upload e marca job `done`.

## Assumptions

- Não haverá compatibilidade obrigatória com templates v1.
- `RenderPlan` começa como tipo interno do renderer, não novo campo no banco.
- Providers de IA geram assets antes do render final.
- Eventos semânticos avançados como emoção, tópico, entidade e beat musical ficam fora do núcleo inicial.
- A arquitetura deve suportar múltiplos gêneros por composição de eventos e ações, não por branches específicos no renderer.
