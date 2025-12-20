import { RequestHandler } from 'express';

// Simple in-memory rate limiter per key (IP or API key). Not distributed.
type Key = string;
const stores = new Map<Key, { count: number; resetAt: number }>();

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '') || 60_000;
const MAX = parseInt(process.env.RATE_LIMIT_MAX || '') || 100;

function keyFor(req: any): string {
  // Prefer API key header if provided, else use IP
  return (req.headers['x-api-key'] as string) || req.ip || 'anon';
}

export const rateLimit: RequestHandler = (req, res, next) => {
  const k = keyFor(req);
  const now = Date.now();
  const entry = stores.get(k);
  if (!entry || now > entry.resetAt) {
    stores.set(k, { count: 1, resetAt: now + WINDOW_MS });
    res.setHeader('X-RateLimit-Limit', String(MAX));
    res.setHeader('X-RateLimit-Remaining', String(MAX - 1));
    return next();
  }
  entry.count += 1;
  const remaining = Math.max(0, MAX - entry.count);
  res.setHeader('X-RateLimit-Limit', String(MAX));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  if (entry.count > MAX) {
    res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Too many requests' });
  }
  return next();
};

export default rateLimit;
