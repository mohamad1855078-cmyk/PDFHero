import request from 'supertest';
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Mock pdf-provider heavy methods
jest.mock('../../server/pdf-provider', () => ({
  createPDFProvider: () => ({
    mergePDFs: async (files: string[]) => Buffer.from('%PDF-merged'),
    splitPDF: async (file: string) => ({ outputDir: '/tmp', pageCount: 1, files: [file] }),
    compressPDF: async (file: string) => ({ buffer: Buffer.from('%PDF-compressed'), originalSize: 1000, compressedSize: 500 }),
    htmlToPDF: async (html: string) => Buffer.from('%PDF-html'),
  }),
}));

jest.mock('../../server/index', () => ({ log: jest.fn() }));

import { registerRoutes } from '../../server/routes';

describe('Queue integration', () => {
  let app: express.Express;
  let server: http.Server;
  const uploadsDir = '/tmp/pdf-uploads';

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: '5mb' }));
    server = http.createServer(app);
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    await registerRoutes(server, app);
  });

  afterAll(() => {
    try { server.close(); } catch (e) {}
  });

  function writeTempPdf(name: string) {
    const p = path.join(uploadsDir, name);
    fs.writeFileSync(p, Buffer.concat([Buffer.from('%PDF-'), Buffer.from('content')]));
    return p;
  }

  test('enqueue merge job and get result', async () => {
    const f1 = writeTempPdf('a.pdf');
    const f2 = writeTempPdf('b.pdf');

    const res = await request(app).post('/api/pdf/merge').attach('files', f1).attach('files', f2);
    expect(res.status).toBe(202);
    expect(res.body.jobId).toBeDefined();
    const jobId = res.body.jobId;

    // poll for completion
    let status = 'queued';
    for (let i = 0; i < 20 && status !== 'succeeded'; i++) {
      // wait 200ms
      await new Promise(r => setTimeout(r, 200));
      const sres = await request(app).get(`/api/jobs/${jobId}`);
      expect(sres.status).toBe(200);
      status = sres.body.status;
      if (status === 'succeeded') {
        const dres = await request(app).get(`/api/jobs/download/${jobId}`);
        expect(dres.status).toBe(200);
        expect(dres.body.length).toBeGreaterThan(0);
        break;
      }
    }
    expect(status).toBe('succeeded');
  }, 20000);

  test('enqueue compress job failure path', async () => {
    const f = writeTempPdf('c.pdf');
    const res = await request(app).post('/api/pdf/compress').attach('file', f);
    expect(res.status).toBe(202);
    const jobId = res.body.jobId;

    // Poll until finished
    let status = 'queued';
    for (let i = 0; i < 20 && status !== 'succeeded' && status !== 'failed'; i++) {
      await new Promise(r => setTimeout(r, 200));
      const sres = await request(app).get(`/api/jobs/${jobId}`);
      status = sres.body.status;
    }
    expect(['succeeded','failed']).toContain(status);
  }, 20000);
});
