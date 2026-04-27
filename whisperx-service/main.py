import os
import tempfile
import whisperx
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException
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


@app.get("/health")
def health():
    if state["model"] is None or state["align_model"] is None:
        raise HTTPException(status_code=503, detail="Models still loading")
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    if state["model"] is None:
        raise HTTPException(status_code=503, detail="Models not loaded yet")

    suffix = os.path.splitext(audio.filename or ".wav")[1] or ".wav"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(await audio.read())
        audio_path = f.name

    try:
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
