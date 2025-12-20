import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export default function createJobsRouter(params: { getQueue: any; DOWNLOADS_DIR: string; queueMetrics: any; queueForceCleanup: any; log: (m: string)=>void }) {
  const router = Router();
  const { getQueue, DOWNLOADS_DIR, queueMetrics, queueForceCleanup, log } = params as any;

  router.get('/jobs/:id', async (req: any, res) => {
    try {
      const id = req.params.id;
      const queue = getQueue();
      const job = queue.get(id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      const errorField = job.errorCode ? { code: job.errorCode, message: job.error } : job.error;
      return res.json({ status: job.status, progress: job.progress, error: errorField, downloadUrl: job.outputPath ? `/api/jobs/download/${job.id}` : undefined, createdAt: job.createdAt, startedAt: job.startedAt, finishedAt: job.finishedAt });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  router.get('/jobs/download/:id', async (req: any, res) => {
    try {
      const id = req.params.id;
      const queue = getQueue();
      const job = queue.get(id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      if (job.status !== 'succeeded' || !job.outputPath) return res.status(400).json({ error: 'Job not ready' });
      if (!job.outputPath.startsWith(DOWNLOADS_DIR)) return res.status(403).json({ error: 'Forbidden' });
      const stream = fs.createReadStream(job.outputPath);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename=${path.basename(job.outputPath)}`);
      stream.pipe(res);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.get('/admin/jobs/metrics', (req: any, res) => {
    const key = req.headers['x-admin-key'] as string;
    if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) return res.status(403).json({ error: 'forbidden' });
    const m = queueMetrics();
    return res.json(m);
  });

  router.post('/admin/jobs/cleanup', (req: any, res) => {
    const key = req.headers['x-admin-key'] as string;
    if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) return res.status(403).json({ error: 'forbidden' });
    const ok = queueForceCleanup();
    return res.json({ ok });
  });

  return router;
}
