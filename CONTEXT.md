# O que é "Nyx"?
O Nyx é um editor de vídeo autônomo que permite você automatizar a criação de conteúdo através de conteúdo gerado por IA (imagens e edição completamente feito por inteligência artificial).

## Diferencial do Nyx
Diferente de editores tradicionais, o Nyx não é focado em timeline manual.

O foco do sistema é transformar edição em automação programável baseada em eventos.

A Blueprint funciona como uma "engine de conteúdo", permitindo reutilizar a mesma lógica para milhares de vídeos diferentes.

## Filosofia do Produto
O Nyx foi criado para transformar edição de vídeo em um pipeline automatizado de execução.

A ideia principal não é substituir editores tradicionais como Premiere ou DaVinci Resolve, mas permitir a criação de vídeos em larga escala através de automações orientadas por eventos.

O foco do produto é:
- Escalabilidade
- Automação
- Reutilização
- Modularidade
- Produção em massa
- Conteúdo orientado por IA

## Sistema de Eventos
O sistema inteiro do Nyx é baseado em eventos temporais.

Exemplos:
- On Word
- On Sentence
- On Beat
- On Silence
- On Emotion
- On Scene Start
- On Scene End

Cada evento pode disparar múltiplas ações simultaneamente.

## Objetivo Técnico
O objetivo técnico do Nyx é permitir a geração de vídeos complexos sem necessidade de edição manual.

O sistema foi projetado para:
- Produção em larga escala
- Execução distribuída
- Renderização paralela
- Reutilização de blueprints
- Baixo custo operacional

## Como ele funciona?
O usuário precisa configurar uma "Blueprint", responsável por definir as configurações da edição e renderização do vídeo. Dentro da blueprint, é inspirado na utilização do N8N, sendo completamente baseado em **Nodes** com events e triggers para cada tipo de ação. Ex: 
- `New Scene Event` -> `Trigger` (Trigger = Faça alguma coisa! Defina legenda, toque um efeito sonoro ou algo mais simples)
- `On Word Event` -> `Trigger` (Trigger = Faça alguma coisa! Defina legenda, toque um efeito sonoro ou algo mais simples)

Após o usuário definir as configurações da Blueprint, ela poderá ser utilizada para construir novos vídeos para os usuários. 

## Como funciona a geração de vídeos?
Os vídeos são gerados de forma independente pelo nosso sistema utilizando as seguintes bibliotecas e serviços externos:

### Para geração de áudio:
O áudio é gerado utilizando o serviço da **Talkify** (https://talkifydev.com/) ou através de upload realizado pelo próprio usuário. A talkify gera o timestamp de cada palavra, mas no caso do áudio uploadado, essa função fica com o `whisperx-service`.

### Para a geração de imagens:
As imagens são geradas utilizando um provider de geração de imagens grátis (https://huggingface.co/spaces/mrfakename/Z-Image-Turbo) mas é planejado futuramente adicionar outros métodos de geração de imagens como o Nano Banana Pro e outros tipos, mas para o MVP somente o Z-Image-Turbo estará disponível.

### Para a geração de legendas:
As legendas são feitas pelo próprio `ffmpeg` com os timestamps e STT (Speech-To-Text) feito pelo `whisperx-service`.

## Providers
O Nyx utiliza providers desacoplados para geração de conteúdo.

Cada provider implementa interfaces específicas:
- Image Generation Provider
- Audio Provider
- STT Provider
- Rendering Provider

Isso permite substituir serviços externos sem alterar o funcionamento interno do sistema.

## Render Service
O `ffmpeg` roda dentro de um microsserviço separado chamado `renderer`.

Esse serviço é responsável por:
- compor cenas;
- aplicar legendas;
- aplicar efeitos visuais/sonoros;
- processar áudio;
- gerar o arquivo final do vídeo.

O backend principal não executa renderização diretamente.

## Armazenamento de Assets

Os assets são armazenados em object storage.

Ambiente de desenvolvimento:
- MinIO

Ambiente de produção:
- Cloudflare R2

Assets incluem:
- imagens geradas;
- áudios;
- arquivos intermediários;
- vídeos renderizados;
- thumbnails;
- metadados necessários para renderização.

## Render Worker

O fluxo de renderização funciona assim:

Backend -> Renderer -> R2 -> Backend

1. O backend cria um job de renderização.
2. O job é enviado para uma fila BullMQ.
3. O serviço `render` consome o job.
4. O vídeo é processado com `ffmpeg`.
5. O resultado final é enviado para o Cloudflare R2.
6. O backend recebe/consulta o status final do job.

## Filas

O Nyx utiliza BullMQ para processamento assíncrono.

Filas previstas:
- geração de áudio;
- transcrição/STT;
- geração de imagens;
- renderização;
- pós-processamento;
- upload de assets.

## Cache e Fallback

Cache de imagens, retry inteligente de providers e fallback automático entre providers não fazem parte do MVP inicial.

Essas funcionalidades podem ser adicionadas futuramente para reduzir custos, melhorar estabilidade e evitar falhas em cadeia.

## Observabilidade e Erros

Erros críticos do sistema são enviados para o Sentry.

O Sentry será usado para:
- capturar exceptions;
- rastrear falhas em jobs;
- identificar erros de renderização;
- monitorar falhas em providers externos;
- facilitar debug em produção.

## Escopo do MVP

O MVP do Nyx será focado em validar o pipeline principal de geração automatizada de vídeos.

Incluído no MVP:
- Blueprint baseada em nodes;
- geração de áudio;
- geração de imagens com Z-Image-Turbo;
- STT com WhisperX;
- legendas via ffmpeg;
- renderização via microsserviço `render`;
- filas com BullMQ;
- armazenamento via MinIO/R2;
- monitoramento de erros via Sentry.

Fora do MVP:
- cache avançado de assets;
- fallback automático entre providers;
- marketplace;
- plugins externos;
- colaboração em tempo real;
- múltiplos providers de imagem.
