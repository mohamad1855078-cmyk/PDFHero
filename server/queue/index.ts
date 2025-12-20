import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import archiver from 'archiver';
import { log } from '../index';

const DOWNLOADS_DIR = '/tmp/pdf-downloads';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface JobRecord {
  id: string;
  type: string;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  progress?: number;
  outputPath?: string;
  error?: string;
  errorCode?: string;
  payload?: any;
}

class InProcessQueue extends EventEmitter {
  private jobs = new Map<string, JobRecord>();
  private queue: string[] = [];
  private queuedByKey = new Map<string, number>();
  private runningByKey = new Map<string, number>();
  private concurrency: number;
  private running = 0;
  private processor: (job: JobRecord) => Promise<void>;
  private jobTimeoutMs: number;
  private maxPerUser: number;
  private jobTtlMs: number;
  private outputTtlMs: number;

  constructor(processor: (job: JobRecord) => Promise<void>, concurrency = 2, jobTimeoutMs = 5 * 60 * 1000) {
    super();
    this.processor = processor;
    this.concurrency = concurrency;
    this.jobTimeoutMs = jobTimeoutMs;
    this.maxPerUser = parseInt(process.env.QUEUE_MAX_PER_USER || '') || 1;
    this.jobTtlMs = parseInt(process.env.JOB_TTL_MS || '') || 1000 * 60 * 60; // 1h
    this.outputTtlMs = parseInt(process.env.OUTPUT_TTL_MS || '') || 1000 * 60 * 60; // 1h

    // periodic cleanup of finished jobs older than TTL
    const t = setInterval(() => this.cleanup(), 60 * 1000);
    // allow process to exit even if interval exists
    if (t && typeof (t as any).unref === 'function') (t as any).unref();
  }

  enqueue(type: string, payload: any): JobRecord {
    const id = randomUUID();
    const rec: JobRecord = { id, type, status: 'queued', createdAt: Date.now(), payload };
    this.jobs.set(id, rec);
    this.queue.push(id);
    // track queued by key
    const key = (payload && payload.clientKey) || 'anon';
    this.queuedByKey.set(key, (this.queuedByKey.get(key) || 0) + 1);
    this.emit('enqueue', rec);
    this.maybeStart();
    return rec;
  }

  canEnqueueFor(key?: string) {
    const k = key || 'anon';
    const running = this.runningByKey.get(k) || 0;
    const queued = this.queuedByKey.get(k) || 0;
    return (running + queued) < (this.maxPerUser + Math.max(1, this.concurrency));
  }

  get(id: string) {
    return this.jobs.get(id);
  }

  list() {
    return Array.from(this.jobs.values());
  }

  private maybeStart() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const id = this.queue.shift()!;
      const job = this.jobs.get(id);
      if (!job) continue;
      // decrement queuedByKey before running
      const key = (job.payload && job.payload.clientKey) || 'anon';
      this.queuedByKey.set(key, Math.max(0, (this.queuedByKey.get(key) || 1) - 1));
      // enforce per-user cap at start time
      const runningFor = this.runningByKey.get(key) || 0;
      if (runningFor >= this.maxPerUser) {
        // re-queue to end to avoid starvation
        this.queue.push(id);
        continue;
      }
      this.runningByKey.set(key, runningFor + 1);
      this.run(job).catch((e) => log(`Job runner error: ${e?.message || e}`));
    }
  }

  private async run(job: JobRecord) {
    this.running++;
    job.status = 'running';
    job.startedAt = Date.now();
    this.emit('start', job);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
    }, this.jobTimeoutMs);

    try {
      if (timedOut) throw new Error('Job timed out');
      await this.processor(job);
      if (timedOut) throw new Error('Job timed out');
      job.status = 'succeeded';
      job.finishedAt = Date.now();
      this.emit('succeeded', job);
    } catch (err: any) {
      job.status = 'failed';
      job.error = err?.message || String(err);
      if (err && (err as any).code) job.errorCode = (err as any).code;
      job.finishedAt = Date.now();
      this.emit('failed', job);
    } finally {
      clearTimeout(timer);
      this.running--;
      // decrement runningByKey
      const key = (job.payload && job.payload.clientKey) || 'anon';
      this.runningByKey.set(key, Math.max(0, (this.runningByKey.get(key) || 1) - 1));
      this.maybeStart();
    }
  }

  // Remove old finished jobs and their output files
  private cleanup() {
    const now = Date.now();
    const ttl = this.jobTtlMs;
    this.jobs.forEach((job, id) => {
      if ((job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') && job.finishedAt && now - job.finishedAt > ttl) {
        if (job.outputPath) {
          try { fs.unlinkSync(job.outputPath); } catch (e) {}
        }
        this.jobs.delete(id);
      }
      // also cleanup orphaned output files older than outputTtlMs
      if (job.outputPath && fs.existsSync(job.outputPath)) {
        try {
          const stats = fs.statSync(job.outputPath);
          if (now - stats.mtimeMs > this.outputTtlMs) {
            try { fs.unlinkSync(job.outputPath); } catch (e) {}
          }
        } catch (e) {}
      }
    });
  }
}

let QUEUE: InProcessQueue | null = null;

export function initQueue(processor: (job: JobRecord) => Promise<void>, concurrency = 2, jobTimeoutMs = 5 * 60 * 1000) {
  if (!QUEUE) QUEUE = new InProcessQueue(processor, concurrency, jobTimeoutMs);
  return QUEUE;
}

// Admin helpers
export function forceCleanup() {
  if (!QUEUE) return false;
  // run cleanup synchronously
  (QUEUE as any).cleanup();
  return true;
}

export function metrics() {
  if (!QUEUE) return null;
  return {
    jobs: (QUEUE as any).list(),
    concurrency: (QUEUE as any).concurrency,
    running: (QUEUE as any).running,
  };
}

export function getQueue() {
  if (!QUEUE) throw new Error('Queue not initialized');
  return QUEUE;
}

export async function writeBufferAsDownload(jobId: string, buffer: Buffer, ext = 'pdf') {
  if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  const filename = `${jobId}.${ext}`;
  const p = path.join(DOWNLOADS_DIR, filename);
  await fs.promises.writeFile(p, buffer);
  return p;
}

export async function writeFilesAsZip(jobId: string, files: string[]) {
  if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  const filename = `${jobId}.zip`;
  const outPath = path.join(DOWNLOADS_DIR, filename);
  const output = fs.createWriteStream(outPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(output);
  for (const f of files) {
    const name = path.basename(f);
    archive.file(f, { name });
  }
  await archive.finalize();
  return outPath;
}
