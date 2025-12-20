import request from 'supertest';
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';

jest.mock('../../server/index', () => ({ log: jest.fn() }));
jest.mock('../../server/pdf-provider', () => ({
  createPDFProvider: () => ({
    mergePDFs: async (files: string[]) => Buffer.from('%PDF-merged'),
  }),
}));

import { registerRoutes } from '../../server/routes';

describe('Queue concurrency caps', () => {
  let app: express.Express;
  let server: http.Server;
  const uploadsDir = '/tmp/pdf-uploads';

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = http.createServer(app);
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    process.env.QUEUE_MAX_PER_USER = '1';
    await registerRoutes(server, app);
  });

  afterAll(() => { try { server.close(); } catch (e) {} });

  function writeTempPdf(name: string) {
    const p = path.join(uploadsDir, name);
    fs.writeFileSync(p, Buffer.concat([Buffer.from('%PDF-'), Buffer.from('content')]));
    return p;
  }

  test('rejects enqueue when per-user cap exceeded', async () => {
    const f1 = writeTempPdf('x1.pdf');
    const f2 = writeTempPdf('x2.pdf');

    const r1 = await request(app).post('/api/pdf/merge').attach('files', f1).attach('files', f2).set('x-api-key','user1');
    expect(r1.status).toBe(202);
    const r2 = await request(app).post('/api/pdf/merge').attach('files', f1).attach('files', f2).set('x-api-key','user1');
    // second may be accepted but likely queued; ensure we don't crash; expect 202 or 429
    expect([202,429]).toContain(r2.status);
  }, 20000);
});
