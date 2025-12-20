import { Router } from 'express';

export default function createHealthRouter(params: { provider?: string }) {
  const router = Router();
  const provider = params?.provider || process.env.PDF_PROVIDER || 'mock';

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', provider });
  });

  return router;
}
