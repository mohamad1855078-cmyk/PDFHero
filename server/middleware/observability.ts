import { type Request, type Response, type NextFunction } from "express";

function shortId() {
  return Math.random().toString(36).substring(2, 9);
}

export interface ObservabilityRequest extends Request {
  requestId?: string;
}

export function observabilityMiddleware(req: ObservabilityRequest, res: Response, next: NextFunction) {
  const id = `req_${shortId()}`;
  req.requestId = id;
  const start = Date.now();

  let capturedJsonResponse: unknown | undefined = undefined;
  const originalJson = res.json;
  // capture res.json body
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.json = function (body: any, ...args: any[]) {
    capturedJsonResponse = body;
    // @ts-ignore - preserve original behavior
    return originalJson.apply(res, [body, ...args]);
  } as typeof res.json;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      const line = {
        time: new Date().toISOString(),
        id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: duration,
        response: capturedJsonResponse,
      };
      // structured log
      // keep it simple and print JSON so external log aggregators can parse it
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(line));
    }
  });

  next();
}

export function logStructured(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  const out = {
    time: new Date().toISOString(),
    level,
    message,
    meta: meta || undefined,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out));
}

export function initSentryHook() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  // keep Sentry optional to avoid adding a heavy dependency here
  // consumers can implement Sentry init in this function if they add @sentry/node
  // eslint-disable-next-line no-console
  console.log(`Sentry DSN provided; initialize Sentry in initSentryHook()`);
}

export default observabilityMiddleware;
