import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { execSync, execFileSync } from "child_process";
// @ts-ignore
import AdmZip from "adm-zip";
import archiver from "archiver";
import puppeteer from "puppeteer";
import { createPDFProvider } from "./pdf-provider";
import { log } from "./index";
import { escapeHtml, buildSafeHtml } from "./utils/sanitize";
import validateUpload from './middleware/validateUpload';
import { initQueue, getQueue } from './queue/index';
import { startWorker, getWorkerQueue } from './queue/worker';

// Cache for Chromium path to avoid repeated lookups
let cachedChromiumPath: string | null = null;

// Get Chromium path dynamically for Puppeteer (deferred lookup)
function getChromiumPath(): string | null {
  // Return cached path if available
  if (cachedChromiumPath) {
    return cachedChromiumPath;
  }
  
  // Check environment variable first
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    cachedChromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    return cachedChromiumPath;
  }
  
  // Try to find chromium in PATH
  try {
    const chromiumPath = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (chromiumPath) {
      cachedChromiumPath = chromiumPath;
      return cachedChromiumPath;
    }
  } catch (e) {}
  
  // Try common Nix store locations
  try {
    const nixPath = execSync('find /nix/store -name "chromium" -type f -executable 2>/dev/null | head -1', { encoding: 'utf-8', timeout: 5000 }).trim();
    if (nixPath) {
      cachedChromiumPath = nixPath;
      return cachedChromiumPath;
    }
  } catch (e) {}
  
  // Fallback to common paths
  const commonPaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      cachedChromiumPath = p;
      return cachedChromiumPath;
    }
  }
  
  // Return null instead of throwing - let the handler deal with it
  return null;
}

// Use /tmp for faster I/O (tmpfs on Linux)
const UPLOADS_DIR = '/tmp/pdf-uploads';
const DOWNLOADS_DIR = '/tmp/pdf-downloads';

