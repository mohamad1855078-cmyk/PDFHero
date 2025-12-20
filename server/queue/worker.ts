import path from 'path';
import fs from 'fs';
import { initQueue, getQueue, writeBufferAsDownload, writeFilesAsZip, JobRecord } from './index';
import { createPDFProvider } from '../pdf-provider';
import { log } from '../index';

const DOWNLOADS_DIR = '/tmp/pdf-downloads';

export function startWorker() {
  const pdfProvider = createPDFProvider();

  const processor = async (job: JobRecord) => {
    log(`[worker] Processing job ${job.id} type=${job.type}`);
    try {
      // attach clientKey from payload if present
      const clientKey = job.payload && job.payload.clientKey;
      if (clientKey) job.payload.clientKey = clientKey;
      if (job.type === 'merge') {
        const filePaths: string[] = job.payload.filePaths;
        const buffer = await pdfProvider.mergePDFs(filePaths, { compress: job.payload.compress });
        const p = await writeBufferAsDownload(job.id, buffer, 'pdf');
        job.outputPath = p;
      } else if (job.type === 'compress') {
        const filePath: string = job.payload.filePath;
        const result = await pdfProvider.compressPDF(filePath, job.payload.level || 'recommended');
        const p = await writeBufferAsDownload(job.id, result.buffer || result, 'pdf');
        job.outputPath = p;
      } else if (job.type === 'split') {
        const filePath: string = job.payload.filePath;
        const result = await pdfProvider.splitPDF(filePath, job.payload.mode || 'all', job.payload.ranges);
        if (result.files && result.files.length > 0) {
          const p = await writeFilesAsZip(job.id, result.files);
          job.outputPath = p;
        } else {
          // fallback: write single file
          const buf = Buffer.from('%PDF-1.4 empty');
          const p = await writeBufferAsDownload(job.id, buf, 'pdf');
          job.outputPath = p;
        }
      } else if (job.type === 'from-html') {
        // payload: html, options
        const buffer = await (pdfProvider as any).htmlToPDF(job.payload.html, job.payload.options || {} as any);
        const p = await writeBufferAsDownload(job.id, buffer, 'pdf');
        job.outputPath = p;
      } else if (job.type === 'repair') {
        // reuse inline repair logic from routes (simplified): pdfProvider may not have repair, so run basic qpdf linearize
        const filePath: string = job.payload.filePath;
        const outPath = path.join(DOWNLOADS_DIR, `${job.id}.pdf`);
        try {
          // try qpdf linearize
          const { execFileSync } = require('child_process');
          execFileSync('qpdf', ['--linearize', filePath, outPath], { timeout: 120000 });
          job.outputPath = outPath;
        } catch (e: any) {
          throw new Error('Repair failed: ' + (e?.message || e));
        }
      } else {
        throw new Error(`Unknown job type: ${job.type}`);
      }

      // cleanup uploaded temp files if provided
      if (job.payload && job.payload.cleanupFiles && Array.isArray(job.payload.cleanupFiles)) {
        for (const f of job.payload.cleanupFiles) {
          try { fs.unlinkSync(f); } catch (e) {}
        }
      }
    } catch (err: any) {
      log(`[worker] Job ${job.id} failed: ${err?.message || err}`);
      throw err;
    }
  };

  initQueue(processor, parseInt(process.env.QUEUE_CONCURRENCY || '2', 10));
  log('[worker] started');
}

export function getWorkerQueue() {
  return getQueue();
}
