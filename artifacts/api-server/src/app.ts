import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { WebhookHandlers } from "./webhookHandlers";
import { logger } from "./lib/logger";

const app: Express = express();

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

app.use(pinoHttp({
  logger,
  serializers: {
    req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
    res(res) { return { statusCode: res.statusCode }; },
  },
}));
// Security headers — protects against XSS, clickjacking, MIME sniffing
app.use(helmet({
  contentSecurityPolicy: false,         // SPA needs flexible CSP — Replit proxy handles edge
  crossOriginEmbedderPolicy: false,     // we embed via Replit iframe
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
// Gzip — drastically reduces bandwidth and TTFB at scale
app.use(compression());
app.use(cors());
// Global rate limit — 300 requests/min/IP. Prevents abuse without bothering normal users.
app.use("/api", rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests — please slow down 🌹" },
}));
// Stricter limiter for auth endpoints
app.use("/api/auth", rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Too many code requests — wait a minute, sister 💗" },
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

export default app;
