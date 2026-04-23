import Stripe from 'stripe';

// Replit Stripe integration — connection:conn_stripe_01KPVZ7M4Q2165VVCDF6ME4PZC
async function getCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    // Fall back to env vars if not running in Replit connector context
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
    if (secretKey) return { secretKey, publishableKey };
    throw new Error('Stripe not available: set STRIPE_SECRET_KEY or connect via Integrations tab');
  }

  const connectorName = 'stripe';
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', connectorName);
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'X-Replit-Token': xReplitToken,
    },
  });

  const data = await response.json();
  const settings = data.items?.[0]?.settings;

  if (!settings?.secret) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
    if (secretKey) return { secretKey, publishableKey };
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }

  return {
    publishableKey: settings.publishable || '',
    secretKey: settings.secret,
  };
}

// WARNING: Never cache this client — always call fresh.
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, { apiVersion: '2025-08-27.basil' as any });
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

// StripeSync singleton
let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const { secretKey } = await getCredentials();
    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
