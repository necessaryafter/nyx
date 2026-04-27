import { EventEmitter } from "events";
import { logger } from "./logger";

export type JobStatus = "pending" | "running" | "done" | "failed";

export interface QueueJob {
  id: string;
  label: string;
  userId: string;
  status: JobStatus;
  progress: string;
  step: number;
  totalSteps: number;
  createdAt: number;
  startedAt?: number;
  doneAt?: number;
  error?: string;
  setProgress(text: string, step?: number, total?: number): void;
}

type JobFn = (job: QueueJob) => Promise<void>;

interface PendingEntry {
  job: QueueJob;
  fn: JobFn;
  resolve: () => void;
  reject: (err: unknown) => void;
}

export class JobQueue extends EventEmitter {
  readonly concurrency: number;
  private _running = 0;
  private pending: PendingEntry[] = [];
  private _active = new Map<string, QueueJob>();
  private _history: QueueJob[] = [];

  constructor(concurrency = 1) {
    super();
    this.concurrency = concurrency;
  }

  get activeCount() { return this._running; }
  get queueLength() { return this.pending.length; }

  enqueue(label: string, userId: string, fn: JobFn): { job: QueueJob; promise: Promise<void> } {
    let idCounter = Math.random().toString(36).slice(2, 7);
    const job: QueueJob = {
      id: idCounter,
      label,
      userId,
      status: "pending",
      progress: "Na fila...",
      step: 0,
      totalSteps: 0,
      createdAt: Date.now(),
      setProgress: (text, step, total) => {
        job.progress = text;
        if (step !== undefined) job.step = step;
        if (total !== undefined) job.totalSteps = total;
        this.emit("update");
      },
    };

    const promise = new Promise<void>((resolve, reject) => {
      this.pending.push({ job, fn, resolve, reject });
    });

    this.emit("update");
    this._next();
    return { job, promise };
  }

  private _next() {
    while (this._running < this.concurrency && this.pending.length > 0) {
      const entry = this.pending.shift()!;
      const { job, fn, resolve, reject } = entry;

      this._running++;
      job.status = "running";
      job.startedAt = Date.now();
      this._active.set(job.id, job);
      this.emit("update");

      fn(job)
        .then(() => {
          job.status = "done";
          job.doneAt = Date.now();
          resolve();
        })
        .catch((err) => {
          job.status = "failed";
          job.doneAt = Date.now();
          job.error = err instanceof Error ? err.message : String(err);
          logger.error({ jobId: job.id, label: job.label }, "Queue job failed");
          reject(err);
        })
        .finally(() => {
          this._running--;
          this._active.delete(job.id);
          this._history.unshift(job);
          if (this._history.length > 8) this._history.pop();
          this.emit("update");
          this._next();
        });
    }
  }

  snapshot() {
    return {
      pending: this.pending.map(e => e.job),
      active: Array.from(this._active.values()),
      recent: this._history.slice(0, 5),
    };
  }
}

export const queue = new JobQueue(
  Math.max(1, parseInt(process.env.QUEUE_CONCURRENCY ?? "1", 10))
);
