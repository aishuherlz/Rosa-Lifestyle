import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, rosaUsers } from "@workspace/db";
import { getStripeWebhookSecret, getUncachableStripeClient } from "./stripeClient";
import { logger } from "./lib/logger";

// ─── Manual Stripe webhook handling (no stripe-replit-sync dependency) ──────
//
// We only persist the bits we actually need on rosa_users:
//   - stripeCustomerId        (set on signup / first checkout)
//   - stripeSubscriptionId    (linked once a subscription is created)
//   - subscriptionStatus      (trial | active | past_due | canceled | expired)
//   - trialEndsAt             (when the Stripe trial ends, if any)
//
// Anything else (invoices, payment methods) lives in Stripe — that's the
// source of truth and our app reads it on demand via the Stripe API or the
// Customer Portal.
// ───────────────────────────────────────────────────────────────────────────

function mapStripeStatusToOurs(s: Stripe.Subscription.Status | undefined | null): string {
  switch (s) {
    case "trialing":
      return "trial";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "unpaid":
      return "canceled";
    case "incomplete":
      return "incomplete";
    case "paused":
      return "paused";
    default:
      return "trial";
  }
}

async function findUserByCustomerId(customerId: string) {
  const [user] = await db
    .select()
    .from(rosaUsers)
    .where(eq(rosaUsers.stripeCustomerId, customerId))
    .limit(1);
  return user || null;
}

async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(rosaUsers)
    .where(eq(rosaUsers.emailOrPhone, email.trim().toLowerCase()))
    .limit(1);
  return user || null;
}

async function applySubscription(sub: Stripe.Subscription, customerEmail: string | null) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  // We stamp these on subscription_data.metadata in routes/stripe.ts so we can
  // recover the user even if the customer linkage drifts (rare but real).
  const metaEmail = (sub.metadata as Record<string, string | undefined>)?.userEmail || null;
  const metaUserIdRaw = (sub.metadata as Record<string, string | undefined>)?.userId || null;
  const metaUserId = metaUserIdRaw ? Number(metaUserIdRaw) : null;

  // Locate the user. Prefer (1) the linked customer id, (2) subscription
  // metadata id/email we stamped at checkout, (3) the customer's email if
  // Stripe gave it to us, (4) nothing — log and skip.
  let user = await findUserByCustomerId(customerId);
  if (!user && metaUserId && Number.isFinite(metaUserId)) {
    const [byId] = await db.select().from(rosaUsers).where(eq(rosaUsers.id, metaUserId)).limit(1);
    user = byId || null;
  }
  if (!user && metaEmail) user = await findUserByEmail(metaEmail);
  if (!user && customerEmail) user = await findUserByEmail(customerEmail);
  if (!user) {
    logger.warn(
      { customerId, customerEmail, metaEmail, metaUserId },
      "Stripe webhook: subscription event for unknown user — skipping",
    );
    return;
  }

  const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;

  await db
    .update(rosaUsers)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      subscriptionStatus: mapStripeStatusToOurs(sub.status),
      ...(trialEndsAt ? { trialEndsAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(rosaUsers.id, user.id));

  logger.info(
    { userId: user.id, subStatus: sub.status, mappedStatus: mapStripeStatusToOurs(sub.status) },
    "Stripe webhook: user subscription updated",
  );
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const stripe = await getUncachableStripeClient();
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const customerEmail = session.customer_details?.email || session.customer_email || null;

  if (!subscriptionId || !customerId) {
    logger.info({ sessionId: session.id }, "Stripe webhook: checkout completed without subscription — ignoring");
    return;
  }

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  await applySubscription(sub, customerEmail);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user = await findUserByCustomerId(customerId);
  if (!user) {
    logger.warn({ customerId }, "Stripe webhook: subscription deleted for unknown user");
    return;
  }
  await db
    .update(rosaUsers)
    .set({
      subscriptionStatus: "canceled",
      stripeSubscriptionId: null,
      updatedAt: new Date(),
    })
    .where(eq(rosaUsers.id, user.id));
  logger.info({ userId: user.id }, "Stripe webhook: user subscription canceled");
}

async function handleCustomerDeleted(customer: Stripe.Customer) {
  const user = await findUserByCustomerId(customer.id);
  if (!user) return;
  await db
    .update(rosaUsers)
    .set({ stripeCustomerId: null, stripeSubscriptionId: null, subscriptionStatus: "canceled", updatedAt: new Date() })
    .where(eq(rosaUsers.id, user.id));
}

// Tagged error classes so the Express route can decide between 400 (signature
// failed — Stripe must NOT retry) and 500 (downstream failure — Stripe MUST
// retry with backoff). Stripe treats any 4xx as terminal for many event types,
// so getting this distinction right is what saves us from silently dropped
// subscription updates during a transient DB blip.
export class StripeWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeWebhookSignatureError";
  }
}
export class StripeWebhookProcessingError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "StripeWebhookProcessingError";
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new StripeWebhookProcessingError(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
          "Ensure webhook route is registered BEFORE app.use(express.json()).",
      );
    }

    const stripe = await getUncachableStripeClient();
    const webhookSecret = await getStripeWebhookSecret();

    // Verify signature — bad sig is a hard 400 (don't let Stripe retry).
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      throw new StripeWebhookSignatureError(err?.message || "Invalid Stripe signature");
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.trial_will_end":
          await applySubscription(event.data.object as Stripe.Subscription, null);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        case "customer.deleted":
          await handleCustomerDeleted(event.data.object as Stripe.Customer);
          break;
        default:
          // Many event types are fine to ignore (invoice.*, payment_intent.*, etc.).
          // We log at debug only to keep prod logs quiet.
          logger.debug({ type: event.type }, "Stripe webhook: ignored event");
      }
    } catch (err: any) {
      // Don't let a downstream DB hiccup turn into a Stripe retry storm — log
      // and rethrow so the outer route returns a 500 and Stripe retries with backoff.
      logger.error({ err: err?.message, eventType: event.type }, "Stripe webhook handler failed");
      throw err;
    }
  }
}
