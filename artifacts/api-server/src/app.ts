import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { WebhookHandlers } from "./webhookHandlers";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the Replit proxy so req.ip is the real client IP (needed for rate limiting).
app.set("trust proxy", 1);

// Register Stripe webhook BEFORE other middleware (needs raw Buffer)
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature' });
      return;
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        logger.error('Webhook body is not a Buffer — check middleware order');
        res.status(500).json({ error: 'Webhook processing error' });
        return;
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error({ err: error }, 'Webhook error');
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(pinoHttp({
  logger,
  serializers: {
    req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
    res(res) { return { statusCode: res.statusCode }; },
  },
}));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Health check (cheap, never rate-limited) — useful for uptime probes.
app.get("/api/health", (_req, res) => { res.json({ ok: true, ts: Date.now() }); });

// Lightweight metrics so we can see live load (event loop lag, memory, uptime) without external tools.
let lastTick = Date.now();
let loopLagMs = 0;
setInterval(() => { const now = Date.now(); loopLagMs = Math.max(0, now - lastTick - 1000); lastTick = now; }, 1000).unref();
app.get("/api/metrics", (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    loopLagMs,
    memMB: { rss: Math.round(mem.rss / 1e6), heapUsed: Math.round(mem.heapUsed / 1e6), heapTotal: Math.round(mem.heapTotal / 1e6) },
    threadpoolSize: process.env.UV_THREADPOOL_SIZE,
    nodeVersion: process.version,
  });
});

// Global rate limit: protects every endpoint from a single noisy client overwhelming the box.
// 300 req/min/IP is generous for a real user but caps abusive spikes well under crash territory.
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests — please slow down a moment 🌹" },
});

// Stricter limit on the expensive AI endpoints (each call costs OpenAI tokens & holds an SSE connection).
// 20 req/min/IP is plenty for a real chat session but stops a single user from draining the API quota for everyone.
const aiLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "You're chatting fast! Take a breath and try again in a minute 💗" },
});

app.use("/api/openai", aiLimiter);
app.use("/api/food-vision", aiLimiter);
app.use("/api/outfit-vision", aiLimiter);
app.use("/api", globalLimiter);
app.use("/api", router);

// Catch-all error handler so a thrown route never crashes the process.
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, url: req.url }, "Unhandled route error");
  if (res.headersSent) return;
  res.status(500).json({ ok: false, error: "Something went wrong on our side. Please try again." });
});

export default app;
