FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# PyTorch CPU (versão estável mais recente compatível)
RUN pip install --no-cache-dir \
    torch==2.6.0+cpu \
    torchaudio==2.6.0+cpu \
    --index-url https://download.pytorch.org/whl/cpu

# WhisperX do repositório Git
RUN pip install --no-cache-dir git+https://github.com/m-bain/whisperx.git

# Dependências da aplicação
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

ARG WHISPER_MODEL=small
ENV WHISPER_MODEL=${WHISPER_MODEL}

# Pré-baixa modelos durante o build para evitar download em runtime
RUN python - <<EOF
import whisperx, os
model_name = os.environ["WHISPER_MODEL"]
print(f"Caching WhisperX model '{model_name}'...")
whisperx.load_model(model_name, "cpu", compute_type="int8", language="pt")
print("Caching alignment model for Portuguese...")
whisperx.load_align_model(language_code="pt", device="cpu")
print("Models cached.")
EOF

# Código da aplicação
COPY main.py .

EXPOSE 8000

# start-period generoso pois os modelos ainda precisam ser carregados em memória
HEALTHCHECK --interval=10s --timeout=5s --start-period=90s --retries=3 \
    CMD python -c "import urllib.request; r = urllib.request.urlopen('http://localhost:8000/health'); exit(0 if r.status == 200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