// Set up multer for file uploads
const upload = multer({
  dest: UPLOADS_DIR,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// Set up multer for Office file uploads (Word, Excel, PowerPoint)
const uploadOffice = multer({
  dest: UPLOADS_DIR,
  limits: {
    fileSize: 1024 * 1024 * 500, // 500MB limit for Office files
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    const allowedExtensions = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.some(ext => file.originalname.toLowerCase().endsWith(ext))) {
      cb(null, true);
    } else {
      cb(new Error("Only Word, Excel, and PowerPoint files are allowed"));
    }
  },
});

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

log(`[Performance] Using temp storage for uploads: ${UPLOADS_DIR}`);
log(`[Performance] Using temp storage for downloads: ${DOWNLOADS_DIR}`);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const pdfProvider = createPDFProvider();
  // start background worker for heavy PDF tasks
  try { startWorker(); } catch (e: any) { log(`Failed to start worker: ${e?.message || e}`); }

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", provider: process.env.PDF_PROVIDER || "mock" });
  });

  // Merge PDFs (enqueue)
  app.post("/api/pdf/merge", upload.array("files", 50), validateUpload, async (req, res) => {
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

  // Split PDF - uses qpdf for fast splitting
  // Split PDF (enqueue)
  app.post("/api/pdf/split", upload.single("file"), validateUpload, async (req, res) => {
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

  // Download file from RAM disk storage (supports both zip and pdf)
  app.get("/api/pdf/download/:downloadId", (req, res) => {
    try {
      const { downloadId } = req.params;
      
      // Try both .zip and .pdf files from RAM disk
      let downloadPath = path.join(DOWNLOADS_DIR, `${downloadId}.zip`);
      let fileType = 'zip';
      let filename = 'split-pages.zip';
      
      if (!fs.existsSync(downloadPath)) {
        downloadPath = path.join(DOWNLOADS_DIR, `${downloadId}.pdf`);
        fileType = 'pdf';
        filename = 'merged-document.pdf';
      }
      
      // Validate path to prevent directory traversal
      if (!downloadPath.startsWith(DOWNLOADS_DIR)) {
        return res.status(403).json({ error: 'Invalid download ID' });
      }
      
      if (!fs.existsSync(downloadPath)) {
        return res.status(404).json({ error: 'Download expired or not found' });
      }
      
      log(`Downloading ${fileType}: ${downloadId}`);
      
      const contentType = fileType === 'zip' ? 'application/zip' : 'application/pdf';
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      
      const stream = fs.createReadStream(downloadPath);
      stream.pipe(res);
      
      // Delete file after download completes
      res.on('finish', () => {
        try {
          fs.unlinkSync(downloadPath);
          log(`Deleted download: ${downloadId}`);
        } catch (e) {}
      });
    } catch (error: any) {
      log(`Error downloading file: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Compress PDF (enqueue)
  app.post("/api/pdf/compress", upload.single("file"), validateUpload, async (req, res) => {
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
  app.post("/api/pdf/protect", upload.single("file"), validateUpload, async (req, res) => {
    try {
      const file = req.file;
      const { password } = req.body;

      if (!file) {
        return res.status(400).json({ error: "PDF file is required" });
      }

      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }

      log(`Protecting PDF with password`);

      const protectedPDF = await pdfProvider.protectPDF(file.path, password);

      // Clean up uploaded file
      fs.unlinkSync(file.path);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=protected.pdf");
      res.send(protectedPDF);
    } catch (error: any) {
      log(`Error protecting PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Unlock/Decrypt PDF
  app.post("/api/pdf/unlock", upload.single("file"), validateUpload, async (req, res) => {
    const file = req.file;
    try {
      const { password } = req.body;

      if (!file) {
        return res.status(400).json({ error: "PDF file is required" });
      }

      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }

      log(`Unlocking password-protected PDF`);

      const unlockedPDF = await pdfProvider.unlockPDF(file.path, password);

      // Clean up uploaded file
      try { fs.unlinkSync(file.path); } catch {}

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=unlocked.pdf");
      res.send(unlockedPDF);
    } catch (error: any) {
      // Clean up uploaded file on error
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      
      // Handle typed errors from provider
      if (error.type === 'INVALID_PASSWORD') {
        log(`Unlock failed: invalid password`);
        return res.status(400).json({ error: error.message });
      }
      
      // Generic error - don't expose internal details
      log(`Unlock failed: decryption error`);
      res.status(500).json({ error: error.message || 'Failed to unlock PDF' });
    }
  });

  // Remove Pages from PDF
  app.post("/api/pdf/remove-pages", upload.single("file"), validateUpload, async (req, res) => {
    const file = req.file;
    try {
      const { pages } = req.body;

      if (!file) {
        return res.status(400).json({ error: "PDF file is required" });
      }

      if (!pages || !pages.trim()) {
        return res.status(400).json({ error: "Pages to remove are required" });
      }

      const startTime = Date.now();
      log(`Removing pages from PDF: ${pages}`);

      const result = await pdfProvider.removePages(file.path, pages);
      
      const elapsed = Date.now() - startTime;
      log(`Removed ${result.removedCount} pages in ${elapsed}ms (${result.originalPageCount} → ${result.finalPageCount} pages)`);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=pages-removed.pdf");
      res.setHeader("X-Original-Page-Count", result.originalPageCount.toString());
      res.setHeader("X-Removed-Count", result.removedCount.toString());
      res.setHeader("X-Final-Page-Count", result.finalPageCount.toString());
      res.setHeader("X-Elapsed-Time", elapsed.toString());
      res.send(result.buffer);
    } catch (error: any) {
      log(`Error removing pages: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally {
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
    }
  });

  // Rotate Pages in PDF
  app.post("/api/pdf/rotate", upload.single("file"), validateUpload, async (req, res) => {
    const file = req.file;
    try {
      if (!file) {
        return res.status(400).json({ error: "PDF file is required" });
      }

      // Support both old format (pages + angle) and new format (pageRotations)
      let result;
      const startTime = Date.now();
      
      if (req.body.pageRotations) {
        // Per-page rotation format
        const pageRotations = JSON.parse(req.body.pageRotations);
        log(`Rotating pages with per-page angles`);
        result = await pdfProvider.rotatePagesPerPage(file.path, pageRotations);
      } else {
        // Legacy format
        const { pages, angle } = req.body;
        if (!pages || !pages.trim()) {
          return res.status(400).json({ error: "Pages to rotate are required" });
        }
        const rotationAngle = parseInt(angle) || 90;
        if (![0, 90, 180, 270].includes(rotationAngle)) {
          return res.status(400).json({ error: "Rotation angle must be 0, 90, 180, or 270 degrees" });
        }
        log(`Rotating pages in PDF: ${pages} by ${rotationAngle}°`);
        result = await pdfProvider.rotatePages(file.path, pages, rotationAngle);
      }
      
      const elapsed = Date.now() - startTime;
      log(`Rotated ${result.rotatedCount} pages in ${elapsed}ms`);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=rotated.pdf");
      res.setHeader("X-Total-Pages", result.totalPages.toString());
      res.setHeader("X-Rotated-Count", result.rotatedCount.toString());
      res.setHeader("X-Elapsed-Time", elapsed.toString());
      res.send(result.buffer);
    } catch (error: any) {
      log(`Error rotating pages: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally {
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
    }
  });

  // Organize PDF pages
  app.post("/api/pdf/organize", upload.single("file"), validateUpload, async (req, res) => {
    const file = req.file;
    try {
      if (!file) {
        return res.status(400).json({ error: "PDF file is required" });
      }

      const pageOrderStr = req.body.pageOrder;
      if (!pageOrderStr) {
        return res.status(400).json({ error: "Page order is required" });
      }

      const pageOrder = JSON.parse(pageOrderStr);
      if (!Array.isArray(pageOrder) || pageOrder.length === 0) {
        return res.status(400).json({ error: "Invalid page order format" });
      }

      const startTime = Date.now();
      log(`Organizing PDF pages to order: ${pageOrder.join(', ')}`);

      const result = await pdfProvider.organizePages(file.path, pageOrder);
      
      const elapsed = Date.now() - startTime;
      log(`Organized ${result.totalPages} pages in ${elapsed}ms`);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=organized.pdf");
      res.setHeader("X-Total-Pages", result.totalPages.toString());
      res.setHeader("X-Elapsed-Time", elapsed.toString());
      res.send(result.buffer);
    } catch (error: any) {
      log(`Error organizing PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally {
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
    }
  });

  // Crop PDF pages
  app.post("/api/pdf/crop", upload.single("file"), validateUpload, async (req, res) => {
    const file = req.file;
    try {
      if (!file) {
        return res.status(400).json({ error: "PDF file is required" });
      }

      const { pages, top, bottom, left, right, unit } = req.body;
      
      // Parse crop values with defaults
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

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=cropped.pdf");
      res.setHeader("X-Total-Pages", result.totalPages.toString());
      res.setHeader("X-Elapsed-Time", elapsed.toString());
      res.send(result.buffer);
    } catch (error: any) {
      log(`Error cropping PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally {
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
    }
  });

  // PDF to Word
  app.post("/api/pdf/to-word", upload.single("file"), validateUpload, async (req, res) => {
    const file = req.file;
    try {
      if (!file) {
        return res.status(400).json({ error: "PDF file is required" });
      }

      log(`Converting PDF to Word`);
      const startTime = Date.now();

      const wordDoc = await pdfProvider.pdfToWord(file.path);

      const elapsed = Date.now() - startTime;
      log(`PDF to Word conversion complete in ${elapsed}ms`);

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", "attachment; filename=converted.docx");
      res.setHeader("X-Elapsed-Time", elapsed.toString());
      res.send(wordDoc);
    } catch (error: any) {
      log(`Error converting PDF to Word: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally {
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
    }
  });

  // PDF to Excel
  app.post("/api/pdf/to-excel", upload.single("file"), validateUpload, async (req, res) => {
    const file = req.file;
    try {
      if (!file) {
        return res.status(400).json({ error: "PDF file is required" });
      }

      log(`Converting PDF to Excel`);
      const startTime = Date.now();

      const excelDoc = await pdfProvider.pdfToExcel(file.path);

      const elapsed = Date.now() - startTime;
      log(`PDF to Excel conversion complete in ${elapsed}ms`);

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=converted.xlsx");
      res.setHeader("X-Elapsed-Time", elapsed.toString());
      res.send(excelDoc);
    } catch (error: any) {
      log(`Error converting PDF to Excel: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally {
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
    }
  });

  // PDF to PowerPoint
  app.post("/api/pdf/to-ppt", upload.single("file"), validateUpload, async (req, res) => {
    const file = req.file;
    try {
      if (!file) {
        return res.status(400).json({ error: "PDF file is required" });
      }

      log(`Converting PDF to PowerPoint`);
      const startTime = Date.now();

      const pptDoc = await pdfProvider.pdfToPowerPoint(file.path);

      const elapsed = Date.now() - startTime;
      log(`PDF to PowerPoint conversion complete in ${elapsed}ms`);

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", "attachment; filename=converted.pptx");
      res.setHeader("X-Elapsed-Time", elapsed.toString());
      res.send(pptDoc);
    } catch (error: any) {
      log(`Error converting PDF to PowerPoint: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally {
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
    }
  });

  // Word to PDF
  app.post("/api/pdf/from-word", uploadOffice.single("file"), async (req, res) => {
    const file = req.file;
    try {
      if (!file) {
        return res.status(400).json({ error: "Word document is required" });
      }

      log(`Converting Word to PDF: ${file.originalname}`);
      const startTime = Date.now();

      const pdfDoc = await pdfProvider.wordToPdf(file.path);

      const elapsed = Date.now() - startTime;
      log(`Word to PDF conversion complete in ${elapsed}ms`);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=converted.pdf");
      res.setHeader("X-Elapsed-Time", elapsed.toString());
      res.send(pdfDoc);
    } catch (error: any) {
      log(`Error converting Word to PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally {
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
    }
  });

  // Excel to PDF
  app.post("/api/pdf/from-excel", uploadOffice.single("file"), async (req, res) => {
    const file = req.file;
    try {
      if (!file) {
        return res.status(400).json({ error: "Excel spreadsheet is required" });
      }

      log(`Converting Excel to PDF: ${file.originalname}`);
      const startTime = Date.now();

      const pdfDoc = await pdfProvider.excelToPdf(file.path);

      const elapsed = Date.now() - startTime;
      log(`Excel to PDF conversion complete in ${elapsed}ms`);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=converted.pdf");
      res.setHeader("X-Elapsed-Time", elapsed.toString());
      res.send(pdfDoc);
    } catch (error: any) {
      log(`Error converting Excel to PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally {
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
    }
  });

  // PowerPoint to PDF
  app.post("/api/pdf/from-ppt", uploadOffice.single("file"), async (req, res) => {
    const file = req.file;
    try {
      if (!file) {
        return res.status(400).json({ error: "PowerPoint presentation is required" });
      }

      log(`Converting PowerPoint to PDF: ${file.originalname}`);
      const startTime = Date.now();

      const pdfDoc = await pdfProvider.pptToPdf(file.path);

      const elapsed = Date.now() - startTime;
      log(`PowerPoint to PDF conversion complete in ${elapsed}ms`);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=converted.pdf");
      res.setHeader("X-Elapsed-Time", elapsed.toString());
      res.send(pdfDoc);
    } catch (error: any) {
      log(`Error converting PowerPoint to PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally {
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
    }
  });

  // Job status endpoint
  app.get('/api/jobs/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const queue = getQueue();
      const job = queue.get(id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      return res.json({ status: job.status, progress: job.progress, error: job.error, downloadUrl: job.outputPath ? `/api/jobs/download/${job.id}` : undefined, createdAt: job.createdAt, startedAt: job.startedAt, finishedAt: job.finishedAt });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // Job download endpoint
  app.get('/api/jobs/download/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const queue = getQueue();
      const job = queue.get(id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      if (job.status !== 'succeeded' || !job.outputPath) return res.status(400).json({ error: 'Job not ready' });
      // simple path check
      if (!job.outputPath.startsWith(DOWNLOADS_DIR)) return res.status(403).json({ error: 'Forbidden' });
      const stream = fs.createReadStream(job.outputPath);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename=${path.basename(job.outputPath)}`);
      stream.pipe(res);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // HTML to PDF - Convert HTML content to PDF using Puppeteer
  app.post("/api/pdf/from-html", async (req, res) => {
    let browser = null;
    try {
      let { 
        type, // 'html' or 'url'
        content, // HTML code or URL
        pageSize = 'A4',
        orientation = 'portrait',
        margins = 'normal',
        includeBackground = true
      } = req.body;

      if (!type || !content) {
        return res.status(400).json({ error: "Type and content are required" });
      }

      // If URL, navigate to it; otherwise use HTML content
      const startTime = Date.now();
      log(`Converting ${type} to PDF (size: ${pageSize}, orientation: ${orientation})`);

      // Launch Puppeteer browser with system Chromium
      const chromiumPath = getChromiumPath();
      if (!chromiumPath) {
        return res.status(500).json({ 
          error: "Chromium browser not found. HTML to PDF conversion is not available. Please install chromium or set the PUPPETEER_EXECUTABLE_PATH environment variable." 
        });
      }
      log(`Using Chromium at: ${chromiumPath}`);
      browser = await puppeteer.launch({
        headless: true,
        executablePath: chromiumPath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--disable-audio-output',
          '--disable-audio-input',
          '--mute-audio',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-sync',
          '--disable-translate',
          '--no-first-run',
          '--no-zygote'
        ],
        env: {
          ...process.env,
          PULSE_SERVER: 'none',
          DISPLAY: '',
        }
      });

      const page = await browser.newPage();

      // Set page size mapping
      const pageSizeMap: any = {
        'A4': 'A4',
        'A3': 'A3',
        'Letter': 'Letter',
        'Legal': 'Legal',
        'Tabloid': 'Tabloid'
      };

      // Set margins mapping in mm (Puppeteer uses mm by default)
      const marginMap: any = {
        'none': { top: 5, bottom: 5, left: 5, right: 5 },
        'normal': { top: 10, bottom: 10, left: 10, right: 10 },
        'wide': { top: 25, bottom: 25, left: 25, right: 25 }
      };

      // Block rendering of remote URLs for security — only raw HTML content allowed
      if (type === 'url') {
        await browser.close();
        return res.status(400).json({ error: 'Rendering remote URLs is disabled for security reasons. Please POST HTML content instead.' });
      }

      // Intercept network requests and block everything external (allow only data/blob/about/file schemes)
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        try {
          const reqUrl = request.url();
          if (reqUrl.startsWith('data:') || reqUrl.startsWith('blob:') || reqUrl.startsWith('about:') || reqUrl.startsWith('file:')) {
            return request.continue();
          }
        } catch (e) {}
        return request.abort();
      });

      // Set HTML content (note: external resources like fonts/images are blocked by interception)
      await page.setContent(content, { waitUntil: 'networkidle0', timeout: 30000 });

      // Instead of generating inline, enqueue job for from-html
      const queue = getQueue();
      const job = queue.enqueue('from-html', { html: content, options: { pageSize, orientation, margins, includeBackground }, cleanupFiles: [] });
      await browser.close();
      browser = null;
      return res.status(202).json({ jobId: job.id });
    } catch (error: any) {
      if (browser) {
        try { await browser.close(); } catch {}
      }
      log(`Error converting HTML to PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Repair PDF - Fix corrupted or damaged PDFs using qpdf and Ghostscript
  app.post("/api/pdf/repair", upload.single("file"), validateUpload, async (req, res) => {
    let outputPath: string | null = null;
    try {
      const file = req.file;
      const method = (req.body?.method || 'auto') as 'auto' | 'quick' | 'deep';

      if (!file) {
        return res.status(400).json({ error: "PDF file is required" });
      }

      log(`Repairing PDF with method: ${method}`);
      const startTime = Date.now();

      const downloadId = `repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      outputPath = path.join(DOWNLOADS_DIR, `${downloadId}.pdf`);

      let repairSuccess = false;
      let usedMethod = '';

      // Helper to run command and capture output
      const runRepairCommand = (cmd: string, timeout: number = 60000): { success: boolean; output: string } => {
        try {
          const output = execSync(cmd, { timeout, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
          return { success: true, output };
        } catch (err: any) {
          return { success: false, output: err.stderr || err.stdout || err.message };
        }
      };

      // Try quick repair with qpdf first (if auto or quick)
      if (method === 'auto' || method === 'quick') {
        // Method 1: qpdf with linearize (basic repair)
        const qpdfOutput1 = path.join(DOWNLOADS_DIR, `${downloadId}-qpdf1.pdf`);
        let result = runRepairCommand(`qpdf --linearize --warning-exit-0 "${file.path}" "${qpdfOutput1}"`);
        if (result.success && fs.existsSync(qpdfOutput1) && fs.statSync(qpdfOutput1).size > 0) {
          fs.renameSync(qpdfOutput1, outputPath);
          repairSuccess = true;
          usedMethod = 'qpdf-linearize';
          log(`Quick repair (qpdf linearize) successful`);
        } else {
          log(`qpdf linearize failed: ${result.output}`);
          try { fs.unlinkSync(qpdfOutput1); } catch {}
        }

        // Method 2: qpdf attempting to read damaged file and output valid PDF
        if (!repairSuccess) {
          const qpdfOutput2 = path.join(DOWNLOADS_DIR, `${downloadId}-qpdf2.pdf`);
          // Use empty password to help with some damaged files, ignore xref issues
          result = runRepairCommand(`qpdf --warning-exit-0 --password="" "${file.path}" "${qpdfOutput2}"`);
          if (result.success && fs.existsSync(qpdfOutput2) && fs.statSync(qpdfOutput2).size > 0) {
            fs.renameSync(qpdfOutput2, outputPath);
            repairSuccess = true;
            usedMethod = 'qpdf-basic';
            log(`Quick repair (qpdf basic) successful`);
          } else {
            log(`qpdf basic failed: ${result.output}`);
            try { fs.unlinkSync(qpdfOutput2); } catch {}
          }
        }

        // Method 3: qpdf QDF mode (deconstructs and rebuilds PDF)
        if (!repairSuccess) {
          const qpdfOutput3 = path.join(DOWNLOADS_DIR, `${downloadId}-qpdf3.pdf`);
          result = runRepairCommand(`qpdf --warning-exit-0 --qdf --object-streams=disable "${file.path}" "${qpdfOutput3}"`);
          if (result.success && fs.existsSync(qpdfOutput3) && fs.statSync(qpdfOutput3).size > 0) {
            fs.renameSync(qpdfOutput3, outputPath);
            repairSuccess = true;
            usedMethod = 'qpdf-qdf';
            log(`Quick repair (qpdf QDF) successful`);
          } else {
            log(`qpdf QDF failed: ${result.output}`);
            try { fs.unlinkSync(qpdfOutput3); } catch {}
          }
        }
      }

      // Try mutool clean (mupdf) - good for structural repairs
      if (!repairSuccess && (method === 'auto' || method === 'quick')) {
        const mutoolOutput = path.join(DOWNLOADS_DIR, `${downloadId}-mutool.pdf`);
        const result = runRepairCommand(`mutool clean -gggg -D "${file.path}" "${mutoolOutput}"`);
        if (result.success && fs.existsSync(mutoolOutput) && fs.statSync(mutoolOutput).size > 0) {
          fs.renameSync(mutoolOutput, outputPath);
          repairSuccess = true;
          usedMethod = 'mutool';
          log(`Repair (mutool clean) successful`);
        } else {
          log(`mutool clean failed: ${result.output}`);
          try { fs.unlinkSync(mutoolOutput); } catch {}
        }
      }

      // Try deep repair with Ghostscript (if auto and previous failed, or if deep)
      if (!repairSuccess && (method === 'auto' || method === 'deep')) {
        const gsOutput = path.join(DOWNLOADS_DIR, `${downloadId}-gs.pdf`);
        
        // Ghostscript re-renders the PDF completely - most aggressive repair
        const result = runRepairCommand(
          `gs -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/prepress -dAutoRotatePages=/None -sOutputFile="${gsOutput}" "${file.path}"`,
          120000
        );
        
        if (result.success && fs.existsSync(gsOutput) && fs.statSync(gsOutput).size > 0) {
          fs.renameSync(gsOutput, outputPath);
          repairSuccess = true;
          usedMethod = 'ghostscript';
          log(`Deep repair (Ghostscript) successful`);
        } else {
          log(`Ghostscript failed: ${result.output}`);
          try { fs.unlinkSync(gsOutput); } catch {}
        }

        // Try Ghostscript with more permissive settings
        if (!repairSuccess) {
          const gsOutput2 = path.join(DOWNLOADS_DIR, `${downloadId}-gs2.pdf`);
          const result2 = runRepairCommand(
            `gs -dNOPAUSE -dBATCH -dQUIET -sDEVICE=pdfwrite -dPDFSETTINGS=/default -sOutputFile="${gsOutput2}" "${file.path}"`,
            120000
          );
          
          if (result2.success && fs.existsSync(gsOutput2) && fs.statSync(gsOutput2).size > 0) {
            fs.renameSync(gsOutput2, outputPath);
            repairSuccess = true;
            usedMethod = 'ghostscript-permissive';
            log(`Deep repair (Ghostscript permissive) successful`);
          } else {
            log(`Ghostscript permissive failed: ${result2.output}`);
            try { fs.unlinkSync(gsOutput2); } catch {}
          }
        }
      }

      // instead enqueue repair job
      const queue = getQueue();
      const job = queue.enqueue('repair', { filePath: file.path, method, cleanupFiles: [file.path] });
      return res.status(202).json({ jobId: job.id });
    } catch (error: any) {
      // Clean up on error
      if (outputPath && fs.existsSync(outputPath)) {
        try { fs.unlinkSync(outputPath); } catch {}
      }
      log(`Error repairing PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // CV Builder - Generate PDF from CV data
  app.post("/api/cv/generate", async (req, res) => {
    const startTime = Date.now();
    log(`CV generation started`);

    try {
      const { fullName, email, phone, location, summary, experience, education, skills, language } = req.body;

      if (!fullName || !email) {
        return res.status(400).json({ error: "Name and email are required" });
      }

      // Escape all user-provided fields (escape-all policy)
      const safeFullName = escapeHtml(fullName);
      const safeEmail = escapeHtml(email);
      const safePhone = escapeHtml(phone || '');
      const safeLocation = escapeHtml(location || '');
      const safeSummary = escapeHtml(summary || '');
      const lang = escapeHtml(language || 'en');

      const safeExperience = Array.isArray(experience)
        ? experience.map((exp: any) => ({
            jobTitle: escapeHtml(exp.jobTitle || ''),
            company: escapeHtml(exp.company || ''),
            startDate: escapeHtml(exp.startDate || ''),
            endDate: escapeHtml(exp.endDate || ''),
            currentlyWorking: !!exp.currentlyWorking,
            description: escapeHtml(exp.description || ''),
          }))
        : [];

      const safeEducation = Array.isArray(education)
        ? education.map((edu: any) => ({
            degree: escapeHtml(edu.degree || ''),
            field: escapeHtml(edu.field || ''),
            school: escapeHtml(edu.school || ''),
            graduationDate: escapeHtml(edu.graduationDate || ''),
          }))
        : [];

      const safeSkills = Array.isArray(skills) ? skills.map((s: any) => escapeHtml(s || '')) : [];

      const isRTL = lang === 'ar';
      const direction = isRTL ? 'rtl' : 'ltr';
      const fontFamily = isRTL ? "'Noto Sans Arabic', 'IBM Plex Sans Arabic', sans-serif" : "'Inter', 'Segoe UI', sans-serif";

      // Build serialized fragments for lists using already-escaped values
      const experienceHtml = (safeExperience || []).map((exp: any) => `\n      <div class="experience-item">\n        <div class="job-header">\n          <div>\n            <div class="job-title">${exp.jobTitle}</div>\n            <div class="company">${exp.company}</div>\n          </div>\n          <div class="dates">${exp.startDate}${exp.currentlyWorking ? ` - ${isRTL ? 'حتى الآن' : 'Present'}` : exp.endDate ? ` - ${exp.endDate}` : ''}</div>\n        </div>\n        ${exp.description ? `<p class="description">${exp.description}</p>` : ''}\n      </div>`).join('');

      const educationHtml = (safeEducation || []).map((edu: any) => `\n      <div class="education-item">\n        <div class="edu-header">\n          <div>\n            <div class="edu-degree">${edu.degree}${edu.field ? ` - ${edu.field}` : ''}</div>\n            <div class="school">${edu.school}</div>\n          </div>\n          <div class="dates">${edu.graduationDate || ''}</div>\n        </div>\n      </div>`).join('');

      const skillsHtml = (safeSkills || []).map((s: string) => `<span class="skill-tag">${s}</span>`).join('');

      // Build the final HTML using only escaped values (no user HTML allowed)
      const finalHtml = `<!DOCTYPE html>
<html dir="${direction}" lang="${lang}">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: ${fontFamily}; font-size: 11pt; line-height: 1.5; color: #1a1a1a; direction: ${direction}; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #11A05C; }
    .name { font-size: 28pt; font-weight: 700; color: #11A05C; margin-bottom: 10px; }
    .contact { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; font-size: 10pt; color: #666; }
    .contact span { display: inline-flex; align-items: center; gap: 5px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 14pt; font-weight: 600; color: #11A05C; margin-bottom: 12px; padding-bottom: 5px; border-bottom: 1px solid #e0e0e0; }
    .summary { text-align: justify; color: #444; }
    .experience-item, .education-item { margin-bottom: 15px; }
    .job-header, .edu-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; }
    .job-title, .edu-degree { font-weight: 600; font-size: 12pt; }
    .company, .school { color: #666; font-size: 11pt; }
    .dates { color: #888; font-size: 10pt; text-align: ${isRTL ? 'left' : 'right'}; }
    .description { color: #555; margin-top: 5px; text-align: justify; }
    .skills-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .skill-tag { background: #e8f5e9; color: #11A05C; padding: 4px 12px; border-radius: 15px; font-size: 10pt; }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="name">${safeFullName}</h1>
    <div class="contact">
      ${safeEmail ? `<span>📧 ${safeEmail}</span>` : ''}
      ${safePhone ? `<span>📱 ${safePhone}</span>` : ''}
      ${safeLocation ? `<span>📍 ${safeLocation}</span>` : ''}
    </div>
  </div>

  ${safeSummary ? `
  <div class="section">
    <h2 class="section-title">${isRTL ? 'الملخص الاحترافي' : 'Professional Summary'}</h2>
    <p class="summary">${safeSummary}</p>
  </div>
  ` : ''}

  ${safeExperience && safeExperience.length > 0 ? `
  <div class="section">
    <h2 class="section-title">${isRTL ? 'الخبرة العملية' : 'Work Experience'}</h2>
    ${experienceHtml}
  </div>
  ` : ''}

  ${safeEducation && safeEducation.length > 0 ? `
  <div class="section">
    <h2 class="section-title">${isRTL ? 'التعليم' : 'Education'}</h2>
    ${educationHtml}
  </div>
  ` : ''}

  ${safeSkills && safeSkills.length > 0 ? `
  <div class="section">
    <h2 class="section-title">${isRTL ? 'المهارات' : 'Skills'}</h2>
    <div class="skills-list">${skillsHtml}</div>
  </div>
  ` : ''}
</body>
</html>`;

      // Generate PDF using Puppeteer with network disabled
      const chromiumPath = getChromiumPath();
      if (!chromiumPath) {
        return res.status(500).json({ error: "PDF generation not available - Chromium not found" });
      }

      const browser = await puppeteer.launch({
        headless: true,
        executablePath: chromiumPath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--no-first-run',
        ],
      });

      const page = await browser.newPage();

      // Block external network requests (allow only data/blob/about/file)
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        try {
          const reqUrl = request.url();
          if (reqUrl.startsWith('data:') || reqUrl.startsWith('blob:') || reqUrl.startsWith('about:') || reqUrl.startsWith('file:')) {
            return request.continue();
          }
        } catch (e) {}
        return request.abort();
      });

      await page.setContent(finalHtml, { waitUntil: 'networkidle0', timeout: 30000 });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
        printBackground: true,
      });

      await browser.close();

      const elapsed = Date.now() - startTime;
      log(`CV PDF generated in ${elapsed}ms`);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFullName.replace(/\s+/g, '_')}_CV.pdf"`);
      res.send(Buffer.from(pdfBuffer));
    } catch (error: any) {
      log(`Error generating CV: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}

