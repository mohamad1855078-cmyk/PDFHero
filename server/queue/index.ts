import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
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
  payload?: any;
}

class InProcessQueue extends EventEmitter {
  private jobs = new Map<string, JobRecord>();
  private queue: string[] = [];
  private concurrency: number;
  private running = 0;
  private processor: (job: JobRecord) => Promise<void>;
  private jobTimeoutMs: number;

  constructor(processor: (job: JobRecord) => Promise<void>, concurrency = 2, jobTimeoutMs = 5 * 60 * 1000) {
    super();
    this.processor = processor;
    this.concurrency = concurrency;
    this.jobTimeoutMs = jobTimeoutMs;

    // periodic cleanup of finished jobs older than TTL
    const t = setInterval(() => this.cleanup(), 60 * 1000);
    // allow process to exit even if interval exists
    if (t && typeof (t as any).unref === 'function') (t as any).unref();
  }

  enqueue(type: string, payload: any): JobRecord {
    const id = uuidv4();
    const rec: JobRecord = { id, type, status: 'queued', createdAt: Date.now(), payload };
    this.jobs.set(id, rec);
    this.queue.push(id);
    this.emit('enqueue', rec);
    this.maybeStart();
    return rec;
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
      job.finishedAt = Date.now();
      this.emit('failed', job);
    } finally {
      clearTimeout(timer);
      this.running--;
      this.maybeStart();
    }
  }

  // Remove old finished jobs and their output files
  private cleanup() {
    const now = Date.now();
    const ttl = 1000 * 60 * 60; // 1 hour
    for (const [id, job] of this.jobs.entries()) {
      if ((job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') && job.finishedAt && now - job.finishedAt > ttl) {
        if (job.outputPath) {
          try { fs.unlinkSync(job.outputPath); } catch (e) {}
        }
        this.jobs.delete(id);
      }
    }
  }
}

let QUEUE: InProcessQueue | null = null;

export function initQueue(processor: (job: JobRecord) => Promise<void>, concurrency = 2, jobTimeoutMs = 5 * 60 * 1000) {
  if (!QUEUE) QUEUE = new InProcessQueue(processor, concurrency, jobTimeoutMs);
  return QUEUE;
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
