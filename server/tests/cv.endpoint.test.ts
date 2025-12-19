import request from 'supertest';
import express from 'express';
import http from 'http';

// Mock puppeteer before importing routes so the real browser isn't launched
const captured: { html?: string } = {};

jest.mock('puppeteer', () => {
  return {
    launch: jest.fn().mockImplementation(async () => ({
      newPage: async () => ({
        setRequestInterception: jest.fn(),
        on: jest.fn(),
        setContent: jest.fn().mockImplementation(async (html: string) => {
          captured.html = html;
          return Promise.resolve();
        }),
        pdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock')),
        close: jest.fn(),
      }),
      close: jest.fn(),
    })),
  };
});

// Mock pdf-provider to avoid importing server/index.ts via circular deps
jest.mock('../../server/pdf-provider', () => ({
  createPDFProvider: () => ({ /* noop provider for tests */ }),
}));

// Mock server/index log to avoid executing the real server bootstrap
jest.mock('../../server/index', () => ({
  log: jest.fn(),
}));

import { registerRoutes } from '../../server/routes';

describe('CV endpoint', () => {
  let app: express.Express;
  let server: http.Server;

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: '5mb' }));
    server = http.createServer(app);
    // Ensure getChromiumPath uses a value so route doesn't reject due to missing Chromium in CI
    process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/chrome';
    await registerRoutes(server, app);
  });

  test('escapes user-provided HTML in CV fields before rendering', async () => {
    const payload = {
      fullName: '<script>evil()</script>',
      email: 'attacker@example.com',
      summary: 'Experienced dev <img src=x onerror=alert(1)>',
      experience: [
        { jobTitle: 'Engineer<script>', company: 'Acme & Co', startDate: '2020', endDate: '2022', description: '<b>Did stuff</b>' }
      ],
      education: [],
      skills: ['Node.js', '<img src=x onerror=bad()>'],
      language: 'en'
    };

    const res = await request(app).post('/api/cv/generate').send(payload).timeout({ deadline: 10000 });
    expect(res.status).toBeLessThan(500);
    // The captured HTML sent to puppeteer should contain escaped entities
    expect(captured.html).toBeDefined();
    expect(captured.html).not.toContain('<script>');
    // he encodes < as numeric entity (e.g. &#x3C;)
    expect(captured.html).toContain('&#x3C;script&#x3E;');
    expect(captured.html).toContain('&#x3C;img');
  });
});
