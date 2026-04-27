/**
 * Creates the Thanatos template in Nyx.
 * Run once: bun create-template.ts
 *
 * Requires NYX_API_URL and NYX_API_KEY in .env (auto-loaded by Bun)
 */

const BASE_URL = process.env.NYX_API_URL!;
const API_KEY = process.env.NYX_API_KEY!;

if (!BASE_URL || !API_KEY) {
  console.error("Missing NYX_API_URL or NYX_API_KEY");
  process.exit(1);
}

// ─── Template graph ───────────────────────────────────────────────────────────
//
// MediaPool (scene-pool) ─── items ──► VideoFit (videofit-1)
// TTS (tts-1)            ─── audio ──► VideoFit (videofit-1)
// Zoom (zoom-1)          ─── effect ─► VideoFit (videofit-1)
// Transition (trans-1)   ─── effect ─► VideoFit (videofit-1)
// VideoFit (videofit-1)  ─── video ──► Layer (layer-1)
// TTS (tts-1)            ─── timestamps ─► Subtitle (subtitle-1)
// Subtitle (subtitle-1)  ─── filter ─► Layer (layer-1)
// Layer (layer-1)        ─── video ──► Render (render-1)
// TTS (tts-1)            ─── audio ──► Render (render-1)

const graph = {
  version: 1,
  nodes: [
    {
      id: "scene-pool",
      type: "MediaPool",
      config: {
        assetIds: [],       // filled at job creation via mediaPoolOverrides
        assetType: "image",
      },
    },
    {
      id: "videofit-1",
      type: "VideoFit",
      config: { mode: "sequential" },
    },
    {
      id: "zoom-1",
      type: "Zoom",
      config: { factor: 1.05, direction: "in" },
    },
    {
      id: "trans-1",
      type: "Transition",
      config: { types: ["fade", "dissolve", "smoothleft"], mode: "random", duration: 0.5 },
    },
    {
      id: "tts-1",
      type: "TTS",
      config: { provider: "custom" },   // Thanatos always uploads audio; no Talkify needed
    },
    {
      id: "subtitle-1",
      type: "Subtitle",
      config: {
        wordsPerGroup: 3,
        style: {
          fontSize: 72,
          color: "#FFFFFF",
          highlightColor: "#FFD700",
          strokeColor: "#000000",
          strokeWidth: 3,
          position: "bottom",
        },
      },
    },
    {
      id: "layer-1",
      type: "Layer",
      config: {},
    },
    {
      id: "render-1",
      type: "Render",
      config: { width: 1920, height: 1080, fps: 30, format: "mp4" },
    },
  ],
  edges: [
    { id: "e1", from: "scene-pool",  fromHandle: "items",      to: "videofit-1",  toHandle: "items"      },
    { id: "e2", from: "tts-1",       fromHandle: "audio",      to: "videofit-1",  toHandle: "audio"      },
    { id: "e3", from: "zoom-1",      fromHandle: "effect",     to: "videofit-1",  toHandle: "effects"    },
    { id: "e4", from: "trans-1",     fromHandle: "effect",     to: "videofit-1",  toHandle: "effects"    },
    { id: "e5", from: "videofit-1",  fromHandle: "video",      to: "layer-1",     toHandle: "base"       },
    { id: "e6", from: "tts-1",       fromHandle: "timestamps", to: "subtitle-1",  toHandle: "timestamps" },
    { id: "e7", from: "subtitle-1",  fromHandle: "filter",     to: "layer-1",     toHandle: "overlay"    },
    { id: "e8", from: "layer-1",     fromHandle: "video",      to: "render-1",    toHandle: "video"      },
    { id: "e9", from: "tts-1",       fromHandle: "audio",      to: "render-1",    toHandle: "audio"      },
  ],
};

const res = await fetch(`${BASE_URL}/api/templates`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({ name: "Thanatos Dark Hook", graph }),
});

if (!res.ok) {
  const text = await res.text();
  console.error(`Failed: ${res.status} ${text}`);
  process.exit(1);
}

const template = await res.json() as { id: string; name: string };
console.log(`✓ Template created: ${template.name} (id: ${template.id})`);
