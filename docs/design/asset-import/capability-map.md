# Mapa de Capacidades — Importação com Corte Automático de Vídeo

> Status: **rascunho para revisão**. Nada abaixo foi implementado. Fase atual: SPECIFY.
> Próximas fases (PLAN → TASKS → IMPLEMENT) só começam depois da aprovação deste mapa e das specs por módulo.

## Contexto

Hoje, subir um asset de vídeo pra usar como fundo de template é 1 upload = 1 asset, do tamanho que a pessoa mandar. Na prática, o usuário costuma ter um vídeo longo (às vezes baixado de fora, ex. um compilado de gameplay) que já contém vários clipes distintos colados um atrás do outro. Hoje ele precisa cortar isso na mão (foi o que eu fiz manualmente com `ffmpeg` pro vídeo de parkour, no início do projeto).

## Objetivo

Usuário sobe **um vídeo só**, o sistema:
1. Detecta onde há corte de cena (mudança abrupta de um clipe pro outro dentro do vídeo enviado).
2. Recorta cada trecho detectado, já convertido pro formato vertical (1080×1920) que os templates usam.
3. Mostra uma prévia dos trechos (miniatura + duração) pra pessoa escolher quais valem a pena.
4. Confirmado, cada trecho vira um **asset normal** — agrupados visualmente na tela de Assets (grupo expansível), pra saber de qual vídeo original vieram.

## Decisões já tomadas com o usuário

| Pergunta | Decisão |
|---|---|
| Vídeo sem corte de cena detectável (gravação contínua)? | **Pergunta na hora** — avisa que não achou corte e deixa escolher entre dividir em pedaços de tamanho fixo ou manter como um asset só. |
| Resolução do recorte? | **Já converte na importação** pra 1080×1920 (corta o centro, mesma lógica que já uso manualmente). |
| Importa direto ou revisa antes? | **Mostra prévia** (miniatura + duração de cada trecho) antes de confirmar. |
| Como agrupar na tela de Assets? | **Grupo expansível** — um item representando o vídeo original, expande e mostra os N cortes dentro. Não é uma pasta navegável separada. |

## Módulos

| Módulo | Responsabilidade | Depende de |
|---|---|---|
| `scene-detection` | Função pura: dado um arquivo de vídeo, devolve a lista de cortes detectados (`{startMs, endMs}[]`) — usa o filtro de detecção de cena do próprio ffmpeg, sem serviço novo | — |
| `asset-import` | Tabela(s) de lote de importação, fila BullMQ + worker (detecta → recorta → miniatura), API REST (upload, status, confirmar seleção) | `scene-detection` |
| `assets-ui` | Botão de importar vídeo longo, tela de prévia/seleção dos cortes, grupo expansível na lista de Assets | `asset-import` |

**Ordem de construção:** `scene-detection` → `asset-import` → `assets-ui`

Cada módulo tem sua spec: `SPEC-scene-detection.md`, `SPEC-asset-import.md`, `SPEC-assets-ui.md`. Este arquivo é o índice.

Sem ciclos: a UI só fala com a API do `asset-import`; o `asset-import` só chama funções do `scene-detection`.

## Suposições gerais (corrija se estiver errado)

1. **O download continua manual.** O sistema não baixa do YouTube — a pessoa baixa por fora (como já faz) e sobe o arquivo local. Evita automatizar algo contra os termos do YouTube, e é bem mais simples.
2. **Detecção via ffmpeg puro**, sem lib/serviço novo: o filtro `scdet`/`select='gt(scene,THRESH)'` já embutido no ffmpeg compara frame a frame e aponta onde a cena muda bruscamente — não é IA, é comparação de pixel/histograma. Funciona bem pra cortes abruptos (edição de vídeo colada); **não** detecta "5 histórias diferentes narradas sobre o mesmo fundo contínuo" — isso não é um corte de cena, é conteúdo diferente sobre o mesmo vídeo, e foge do que detecção de cena resolve.
3. **Limites de upload:** até 2h de duração e 2GB de tamanho (mesma faixa do upload em chunks que os assets já suportam). Acima disso, rejeita com mensagem clara.
4. **Corte mínimo:** trechos menores que ~1,5s são descartados automaticamente antes mesmo da prévia (evita flash/transição virando "corte" inútil).
5. **Fallback de tamanho fixo** (quando não há corte e o usuário escolhe dividir mesmo assim): pedaços de 45s, ajustável só nesse fluxo, não é uma configuração salva.
6. **Áudio original é descartado** nos recortes — hoje o render nunca usa o áudio de um `AssetSource` de vídeo (só usa o vídeo, o áudio vem de `NarrationSource`/`MusicSource`), então manter o áudio original só ocupa espaço à toa.
7. **Miniatura por trecho:** 1 frame extraído do meio de cada corte, só pra prévia — não vira um asset por si.
8. **Processamento é assíncrono** (fila BullMQ, como os jobs de render) — decodificar um vídeo inteiro pra detectar cena é pesado, a tela não trava esperando.
9. **O "grupo expansível" é só uma coluna a mais** (`importBatchId` nos assets), não uma reestruturação da tabela de assets em árvore de pastas de verdade.
10. **Câmera/aspecto de origem variado:** o vídeo enviado pode ser horizontal, vertical ou quadrado — o recorte pro formato vertical sempre corta o centro (mesma lógica geométrica que já uso na prática), então cabe pra qualquer proporção de entrada.
