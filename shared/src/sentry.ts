import * as Sentry from "@sentry/node";
import { isProd } from "./env";

const DEFAULT_DSN = "https://e49413b6d723bd5b604dbcc168a611a2@o4508083856080896.ingest.us.sentry.io/4511032645713920";

export function initSentry(options: {
  tags?: Record<string, string>;
  context?: { name: string; data: Record<string, unknown> };
} = {}) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN ?? DEFAULT_DSN,
    environment: isProd ? "production" : "development",
    tracesSampleRate: isProd ? 0.2 : 1.0,
  });

  if (options.tags) {
    for (const [key, value] of Object.entries(options.tags)) {
      Sentry.setTag(key, value);
    }
  }

  if (options.context) {
    Sentry.setContext(options.context.name, options.context.data);
  }
}

export async function withSentry<T>(
  promise: Promise<T>,
  context: {
    nodeId?: string;
    nodeType?: string;
    extra?: Record<string, unknown>;
    tags?: Record<string, string>;
  } = {},
): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    Sentry.captureException(error, {
      contexts: {
        node: context.nodeId
          ? { id: context.nodeId, type: context.nodeType, ...context.extra }
          : undefined,
      },
      tags: {
        render_step: "node_execution",
        ...(context.tags ?? {}),
      },
      level: "error",
    });
    throw error;
  }
}

export { Sentry };
