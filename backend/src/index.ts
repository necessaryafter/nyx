import { Sentry } from "./lib/sentry";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { rateLimit } from "elysia-rate-limit";
import { logger } from "@nyx/shared";
import { authRoutes } from "./routes/auth";
import { assetRoutes } from "./routes/assets";
import { templateRoutes } from "./routes/templates";
import { jobRoutes } from "./routes/jobs";
import { creditRoutes } from "./routes/credits";
import { integrationRoutes } from "./routes/integrations";
import { apiKeyRoutes } from "./routes/api-keys";
import { wsRoutes } from "./routes/ws";
import { aiRoutes } from "./routes/ai";
import { imageRoutes } from "./routes/images";

const app = new Elysia()
  .onError(({ error, request }) => {
    const status = "status" in error ? (error as { status: number }).status : 500;
    if (typeof status !== "number" || status >= 500) {
      Sentry.captureException(error, {
        tags: { layer: "http" },
        contexts: { request: { method: request.method, url: request.url } },
      });
    }
  })
  .use(cors({
    origin: [
      "http://localhost:3001",
      "http://localhost:5173",
    ],
    credentials: true,
  }))
  .use(rateLimit({
    max: 300,
    duration: 60_000,
  }))
  .get("/health", () => ({ status: "ok" }))
  .use(authRoutes)
  .use(assetRoutes)
  .use(templateRoutes)
  .use(jobRoutes)
  .use(creditRoutes)
  .use(integrationRoutes)
  .use(apiKeyRoutes)
  .use(wsRoutes)
  .use(aiRoutes)
  .use(imageRoutes)
  .listen({ port: process.env.PORT ?? 3000, maxRequestBodySize: 4 * 1024 * 1024 * 1024, idleTimeout: 255 });

logger.info(`API running at http://${app.server?.hostname}:${app.server?.port}`);
