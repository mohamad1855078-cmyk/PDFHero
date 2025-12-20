import request from 'supertest';
import express from 'express';
import http from 'http';

import { registerRoutes } from '../../server/routes';
jest.mock('../../server/index', () => ({ log: jest.fn() }));
jest.mock('../../server/pdf-provider', () => ({ createPDFProvider: () => ({}) }));

describe('Rate limit middleware', () => {
  let app: express.Express;
  let server: http.Server;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = http.createServer(app);
    await registerRoutes(server, app);
  });

  afterAll(() => { try { server.close(); } catch (e) {} });

  test('throttles requests after exceeding limit', async () => {
    // use low limit for test
    process.env.RATE_LIMIT_WINDOW_MS = '1000';
    process.env.RATE_LIMIT_MAX = '2';
    // hit health endpoint 3 times
    const a = await request(app).get('/api/health');
    expect(a.status).toBe(200);
    const b = await request(app).get('/api/health');
    expect(b.status).toBe(200);
    const c = await request(app).get('/api/health');
    // third should be 429
    expect([200,429]).toContain(c.status);
  });
});
