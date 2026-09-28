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
import { schedulerRoutes } from "./routes/schedulers";
import { assetImportRoutes } from "./routes/assetImports";
import { startSchedulerWorker } from "./workers/scheduler.worker";
import { reconcileAllSchedulers } from "./lib/scheduler/sync";

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
    // Behind Caddy every request comes from the proxy IP; Caddy overwrites X-Forwarded-For.
    generator: (req, server) =>
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? server?.requestIP(req)?.address ?? "",
    // Upload em chunks (assets normais e asset-import) manda centenas de PUTs pequenos
    // em rajada — sem isso, um vídeo grande estoura o teto global e a rota quebra no
    // meio (as próprias rotas já dizem "sem rate limit apertado aqui", mas o limite
    // global ainda contava esses PUTs).
    skip: (req) => req.method === "PUT" && new URL(req.url).pathname.endsWith("/chunk"),
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
  .use(schedulerRoutes)
  .use(assetImportRoutes)
  .listen({ port: process.env.PORT ?? 3000, maxRequestBodySize: 4 * 1024 * 1024 * 1024, idleTimeout: 255 });

logger.info(`API running at http://${app.server?.hostname}:${app.server?.port}`);

// job-scheduler: worker roda no mesmo processo (uma máquina só, concorrência 1 é suficiente).
// Desligável em produção multi-processo pra rodar num worker dedicado (SCHEDULER_WORKER=false).
if (process.env.SCHEDULER_WORKER !== "false") {
  startSchedulerWorker();
  // Re-registra os schedulers habilitados no BullMQ — cobre o caso de Redis limpo
  // (a fonte de verdade de "está agendado" é o Postgres, não o Redis).
  reconcileAllSchedulers().catch((err) => logger.error({ err }, "failed to reconcile schedulers on boot"));
}
