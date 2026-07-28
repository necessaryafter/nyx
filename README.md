# Nyx

> **⚠️ Projeto arquivado — não é mais mantido.**
> O desenvolvimento foi encerrado e o repositório permanece arquivado (somente leitura) no GitHub.
> O código continua público para consulta e reuso, mas não haverá novos commits, correções,
> releases nem resposta a issues ou pull requests. Faça um fork se quiser continuar de onde parou.

Editor de vídeo autônomo: em vez de timeline manual, você monta uma **blueprint** de nodes
com eventos temporais (`On Word`, `On Sentence`, `On Scene Start`, …) e cada evento dispara
ações de edição — legenda, efeito sonoro, corte de cena, overlay, movimento de câmera.

A mesma blueprint é reutilizada para produzir milhares de vídeos diferentes, cada um com sua
narração e seus assets. O foco é produção em escala, não edição artesanal.

## Estrutura

| Diretório | O que faz |
|---|---|
| `backend/` | API (Elysia/Bun): auth, assets, templates, jobs, créditos |
| `renderer/` | Worker (BullMQ): compila a blueprint em um plano e renderiza via ffmpeg |
| `web/` | Front-end (React + React Flow): editor de blueprint, dashboard, wizard de jobs |
| `whisperx-service/` | Transcrição e timestamps por palavra para áudio enviado pelo usuário |

Documentação de contexto do produto em [`CONTEXT.md`](CONTEXT.md), [`PRODUCT.md`](PRODUCT.md)
e [`PLAN.md`](PLAN.md).

## Estado

O que existe é a v2: pipeline completo de narração → timestamps → compilação da blueprint →
render → entrega, com upload em chunks para assets grandes, retry de jobs que falharam e
import/export de templates em `.nyx.json`. Não é um produto acabado nem foi endurecido para
produção — trate como base de estudo ou ponto de partida.
