# Guia de Montagem de Templates

O editor funciona como um **grafo de fluxo**: cada node faz uma coisa, e você conecta as saídas de um node às entradas de outro. O resultado final é sempre o node **Render**.

---

## Nodes disponíveis

### Fontes (produzem mídia)

| Node | O que faz | Saída |
|---|---|---|
| **MediaPool** | Pool de vídeos/áudios/imagens fixos do template | `items` |
| **SceneSlot** | Slot vazio — o usuário escolhe o vídeo na hora de renderizar | `items` |
| **TTS** | Gera narração em áudio a partir de texto | `audio`, `timestamps` |

### Processamento

| Node | O que faz | Entradas | Saída |
|---|---|---|---|
| **VideoFit** | Monta os vídeos em sequência até cobrir a duração do áudio | `intro`, `items`, `audio` | `video` |
| **Subtitle** | Gera legendas karaokê sincronizadas com a narração | `timestamps` | `filter` |

### Efeitos (conectam ao VideoFit)

| Node | O que faz | Saída |
|---|---|---|
| **Transition** | Transição entre clipes (fade, wipe, etc.) | `effect` |
| **Zoom** | Zoom-in/out suave em todos os clipes | `effect` |
| **Shake** | Camera shake em todos os clipes | `effect` |

### Composição

| Node | O que faz | Entradas | Saída |
|---|---|---|---|
| **Layer** | Sobrepõe camadas (base + elementos visuais) | `base`, `overlay` | `video` |
| **Overlay** | Imagem ou vídeo posicionado com timing | — | `overlay`, `sfx` |

### Output

| Node | O que faz | Entradas |
|---|---|---|
| **Render** | Mixa tudo e gera o arquivo final | `video`, `audio`, `music`, `sfx` |

---

## Regras básicas

1. **Todo template precisa de um Render** — é a saída final.
2. **O VideoFit precisa de `audio`** — ele usa a duração do áudio para saber quando parar de adicionar clipes.
3. **MediaPool e SceneSlot nunca recebem conexões** — só produzem.
4. **Efeitos (Transition/Zoom/Shake) conectam na entrada `effects` do VideoFit** — não no Render.

---

## Receitas prontas

### Template mínimo (só vídeo + narração)

```
MediaPool(video) ──► items ──► VideoFit ──► video ──► Render
TTS ──────────────── audio ──► VideoFit
TTS ──────────────────────────────────── audio ──► Render
```

**Quando usar:** teste rápido, conteúdo simples sem legenda.

---

### Com legenda karaokê

```
MediaPool(video) ──► items ──► VideoFit ──► video ──► Layer ──► video ──► Render
TTS ──────────────── audio ──► VideoFit
TTS ──► timestamps ──────────────────── Subtitle ──► overlay ──► Layer
TTS ──────────────────────────────────────────────────────────── audio ──► Render
```

**Quando usar:** vídeos estilo Reddit/narração — legenda aparece sincronizada com a voz.

> **Nota:** o `Layer` junta a base (o vídeo do VideoFit) com o overlay (as legendas). Sem Layer, as legendas não aparecem.

---

### Com música de fundo

```
MediaPool(video) ──► items ──► VideoFit ──► video ──► Layer ──► video ──► Render
MediaPool(audio) ──► items ──────────────────────────────────── music ──► Render
TTS ──────────────── audio ──► VideoFit
TTS ──► timestamps ──────────── Subtitle ──► overlay ──► Layer
TTS ──────────────────────────────────────────────────── audio ──► Render
```

**Quando usar:** a narração entra em `audio` do Render, a música em `music`. O Render mixa os dois com volume configurável.

> Use **dois MediaPool separados**: um com `assetType: video` (para o VideoFit) e outro com `assetType: audio` (para a música no Render).

---

### Com intro do cliente (SceneSlot)

```
SceneSlot ───────── intro ──┐
MediaPool(video) ── items ──┼──► VideoFit ──► video ──► Layer ──► video ──► Render
TTS ──────────────── audio ──┘
TTS ──► timestamps ──────────── Subtitle ──► overlay ──► Layer
TTS ──────────────────────────────────────────────────── audio ──► Render
```

**Quando usar:** o criador define um slot ("Cena principal") e o usuário faz upload do próprio vídeo antes de renderizar. O vídeo do SceneSlot toca **primeiro** (intro), depois os clipes do MediaPool preenchem o tempo restante.

> O SceneSlot aparece vazio no template. O usuário seleciona o asset na página de renderização (`/render/:templateId`).

---

### Com efeitos visuais

```
MediaPool(video) ──► items ──► VideoFit ──► video ──► Render
TTS ──────────────── audio ──► VideoFit
TTS ──────────────────────────────────── audio ──► Render
Transition ─────────────────► effects ──► VideoFit
Zoom ───────────────────────► effects ──► VideoFit
Shake ──────────────────────► effects ──► VideoFit
```

**Quando usar:** Transition adiciona transições entre clipes. Zoom aplica zoom-in/out suave. Shake aplica camera shake. Podem ser usados juntos ou separados.

> Todos os efeitos conectam na mesma entrada `effects` do VideoFit.

---

### Com overlay de partículas/SFX

```
MediaPool(video) ──► items ──► VideoFit ──► video ──► Layer ──► video ──► Render
Overlay ───────────────────────────────────────────── overlay ──► Layer
Overlay ───────────────────────────────────────────────────── sfx ──► Render
TTS ──────────────── audio ──► VideoFit
TTS ──────────────────────────────────────────────────────── audio ──► Render
```

**Quando usar:** sobrepor um vídeo de partículas, fogo, chuva etc. Use `blendMode: screen` no Overlay para que o fundo preto do arquivo de partículas desapareça (screen blend torna preto transparente).

---

## Perguntas frequentes

**Q: Posso ter dois VideoFit no mesmo template?**
Sim, mas cada um precisa do seu próprio `audio` de referência e produz um `video` independente. Você teria que juntar os dois num Layer ou num segundo Render — o que rapidamente complica. Para a maioria dos casos, um VideoFit é suficiente.

**Q: Posso conectar vários MediaPool no mesmo VideoFit?**
Sim. Múltiplos MediaPool conectados ao mesmo handle `items` viram um pool único — os clipes são misturados juntos antes de aplicar o modo (random-loop, sequential, etc.).

**Q: Qual a diferença entre `audio` do Render e `music` do Render?**
- `audio`: a narração (voz). Volume fixo em 100%.
- `music`: trilha de fundo. Volume configurável no Render (`musicVolume`, padrão 15%).

**Q: O que acontece se o SceneSlot estiver vazio ao renderizar?**
O job falha com erro `SceneSlot "nome": nenhum asset fornecido`. O usuário precisa obrigatoriamente selecionar um asset antes de renderizar.

**Q: Posso usar SceneSlot sem MediaPool (só a cena do usuário, sem clips de fundo)?**
Sim. Conecte o SceneSlot em `items` (não em `intro`) e use o modo `once` no VideoFit — ele usa o vídeo uma vez e para, sem repetir.
