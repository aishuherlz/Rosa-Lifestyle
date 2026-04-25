// Bump libuv's thread pool BEFORE anything else loads — gives DB / file I/O 4× more parallel
// capacity, so the event loop never starves during traffic spikes.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "16";
// Allow plenty of listeners on long-lived emitters under high concurrency.
process.setMaxListeners(50);

import app from "./app";
import { logger } from "./lib/logger";
import { logChatProviderConfig } from "./lib/chat-client";
import { db, conversations } from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient";

// Boot diagnostics — surface config problems immediately in Railway/Replit logs.
logChatProviderConfig();
if (!process.env.DATABASE_URL?.trim()) {
  logger.error("DATABASE_URL is MISSING — chatbot, rose wall, circles will all 500.");
} else {
  logger.info("DATABASE_URL loaded");
  // Verify the conversations table is reachable. If not, the user almost
  // certainly forgot to run `pnpm db:push` against the production database.
  db.select().from(conversations).limit(1)
    .then(() => logger.info("conversations table OK"))
    .catch((err: any) => logger.error(
      { err: err?.message },
      "conversations table NOT reachable — run `pnpm db:push` against your production DATABASE_URL."
    ));
}

// Keep the server alive even if a single request handler throws / a promise rejects.
// Without these, one bad request can take the whole site down for everyone.
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception (process kept alive)");
});
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection (process kept alive)");
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Stripe is optional. The server MUST start even if Stripe is missing or
// misconfigured. We just verify connectivity so a missing/typo'd key shows up
// in the boot logs instead of failing silently on the first checkout.
//
// Webhooks are no longer auto-registered. Configure them manually in the
// Stripe dashboard pointing at https://<your-domain>/api/stripe/webhook and
// set STRIPE_WEBHOOK_SECRET in env.
async function initStripe() {
  const hasReplitConnector =
    !!process.env.REPLIT_CONNECTORS_HOSTNAME &&
    (!!process.env.REPL_IDENTITY || !!process.env.WEB_REPL_RENEWAL);
  const hasDirectKey = !!process.env.STRIPE_SECRET_KEY?.trim();
  if (!hasReplitConnector && !hasDirectKey) {
    logger.warn(
      "Stripe init skipped: no STRIPE_SECRET_KEY env var. Payments disabled until configured.",
    );
    return;
  }
  try {
    const stripe = await getUncachableStripeClient();
    // Cheapest read-only call to confirm the key works.
    await stripe.products.list({ limit: 1 });
    logger.info("Stripe client OK");
    if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
      logger.warn(
        "STRIPE_WEBHOOK_SECRET not set — webhooks will fail signature verification. Set it once you've created the webhook in the Stripe dashboard.",
      );
    }
  } catch (error: any) {
    logger.warn({ err: error?.message }, "Stripe init failed — payments disabled until resolved.");
  }
}

initStripe().catch((err: any) =>
  logger.warn({ err: err?.message }, "Stripe init crashed (non-fatal, server continues)")
);

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});

// Tune for higher concurrency: keep sockets alive longer, allow slower clients,
// and don't drop long-lived SSE chat streams prematurely.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;
server.requestTimeout = 0; // SSE chat needs unlimited

// Graceful shutdown so in-flight requests finish cleanly.
function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down gracefully");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
