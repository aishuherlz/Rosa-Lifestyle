import Stripe from "stripe";

// ─── Stripe credentials ────────────────────────────────────────────────────
//
// We support both:
//   1. A direct STRIPE_SECRET_KEY env var — works in any environment
//      (Replit dev, Railway, Fly, Render, bare metal, anywhere).
//   2. The Replit Connectors API as a convenience for Replit users who set
//      up Stripe via the Integrations tab. Production/Railway deployments
//      should always set STRIPE_SECRET_KEY directly.
//
// Removed the `stripe-replit-sync` package because it's Replit-only and was
// breaking outside Replit. Webhook handling is now done with the standard
// Stripe SDK (see webhookHandlers.ts).
// ───────────────────────────────────────────────────────────────────────────

type StripeCreds = { secretKey: string; webhookSecret?: string };

async function fetchReplitConnectorCreds(): Promise<StripeCreds | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!hostname || !xReplitToken) return null;

  try {
    const resp = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
      {
        headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const settings = data.items?.[0]?.settings;
    if (!settings?.secret_key) return null;
    return { secretKey: settings.secret_key, webhookSecret: settings.webhook_secret };
  } catch {
    return null;
  }
}

async function getStripeCredentials(): Promise<StripeCreds> {
  // Direct env var wins — production should always use this path.
  const directKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (directKey) {
    return { secretKey: directKey, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET };
  }
  // Fallback to Replit Connectors for Replit-hosted dev convenience.
  const replitCreds = await fetchReplitConnectorCreds();
  if (replitCreds) return replitCreds;

  throw new Error(
    "Stripe is not configured. Set STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET) environment variables.",
  );
}

// Cache the client per-process. Stripe's SDK is thread-safe and pools HTTP keep-alive.
let cached: Stripe | null = null;

export async function getUncachableStripeClient(): Promise<Stripe> {
  if (cached) return cached;
  const { secretKey } = await getStripeCredentials();
  cached = new Stripe(secretKey);
  return cached;
}

export async function getStripeWebhookSecret(): Promise<string> {
  const { webhookSecret } = await getStripeCredentials();
  if (!webhookSecret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set. Required to verify Stripe webhook signatures.",
    );
  }
  return webhookSecret;
}
