import request from 'supertest';
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Mock pdf-provider to avoid heavy processing
jest.mock('../../server/pdf-provider', () => ({
  createPDFProvider: () => ({
    compressPDF: async (_p: string, _level: any) => ({ buffer: Buffer.from('%PDF-1.4 mock'), originalSize: 1024, compressedSize: 512 }),
    mergePDFs: async (_files: string[]) => Buffer.from('%PDF-1.4 mock-merged'),
  }),
}));

// Mock server/index log
jest.mock('../../server/index', () => ({ log: jest.fn() }));

import { registerRoutes } from '../../server/routes';

describe('Upload validation middleware', () => {
  let app: express.Express;
  let server: http.Server;
  const uploadsDir = '/tmp/pdf-uploads';

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = http.createServer(app);
    // Ensure uploads dir exists
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    await registerRoutes(server, app);
  });

  afterAll(() => {
    try { server.close(); } catch (e) {}
  });

  function makeTempFile(contents: Buffer, name = `upload-${Date.now()}.pdf`) {
    const p = path.join(uploadsDir, name);
    fs.writeFileSync(p, contents);
    return p;
  }

  test('accepts valid PDF (magic bytes)', async () => {
    const buf = Buffer.concat([Buffer.from('%PDF-'), Buffer.from('rest of pdf')]);
    const filePath = makeTempFile(buf, 'valid.pdf');

    const res = await request(app).post('/api/pdf/compress').attach('file', filePath);
    // compress is now handled via background job -> 202 Accepted with jobId
    expect(res.status).toBe(202);
    expect(res.body.jobId).toBeDefined();

    // cleanup
    try { fs.unlinkSync(filePath); } catch (e) {}
  });

  test('rejects file with invalid magic bytes', async () => {
    const buf = Buffer.from('NOTAPDF----');
    const filePath = makeTempFile(buf, 'invalid.pdf');

    const res = await request(app).post('/api/pdf/compress').attach('file', filePath);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UPLOAD_INVALID_MAGIC');

    try { fs.unlinkSync(filePath); } catch (e) {}
  });

  test('enforces per-file size limit', async () => {
    // Set tiny max file size
    process.env.UPLOAD_MAX_FILE_SIZE = '10';
    const buf = Buffer.alloc(100, 0x20);
    const filePath = makeTempFile(buf, 'big.pdf');

    const res = await request(app).post('/api/pdf/compress').attach('file', filePath);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UPLOAD_TOO_LARGE');

    delete process.env.UPLOAD_MAX_FILE_SIZE;
    try { fs.unlinkSync(filePath); } catch (e) {}
  });

  test('enforces max files for multi upload', async () => {
    process.env.UPLOAD_MAX_FILES = '1';
    const buf = Buffer.concat([Buffer.from('%PDF-'), Buffer.from('one')]);
    const f1 = makeTempFile(buf, 'a.pdf');
    const f2 = makeTempFile(buf, 'b.pdf');

    const res = await request(app).post('/api/pdf/merge').attach('files', f1).attach('files', f2);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UPLOAD_TOO_MANY_FILES');

    delete process.env.UPLOAD_MAX_FILES;
    try { fs.unlinkSync(f1); } catch (e) {}
    try { fs.unlinkSync(f2); } catch (e) {}
  });
});
