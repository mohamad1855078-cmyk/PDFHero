import fs from 'fs';
import path from 'path';
import { RequestHandler } from 'express';

const DEFAULT_MAX_FILE = 30 * 1024 * 1024; // 30 MB
const DEFAULT_MAX_TOTAL = 120 * 1024 * 1024; // 120 MB
const DEFAULT_MAX_FILES = 10;

export function getEnvLimits() {
  const maxFile = parseInt(process.env.UPLOAD_MAX_FILE_SIZE || '') || DEFAULT_MAX_FILE;
  const maxTotal = parseInt(process.env.UPLOAD_MAX_TOTAL_SIZE || '') || DEFAULT_MAX_TOTAL;
  const maxFiles = parseInt(process.env.UPLOAD_MAX_FILES || '') || DEFAULT_MAX_FILES;
  return { maxFile, maxTotal, maxFiles };
}

export async function checkPdfMagic(filePath: string): Promise<boolean> {
  // PDF files start with '%PDF-' (0x25 0x50 0x44 0x46 0x2D)
  const fd = await fs.promises.open(filePath, 'r');
  try {
    const { buffer } = await fd.read(Buffer.alloc(5), 0, 5, 0);
    const sig = buffer.toString('utf8', 0, buffer.length);
    return sig === '%PDF-';
  } finally {
    await fd.close();
  }
}

async function unlinkSafe(p: string) {
  try { await fs.promises.unlink(p); } catch (e) { }
}

function cleanupFiles(files: Express.Multer.File[] | undefined) {
  if (!files) return;
  for (const f of files) {
    try { fs.unlinkSync(f.path); } catch (e) {}
  }
}

export const validateUpload: RequestHandler = async (req, res, next) => {
  try {
    const { maxFile, maxTotal, maxFiles } = getEnvLimits();

    // Collect upload files
    let files: Express.Multer.File[] = [];
    if ((req as any).file) files = [(req as any).file];
    else if (Array.isArray((req as any).files)) files = (req as any).files as Express.Multer.File[];
    else if (req.files && typeof req.files === 'object') {
      // multer can produce object for fields; flatten
      const fobj = req.files as { [fieldname: string]: Express.Multer.File[] };
      for (const k of Object.keys(fobj)) files = files.concat(fobj[k]);
    }

    if (files.length === 0) return next();

    if (files.length > maxFiles) {
      cleanupFiles(files);
      return res.status(400).json({ code: 'UPLOAD_TOO_MANY_FILES', message: `Maximum ${maxFiles} files allowed` });
    }

    let total = 0;
    for (const f of files) {
      total += f.size || 0;
      if ((f.size || 0) > maxFile) {
        cleanupFiles(files);
        return res.status(400).json({ code: 'UPLOAD_TOO_LARGE', message: `File ${f.originalname} exceeds max file size` });
      }
    }

    if (total > maxTotal) {
      cleanupFiles(files);
      return res.status(400).json({ code: 'UPLOAD_TOTAL_TOO_LARGE', message: `Total upload size exceeds limit` });
    }

    // Check magic bytes for PDFs only (if file looks like .pdf or mimetype pdf)
    for (const f of files) {
      const lower = (f.originalname || '').toLowerCase();
      const mimetype = f.mimetype || '';
      if (lower.endsWith('.pdf') || mimetype === 'application/pdf') {
        const ok = await checkPdfMagic(f.path);
        if (!ok) {
          cleanupFiles(files);
          return res.status(400).json({ code: 'UPLOAD_INVALID_MAGIC', message: `Invalid PDF magic bytes for ${f.originalname}` });
        }
      }
    }

    // all good
    return next();
  } catch (err: any) {
    // On error, attempt to clean up any uploaded files
    try {
      if ((req as any).file) await unlinkSafe((req as any).file.path);
      else if (Array.isArray((req as any).files)) {
        for (const f of (req as any).files) await unlinkSafe(f.path);
      }
      else if (req.files && typeof req.files === 'object') {
        const fobj = req.files as { [field: string]: Express.Multer.File[] };
        for (const k of Object.keys(fobj)) for (const f of fobj[k]) await unlinkSafe(f.path);
      }
    } catch (_) {}
    return res.status(500).json({ code: 'UPLOAD_VALIDATION_ERROR', message: err.message || 'Validation error' });
  }
};

export default validateUpload;
