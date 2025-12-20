import type { Express } from 'express';
import { type Server } from 'http';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { createPDFProvider } from './pdf-provider';
import { log } from './index';
import { escapeHtml } from './utils/sanitize';
import validateUpload from './middleware/validateUpload';
import rateLimit from './middleware/rateLimit';
import { metrics as queueMetrics, forceCleanup as queueForceCleanup } from './queue/index';
import { initQueue, getQueue } from './queue/index';
import { startWorker } from './queue/worker';

// Use /tmp for faster I/O (tmpfs on Linux)
const UPLOADS_DIR = '/tmp/pdf-uploads';
const DOWNLOADS_DIR = '/tmp/pdf-downloads';

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

// Multer instances
const upload = multer({ dest: UPLOADS_DIR, limits: { fileSize: 1024 * 1024 * 1024 } });
const uploadOffice = multer({ dest: UPLOADS_DIR, limits: { fileSize: 1024 * 1024 * 500 } });

log(`[Performance] Using temp storage for uploads: ${UPLOADS_DIR}`);
log(`[Performance] Using temp storage for downloads: ${DOWNLOADS_DIR}`);

// Cache for Chromium path to avoid repeated lookups
let cachedChromiumPath: string | null = null;
function getChromiumPath(): string | null {
  if (cachedChromiumPath) return cachedChromiumPath;
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    cachedChromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    return cachedChromiumPath;
  }
  try { const chromiumPath = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null', { encoding: 'utf-8' }).trim(); if (chromiumPath) { cachedChromiumPath = chromiumPath; return cachedChromiumPath; } } catch (e) {}
  try { const nixPath = execSync('find /nix/store -name "chromium" -type f -executable 2>/dev/null | head -1', { encoding: 'utf-8', timeout: 5000 }).trim(); if (nixPath) { cachedChromiumPath = nixPath; return cachedChromiumPath; } } catch (e) {}
  const commonPaths = ['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'];
  for (const p of commonPaths) if (fs.existsSync(p)) { cachedChromiumPath = p; return cachedChromiumPath; }
  return null;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const pdfProvider = createPDFProvider();
  try { startWorker(); } catch (e: any) { log(`Failed to start worker: ${e?.message || e}`); }

  // Rate limiting applied globally
  app.use(rateLimit);

  // Dynamically import and register modular routers
  const createPdfRouter = (await import('./routes/pdf.routes')).default;
  const createUploadRouter = (await import('./routes/upload.routes')).default;
  const createJobsRouter = (await import('./routes/jobs.routes')).default;
  const createCvRouter = (await import('./routes/cv.routes')).default;
  const createHealthRouter = (await import('./routes/health.routes')).default;

  app.use('/api/pdf', createPdfRouter({ pdfProvider, upload, uploadOffice, validateUpload, getQueue, UPLOADS_DIR, DOWNLOADS_DIR, getChromiumPath, log, execSync } as any));
  app.use('/api/pdf', createUploadRouter({ pdfProvider, uploadOffice, validateUpload, getQueue, UPLOADS_DIR, DOWNLOADS_DIR, log } as any));
  app.use('/api', createJobsRouter({ getQueue, DOWNLOADS_DIR, queueMetrics, queueForceCleanup, log } as any));
  app.use('/api/cv', createCvRouter({ pdfProvider, getQueue, getChromiumPath, log, escapeHtml } as any));
  app.use('/api', createHealthRouter({ provider: process.env.PDF_PROVIDER || 'mock' } as any));

  return httpServer;
}
