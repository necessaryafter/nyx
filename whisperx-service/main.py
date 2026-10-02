import json
import os
import tempfile
import whisperx
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import JSONResponse

MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
DEVICE = "cpu"
COMPUTE_TYPE = "int8"
LANGUAGE = "pt"

state: dict = {"model": None, "align_model": None, "align_metadata": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"Loading WhisperX model '{MODEL_NAME}'...")
    state["model"] = whisperx.load_model(
        MODEL_NAME, DEVICE, compute_type=COMPUTE_TYPE, language=LANGUAGE,
        vad_options={"vad_onset": 0.5, "vad_offset": 0.363},
    )

    print("Loading alignment model for Portuguese...")
    state["align_model"], state["align_metadata"] = whisperx.load_align_model(
        language_code=LANGUAGE, device=DEVICE
    )

    print("Models loaded and ready!")
    yield

    state["model"] = None
    state["align_model"] = None
    state["align_metadata"] = None


app = FastAPI(lifespan=lifespan)


def flatten_words(aligned: list[list[dict]], segs: list[dict], known: list[dict]) -> list[dict]:
    """Palavras alinhadas; as sem tempo (números, símbolos) herdam dos vizinhos em vez de sumirem.

    `aligned[i]` são as palavras da frase `known[i]`, alinhadas sozinhas na janela `segs[i]`
    (com padding de ±150ms). Cada frase é alinhada numa chamada própria porque o whisperx.align
    quebra um segmento em sentenças (`indo?", perguntei` vira duas) e a resposta deixa de ser
    1:1 com a entrada — casar por índice deslocava todas as frases seguintes e as palavras
    ficavam presas no limite da janela (legenda travada ou sumida).

    O padding ajuda a pegar uma palavra que comece um pouco antes/depois do limite estimado.
    Mas duas frases vizinhas com pausa menor que o padding total (300ms) teriam janelas
    sobrepostas, e a última palavra de uma invadiria a próxima — dois eventos de legenda ativos
    ao mesmo tempo (ver groupWords em subtitle.ts). Por isso o clamp é no limite ORIGINAL
    (sem padding) da frase vizinha, não no limite da própria janela com padding.
    """
    words = []
    for i, (seg_in, items) in enumerate(zip(segs, aligned)):
        lo = known[i - 1]["endMs"] / 1000 if i > 0 else seg_in["start"]
        hi = known[i + 1]["startMs"] / 1000 if i + 1 < len(known) else seg_in["end"]
        for j, w in enumerate(items):
            if "start" not in w or "end" not in w:
                prev_end = next((items[k]["end"] for k in range(j - 1, -1, -1) if "end" in items[k]), seg_in["start"])
                next_start = next((items[k]["start"] for k in range(j + 1, len(items)) if "start" in items[k]), seg_in["end"])
                w["start"] = prev_end
                w["end"] = max(next_start, prev_end + 0.08)
            w["start"] = max(w["start"], lo)
            w["end"] = min(max(w["end"], w["start"]), hi)
        for w in items:
            words.append({
                "word": w["word"].strip(),
                "startMs": round(w["start"] * 1000),
                "endMs": round(w["end"] * 1000),
            })
    return words


@app.get("/health")
def health():
    if state["model"] is None or state["align_model"] is None:
        raise HTTPException(status_code=503, detail="Models still loading")
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...), segments: str | None = Form(None)):
    if state["model"] is None:
        raise HTTPException(status_code=503, detail="Models not loaded yet")

    suffix = os.path.splitext(audio.filename or ".wav")[1] or ".wav"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(await audio.read())
        audio_path = f.name

    try:
        known = json.loads(segments) if segments else []
        if known:
            # Texto do roteiro já conhecido (TTS): só alinha os tempos, sem ASR.
            # Assim as palavras saem exatamente como escritas (ex.: "Reddit", não "Heddy").
            audio_data = whisperx.load_audio(audio_path)
            duration = len(audio_data) / 16000
            pad = 0.15
            known = [k for k in known if k.get("text", "").strip()]
            segs = [
                {
                    "text": k["text"],
                    "start": max(0.0, k["startMs"] / 1000 - pad),
                    "end": min(duration, k["endMs"] / 1000 + pad),
                }
                for k in known
            ]
            aligned = [
                [w for r in whisperx.align(
                    [seg],
                    state["align_model"],
                    state["align_metadata"],
                    audio_data,
                    DEVICE,
                    return_char_alignments=False,
                ).get("segments", []) for w in r.get("words", [])]
                for seg in segs
            ]
            return JSONResponse({"words": flatten_words(aligned, segs, known)})

        # Step 1: Transcribe
        result = state["model"].transcribe(
            audio_path,
            batch_size=8,
        )

        # Step 2: Align word timestamps
        result = whisperx.align(
            result["segments"],
            state["align_model"],
            state["align_metadata"],
            audio_path,
            DEVICE,
            return_char_alignments=False,
        )

        # Flatten word timestamps
        words = []
        for segment in result.get("segments", []):
            for word in segment.get("words", []):
                if "start" not in word or "end" not in word:
                    continue
                words.append({
                    "word": word["word"].strip(),
                    "startMs": round(word["start"] * 1000),
                    "endMs": round(word["end"] * 1000),
                })

        return JSONResponse({"words": words})

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        os.unlink(audio_path)
