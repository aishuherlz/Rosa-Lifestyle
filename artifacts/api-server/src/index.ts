// Bump libuv's thread pool BEFORE anything else loads — gives DB / file I/O 4× more parallel
// capacity, so the event loop never starves during traffic spikes.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "16";
// Allow plenty of listeners on long-lived emitters under high concurrency.
process.setMaxListeners(50);

import app from "./app";
import { logger } from "./lib/logger";
import { logOpenAIConfig } from "./lib/openai-client";
import { db, conversations } from "@workspace/db";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";

// Boot diagnostics — surface config problems immediately in Railway/Replit logs.
logOpenAIConfig();
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

// Stripe is optional. The server MUST start even if Stripe is missing,
// misconfigured, under review, or its DB schema can't be created.
// Every call below is wrapped so one failure can never crash boot.
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("Stripe init skipped: DATABASE_URL not set.");
    return;
  }

  // Short-circuit BEFORE touching the DB if there's no Stripe key at all.
  // This avoids the "relation stripe.accounts does not exist" path entirely
  // when Stripe is not connected yet.
  const hasReplitConnector = !!process.env.REPLIT_CONNECTORS_HOSTNAME &&
    (!!process.env.REPL_IDENTITY || !!process.env.WEB_REPL_RENEWAL);
  const hasDirectKey = !!process.env.STRIPE_SECRET_KEY?.trim();
  if (!hasReplitConnector && !hasDirectKey) {
    logger.warn("Stripe init skipped: no STRIPE_SECRET_KEY and no Replit Stripe connector. Payments disabled until configured.");
    return;
  }

  // 1. Stripe schema migrations — safe-wrapped.
  try {
    logger.info("Initializing Stripe schema...");
    await runMigrations({ databaseUrl, schema: "stripe" });
    logger.info("Stripe schema ready");
  } catch (error: any) {
    logger.warn({ err: error?.message }, "Stripe schema migration failed — payments disabled until resolved.");
    return; // No point continuing if the schema isn't there.
  }

  // 2. Stripe client + webhook — safe-wrapped.
  let stripeSync: Awaited<ReturnType<typeof getStripeSync>> | null = null;
  try {
    stripeSync = await getStripeSync();
  } catch (error: any) {
    logger.warn({ err: error?.message }, "Stripe client init failed — payments disabled.");
    return;
  }

  try {
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim()
      || process.env.RAILWAY_PUBLIC_DOMAIN?.trim()
      || process.env.PUBLIC_DOMAIN?.trim();
    if (!domain) {
      logger.warn("Stripe webhook skipped: no public domain env var (REPLIT_DOMAINS / RAILWAY_PUBLIC_DOMAIN / PUBLIC_DOMAIN).");
    } else {
      await stripeSync.findOrCreateManagedWebhook(`https://${domain}/api/stripe/webhook`);
      logger.info("Stripe webhook configured");
    }
  } catch (error: any) {
    logger.warn({ err: error?.message }, "Stripe webhook registration failed — webhook may need manual setup.");
  }

  // 3. Background backfill — already fire-and-forget, but harden the .catch.
  try {
    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe data synced"))
      .catch((err: any) => logger.warn({ err: err?.message }, "Stripe backfill failed (non-fatal)"));
  } catch (error: any) {
    logger.warn({ err: error?.message }, "Stripe backfill could not be started (non-fatal)");
  }
}

// Fire-and-forget: do NOT block server startup on Stripe under any circumstance.
// Even if the entire initStripe() function somehow threw synchronously, this
// .catch guarantees we still start the HTTP listener below.
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
