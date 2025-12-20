import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

export default function createPdfRouter(params: {
  pdfProvider: any;
  upload: any;
  uploadOffice: any;
  validateUpload: any;
  getQueue: any;
  UPLOADS_DIR: string;
  DOWNLOADS_DIR: string;
  getChromiumPath: () => string | null;
  log: (m: string) => void;
  execSync?: any;
}) {
  const router = Router();
  const { pdfProvider, upload, validateUpload, getQueue, DOWNLOADS_DIR, UPLOADS_DIR, getChromiumPath, log, execSync } = params as any;

  // Merge
  router.post('/merge', upload.array('files', 50), validateUpload, async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      const mode = (req.body?.mode || 'fast') as 'fast' | 'compress';
      if (!files || files.length < 2) return res.status(400).json({ error: "At least 2 PDF files are required" });
      const filePaths = files.map((f) => f.path);
      const queue = getQueue();
      const job = queue.enqueue('merge', { filePaths, compress: mode === 'compress', cleanupFiles: filePaths });
      return res.status(202).json({ jobId: job.id });
    } catch (error: any) {
      log(`Error enqueueing merge job: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Split
  router.post('/split', upload.single('file'), validateUpload, async (req: any, res) => {
    try {
      const file = req.file;
      const mode = (req.body?.mode || req.headers['x-split-mode'] || 'all') as string;
      const ranges = (req.body?.ranges || req.headers['x-split-ranges'] || '') as string;
      const downloadFormat = (req.body?.format || req.headers['x-download-format'] || 'combined') as string;
      if (!file) return res.status(400).json({ error: 'PDF file is required' });
      const queue = getQueue();
      const job = queue.enqueue('split', { filePath: file.path, mode, ranges, downloadFormat, cleanupFiles: [file.path] });
      return res.status(202).json({ jobId: job.id });
    } catch (error: any) {
      log(`Error enqueueing split job: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Download temporary file (zip/pdf)
  router.get('/download/:downloadId', (req, res) => {
    try {
      const { downloadId } = req.params;
      let downloadPath = path.join(DOWNLOADS_DIR, `${downloadId}.zip`);
      let fileType = 'zip';
      let filename = 'split-pages.zip';
      if (!fs.existsSync(downloadPath)) {
        downloadPath = path.join(DOWNLOADS_DIR, `${downloadId}.pdf`);
        fileType = 'pdf';
        filename = 'merged-document.pdf';
      }
      if (!downloadPath.startsWith(DOWNLOADS_DIR)) return res.status(403).json({ error: 'Invalid download ID' });
      if (!fs.existsSync(downloadPath)) return res.status(404).json({ error: 'Download expired or not found' });
      log(`Downloading ${fileType}: ${downloadId}`);
      const contentType = fileType === 'zip' ? 'application/zip' : 'application/pdf';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      const stream = fs.createReadStream(downloadPath);
      stream.pipe(res);
      res.on('finish', () => {
        try { fs.unlinkSync(downloadPath); log(`Deleted download: ${downloadId}`); } catch (e) {}
      });
    } catch (error: any) {
      log(`Error downloading file: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Compress
  router.post('/compress', upload.single('file'), validateUpload, async (req: any, res) => {
    try {
      const file = req.file;
      const { level } = req.body;
      if (!file) return res.status(400).json({ error: "PDF file is required" });
      const queue = getQueue();
      const job = queue.enqueue('compress', { filePath: file.path, level: level || 'recommended', cleanupFiles: [file.path] });
      return res.status(202).json({ jobId: job.id });
    } catch (error: any) {
      log(`Error enqueueing compress job: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Protect PDF
  router.post('/protect', upload.single('file'), validateUpload, async (req: any, res) => {
    try {
      const file = req.file;
      const { password } = req.body;
      if (!file) return res.status(400).json({ error: "PDF file is required" });
      if (!password) return res.status(400).json({ error: "Password is required" });
      log(`Protecting PDF with password`);
      const protectedPDF = await pdfProvider.protectPDF(file.path, password);
      try { fs.unlinkSync(file.path); } catch {}
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=protected.pdf');
      res.send(protectedPDF);
    } catch (error: any) {
      log(`Error protecting PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Unlock
  router.post('/unlock', upload.single('file'), validateUpload, async (req: any, res) => {
    const file = req.file;
    try {
      const { password } = req.body;
      if (!file) return res.status(400).json({ error: 'PDF file is required' });
      if (!password) return res.status(400).json({ error: 'Password is required' });
      log(`Unlocking password-protected PDF`);
      const unlockedPDF = await pdfProvider.unlockPDF(file.path, password);
      try { fs.unlinkSync(file.path); } catch {}
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=unlocked.pdf');
      res.send(unlockedPDF);
    } catch (error: any) {
      if (file?.path) try { fs.unlinkSync(file.path); } catch {}
      if (error.type === 'INVALID_PASSWORD') {
        log(`Unlock failed: invalid password`);
        return res.status(400).json({ error: error.message });
      }
      log(`Unlock failed: decryption error`);
      res.status(500).json({ error: error.message || 'Failed to unlock PDF' });
    }
  });

  // Remove Pages
  router.post('/remove-pages', upload.single('file'), validateUpload, async (req: any, res) => {
    const file = req.file;
    try {
      const { pages } = req.body;
      if (!file) return res.status(400).json({ error: 'PDF file is required' });
      if (!pages || !pages.trim()) return res.status(400).json({ error: 'Pages to remove are required' });
      const startTime = Date.now();
      log(`Removing pages from PDF: ${pages}`);
      const result = await pdfProvider.removePages(file.path, pages);
      const elapsed = Date.now() - startTime;
      log(`Removed ${result.removedCount} pages in ${elapsed}ms (${result.originalPageCount} → ${result.finalPageCount} pages)`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=pages-removed.pdf');
      res.setHeader('X-Original-Page-Count', result.originalPageCount.toString());
      res.setHeader('X-Removed-Count', result.removedCount.toString());
      res.setHeader('X-Final-Page-Count', result.finalPageCount.toString());
      res.setHeader('X-Elapsed-Time', elapsed.toString());
      res.send(result.buffer);
    } catch (error: any) {
      log(`Error removing pages: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally {
      if (file?.path) try { fs.unlinkSync(file.path); } catch (e) {}
    }
  });

  // Rotate
  router.post('/rotate', upload.single('file'), validateUpload, async (req: any, res) => {
    const file = req.file;
    try {
      if (!file) return res.status(400).json({ error: 'PDF file is required' });
      let result;
      const startTime = Date.now();
      if (req.body.pageRotations) {
        const pageRotations = JSON.parse(req.body.pageRotations);
        log(`Rotating pages with per-page angles`);
        result = await pdfProvider.rotatePagesPerPage(file.path, pageRotations);
      } else {
        const { pages, angle } = req.body;
        if (!pages || !pages.trim()) return res.status(400).json({ error: 'Pages to rotate are required' });
        const rotationAngle = parseInt(angle) || 90;
        if (![0,90,180,270].includes(rotationAngle)) return res.status(400).json({ error: 'Rotation angle must be 0, 90, 180, or 270 degrees' });
        log(`Rotating pages in PDF: ${pages} by ${rotationAngle}°`);
        result = await pdfProvider.rotatePages(file.path, pages, rotationAngle);
      }
      const elapsed = Date.now() - startTime;
      log(`Rotated ${result.rotatedCount} pages in ${elapsed}ms`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=rotated.pdf');
      res.setHeader('X-Total-Pages', result.totalPages.toString());
      res.setHeader('X-Rotated-Count', result.rotatedCount.toString());
      res.setHeader('X-Elapsed-Time', elapsed.toString());
      res.send(result.buffer);
    } catch (error: any) {
      log(`Error rotating pages: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally {
      if (file?.path) try { fs.unlinkSync(file.path); } catch (e) {}
    }
  });

  // Organize
  router.post('/organize', upload.single('file'), validateUpload, async (req: any, res) => {
    const file = req.file;
    try {
      if (!file) return res.status(400).json({ error: 'PDF file is required' });
      const pageOrderStr = req.body.pageOrder;
      if (!pageOrderStr) return res.status(400).json({ error: 'Page order is required' });
      const pageOrder = JSON.parse(pageOrderStr);
      if (!Array.isArray(pageOrder) || pageOrder.length === 0) return res.status(400).json({ error: 'Invalid page order format' });
      const startTime = Date.now();
      log(`Organizing PDF pages to order: ${pageOrder.join(', ')}`);
      const result = await pdfProvider.organizePages(file.path, pageOrder);
      const elapsed = Date.now() - startTime;
      log(`Organized ${result.totalPages} pages in ${elapsed}ms`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=organized.pdf');
      res.setHeader('X-Total-Pages', result.totalPages.toString());
      res.setHeader('X-Elapsed-Time', elapsed.toString());
      res.send(result.buffer);
    } catch (error: any) {
      log(`Error organizing PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally {
      if (file?.path) try { fs.unlinkSync(file.path); } catch (e) {}
    }
  });

  // Crop
  router.post('/crop', upload.single('file'), validateUpload, async (req: any, res) => {
    const file = req.file;
    try {
      if (!file) return res.status(400).json({ error: 'PDF file is required' });
      const { pages, top, bottom, left, right, unit } = req.body;
      const cropTop = parseFloat(top) || 0;
      const cropBottom = parseFloat(bottom) || 0;
      const cropLeft = parseFloat(left) || 0;
      const cropRight = parseFloat(right) || 0;
      const cropUnit = unit || 'percent';
      const pageSpec = pages || 'all';
      const startTime = Date.now();
      log(`Cropping PDF pages: ${pageSpec}, margins: T=${cropTop} B=${cropBottom} L=${cropLeft} R=${cropRight} (${cropUnit})`);
      const result = await pdfProvider.cropPDF(file.path, pageSpec, cropTop, cropBottom, cropLeft, cropRight, cropUnit);
      const elapsed = Date.now() - startTime;
      log(`Cropped PDF in ${elapsed}ms (${result.totalPages} pages)`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=cropped.pdf');
      res.setHeader('X-Total-Pages', result.totalPages.toString());
      res.setHeader('X-Elapsed-Time', elapsed.toString());
      res.send(result.buffer);
    } catch (error: any) {
      log(`Error cropping PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally {
      if (file?.path) try { fs.unlinkSync(file.path); } catch (e) {}
    }
  });

  // PDF -> Word/Excel/PPT
  router.post('/to-word', upload.single('file'), validateUpload, async (req: any, res) => {
    const file = req.file;
    try {
      if (!file) return res.status(400).json({ error: 'PDF file is required' });
      log(`Converting PDF to Word`);
      const startTime = Date.now();
      const wordDoc = await pdfProvider.pdfToWord(file.path);
      const elapsed = Date.now() - startTime;
      log(`PDF to Word conversion complete in ${elapsed}ms`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename=converted.docx');
      res.setHeader('X-Elapsed-Time', elapsed.toString());
      res.send(wordDoc);
    } catch (error: any) {
      log(`Error converting PDF to Word: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally { if (file?.path) try { fs.unlinkSync(file.path); } catch (e) {} }
  });

  router.post('/to-excel', upload.single('file'), validateUpload, async (req: any, res) => {
    const file = req.file;
    try {
      if (!file) return res.status(400).json({ error: 'PDF file is required' });
      log(`Converting PDF to Excel`);
      const startTime = Date.now();
      const excelDoc = await pdfProvider.pdfToExcel(file.path);
      const elapsed = Date.now() - startTime;
      log(`PDF to Excel conversion complete in ${elapsed}ms`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=converted.xlsx');
      res.setHeader('X-Elapsed-Time', elapsed.toString());
      res.send(excelDoc);
    } catch (error: any) {
      log(`Error converting PDF to Excel: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally { if (file?.path) try { fs.unlinkSync(file.path); } catch (e) {} }
  });

  router.post('/to-ppt', upload.single('file'), validateUpload, async (req: any, res) => {
    const file = req.file;
    try {
      if (!file) return res.status(400).json({ error: 'PDF file is required' });
      log(`Converting PDF to PowerPoint`);
      const startTime = Date.now();
      const pptDoc = await pdfProvider.pdfToPowerPoint(file.path);
      const elapsed = Date.now() - startTime;
      log(`PDF to PowerPoint conversion complete in ${elapsed}ms`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', 'attachment; filename=converted.pptx');
      res.setHeader('X-Elapsed-Time', elapsed.toString());
      res.send(pptDoc);
    } catch (error: any) {
      log(`Error converting PDF to PowerPoint: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally { if (file?.path) try { fs.unlinkSync(file.path); } catch (e) {} }
  });

  // HTML to PDF (enqueue)
  router.post('/from-html', async (req: any, res) => {
    let browser: any = null;
    try {
      let { type, content, pageSize = 'A4', orientation = 'portrait', margins = 'normal', includeBackground = true } = req.body;
      if (!type || !content) return res.status(400).json({ error: 'Type and content are required' });
      const startTime = Date.now();
      log(`Converting ${type} to PDF (size: ${pageSize}, orientation: ${orientation})`);
      const chromiumPath = getChromiumPath();
      if (!chromiumPath) return res.status(500).json({ error: 'Chromium browser not found. HTML to PDF conversion is not available.' });
      log(`Using Chromium at: ${chromiumPath}`);
      browser = await puppeteer.launch({ headless: true, executablePath: chromiumPath, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--single-process','--disable-audio-output','--disable-audio-input','--mute-audio','--disable-software-rasterizer','--disable-extensions','--disable-background-networking','--disable-sync','--disable-translate','--no-first-run','--no-zygote'], env: { ...process.env, PULSE_SERVER: 'none', DISPLAY: '' } });
      const page = await browser.newPage();
      if (type === 'url') { await browser.close(); return res.status(400).json({ error: 'Rendering remote URLs is disabled for security reasons. Please POST HTML content instead.' }); }
      await page.setRequestInterception(true);
      page.on('request', (request: any) => {
        try { const reqUrl = request.url(); if (reqUrl.startsWith('data:')||reqUrl.startsWith('blob:')||reqUrl.startsWith('about:')||reqUrl.startsWith('file:')) return request.continue(); } catch (e) {}
        return request.abort();
      });
      await page.setContent(content, { waitUntil: 'networkidle0', timeout: 30000 });
      const queue = getQueue();
      const job = queue.enqueue('from-html', { html: content, options: { pageSize, orientation, margins, includeBackground }, cleanupFiles: [] });
      await browser.close(); browser = null;
      return res.status(202).json({ jobId: job.id });
    } catch (error: any) {
      if (browser) try { await browser.close(); } catch {}
      log(`Error converting HTML to PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Repair (enqueue)
  router.post('/repair', upload.single('file'), validateUpload, async (req: any, res) => {
    try {
      const file = req.file;
      const method = (req.body?.method || 'auto') as 'auto' | 'quick' | 'deep';
      if (!file) return res.status(400).json({ error: 'PDF file is required' });
      log(`Repairing PDF with method: ${method}`);
      const queue = getQueue();
      const job = queue.enqueue('repair', { filePath: file.path, method, cleanupFiles: [file.path] });
      return res.status(202).json({ jobId: job.id });
    } catch (error: any) {
      log(`Error repairing PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
