FROM oven/bun:1 AS deps
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile

# Front-end estático (servido pelo Caddy). VITE_API_URL vazio = mesma origem.
FROM deps AS web-build
RUN cd web && bun run build

FROM caddy:2-alpine AS web
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /app/web/dist /srv

# Backend e renderer usam a mesma imagem; muda só o comando.
FROM deps AS app
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg fonts-liberation fontconfig python3-pip \
    && pip3 install --no-cache-dir --break-system-packages edge-tts \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
