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

## Deploy (VPS única com Docker)

1. DNS: aponte `DOMAIN` e `s3.DOMAIN` (registros A) para a VPS. Portas 80/443 abertas.
2. `cp .env.prod.example .env.prod` e preencha (segredos com `openssl rand -base64 32`).
3. Login é só via OAuth: configure Google e/ou Discord com callback
   `https://DOMAIN/api/auth/callback/google` (ou `/discord`, que também vai em `DISCORD_REDIRECT_URI`).
4. `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build`

O Caddy emite o HTTPS, serve o front e faz proxy de `/api` (inclusive WebSocket) para o backend.
As migrations rodam sozinhas no serviço `migrate`. O WhisperX pede ~4 GB de RAM; recomendo uma VPS com 8 GB ou mais.
