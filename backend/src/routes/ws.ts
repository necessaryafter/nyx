import { Elysia } from "elysia";
import { QueueEvents } from "bullmq";
import { eq } from "drizzle-orm";
import { auth } from "../auth/auth";
import { database } from "../database";
import { jobs } from "../database/schema/jobs";
import { renderQueue, audioQueue } from "../lib/queue";
import { logger } from "@nyx/shared";

// Track connections by userId
const connections = new Map<string, Set<{ send: (data: string) => void }>>();

function broadcast(userId: string, message: object) {
  const userConns = connections.get(userId);
  if (!userConns || userConns.size === 0) return;
  const raw = JSON.stringify(message);
  for (const ws of userConns) {
    try {
      ws.send(raw);
    } catch {
      userConns.delete(ws);
    }
  }
}

// ── Render queue events ──

const renderQueueEvents = new QueueEvents("render", {
  connection: { url: process.env.REDIS_URL! },
});

renderQueueEvents.on("completed", async ({ jobId: bullJobId }) => {
  await broadcastRenderUpdate(bullJobId);
});

renderQueueEvents.on("failed", async ({ jobId: bullJobId }) => {
  await broadcastRenderUpdate(bullJobId);
});

renderQueueEvents.on("progress", async ({ jobId: bullJobId, data }) => {
  await broadcastRenderUpdate(bullJobId, data as number | undefined);
});

async function broadcastRenderUpdate(bullJobId: string, progress?: number) {
  try {
    const job = await renderQueue.getJob(bullJobId);
    if (!job?.data?.jobId) return;

    const dbJobId = job.data.jobId as string;
    const [dbJob] = await database
      .select({ userId: jobs.userId, status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, dbJobId))
      .limit(1);

    if (!dbJob) return;

    broadcast(dbJob.userId, {
      type: "job:status",
      jobId: dbJobId,
      status: dbJob.status,
      ...(progress !== undefined && { progress }),
    });
  } catch (err) {
    logger.error({ err, bullJobId }, "failed to broadcast render update");
  }
}

// ── Audio queue events ──

const audioQueueEvents = new QueueEvents("audio", {
  connection: { url: process.env.REDIS_URL! },
});

audioQueueEvents.on("completed", async ({ jobId: bullJobId }) => {
  try {
    const bullJob = await audioQueue.getJob(bullJobId);
    if (!bullJob?.data?.jobId) return;

    const dbJobId = bullJob.data.jobId as string;
    const [dbJob] = await database
      .select({ userId: jobs.userId, status: jobs.status, sceneSlots: jobs.sceneSlots })
      .from(jobs)
      .where(eq(jobs.id, dbJobId))
      .limit(1);

    if (!dbJob) return;

    broadcast(dbJob.userId, {
      type: "job:audio_ready",
      jobId: dbJobId,
      sceneSlots: dbJob.sceneSlots,
    });
  } catch (err) {
    logger.error({ err, bullJobId }, "failed to broadcast audio_ready");
  }
});

audioQueueEvents.on("failed", async ({ jobId: bullJobId }) => {
  try {
    const bullJob = await audioQueue.getJob(bullJobId);
    if (!bullJob?.data?.jobId) return;

    const dbJobId = bullJob.data.jobId as string;
    const [dbJob] = await database
      .select({ userId: jobs.userId, status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, dbJobId))
      .limit(1);

    if (!dbJob) return;

    broadcast(dbJob.userId, {
      type: "job:status",
      jobId: dbJobId,
      status: dbJob.status,
    });
  } catch (err) {
    logger.error({ err, bullJobId }, "failed to broadcast audio failure");
  }
});

export const wsRoutes = new Elysia({ prefix: "/api" })
  .ws("/ws", {
    async open(ws) {
      const url = new URL(ws.data.request.url);
      const token = url.searchParams.get("token");

      let session;
      if (token) {
        const fakeHeaders = new Headers();
        fakeHeaders.set("cookie", `better-auth.session_token=${token}`);
        session = await auth.api.getSession({ headers: fakeHeaders });
      } else {
        session = await auth.api.getSession({ headers: ws.data.request.headers });
      }

      if (!session) {
        ws.send(JSON.stringify({ type: "error", message: "unauthorized" }));
        ws.close();
        return;
      }

      const userId = session.user.id;
      (ws.data as Record<string, unknown>).userId = userId;

      if (!connections.has(userId)) {
        connections.set(userId, new Set());
      }
      connections.get(userId)!.add(ws);

      ws.send(JSON.stringify({ type: "connected", userId }));
      logger.info({ userId }, "ws connected");
    },

    message(_ws, _message) {
      // Client messages not needed for now (server-push only)
    },

    close(ws) {
      const userId = (ws.data as Record<string, unknown>).userId as string | undefined;
      if (userId) {
        connections.get(userId)?.delete(ws);
        if (connections.get(userId)?.size === 0) {
          connections.delete(userId);
        }
        logger.info({ userId }, "ws disconnected");
      }
    },
  });
