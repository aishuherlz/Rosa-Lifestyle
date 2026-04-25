import { Router } from "express";
import { db } from "@workspace/db";
import { rosaUsers } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { requireSession } from "./auth";

const router = Router();

// ─── Helpers ───────────────────────────────────────────────────────────────

// Resolve (or lazily create) a Stripe customer for a signed-in ROSA user.
// Resolution order, in priority:
//   1. user.stripeCustomerId on the rosa_users row, retrieved + verified.
//   2. Stripe customer search by email (catches customers created out-of-band
//      or via an earlier signup before stripeCustomerId was stored).
//   3. Create a new Stripe customer with the user's real email + name.
// In every case we end up writing the resolved id back to rosa_users so the
// next request can take the fast path.
async function resolveStripeCustomerId(
  user: typeof rosaUsers.$inferSelect,
): Promise<string> {
  const stripe = await getUncachableStripeClient();
  const email = user.emailOrPhone;

  // 1. Already linked — verify the customer still exists in Stripe.
  if (user.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(user.stripeCustomerId);
      if (existing && !(existing as any).deleted) {
        // Keep email/name in sync so Stripe shows the user's real address.
        if ((existing as any).email !== email || (existing as any).name !== user.name) {
          await stripe.customers.update(user.stripeCustomerId, { email, name: user.name });
        }
        return user.stripeCustomerId;
      }
    } catch (err: any) {
      // If retrieve 404s the stored id is stale — fall through to recreate.
      logger.warn(
        { err: err?.message, customerId: user.stripeCustomerId },
        "Stored Stripe customer id no longer valid — re-resolving",
      );
    }
  }

  // 2. Existing customer with same email (search prevents duplicates).
  let resolvedId: string | null = null;
  try {
    const list = await stripe.customers.list({ email, limit: 1 });
    if (list.data[0] && !list.data[0].deleted) resolvedId = list.data[0].id;
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Stripe customers.list lookup failed");
  }

  // 3. Brand new customer.
  if (!resolvedId) {
    const created = await stripe.customers.create({
      email,
      name: user.name,
      metadata: { rosa_user_id: user.id.toString() },
    });
    resolvedId = created.id;
  }

  await db
    .update(rosaUsers)
    .set({ stripeCustomerId: resolvedId, updatedAt: new Date() })
    .where(eq(rosaUsers.id, user.id));

  return resolvedId;
}

// Pick the first available public domain for redirect URLs. Order matches the
// production hosting we actually use.
function publicBaseUrl(): string {
  const domain =
    process.env.PUBLIC_DOMAIN?.trim() ||
    process.env.RAILWAY_PUBLIC_DOMAIN?.trim() ||
    process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (!domain) return "http://localhost:3000";
  return domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain}`;
}

// ─── Routes ────────────────────────────────────────────────────────────────

// Create a checkout session for the signed-in user. Email is taken from the
// session token, NEVER from the request body, so a "guest" can't impersonate
// or end up tagged as guest@rosa.app inside Stripe.
router.post("/stripe/checkout", requireSession, async (req: any, res) => {
  try {
    const email: string = req.session.email;
    const { priceId, planType, gardenRoses, promoCode } = req.body || {};
    if (!priceId) return res.status(400).json({ error: "priceId is required" });

    // Look up the user. They should exist because requireSession passed, but
    // be defensive in case the row was just created by another flow.
    let [user] = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, email));
    if (!user) {
      const totalUsers = await db.execute(sql`SELECT COUNT(*) FROM rosa_users`);
      const count = Number((totalUsers.rows[0] as any).count);
      let trialMonths = 3;
      let isFoundingMember = false;
      let foundingMemberType: string | null = null;
      if (count < 100) {
        trialMonths = 6;
        isFoundingMember = true;
        foundingMemberType = "first_100";
      } else if (count < 500) {
        trialMonths = 3;
        isFoundingMember = true;
        foundingMemberType = "first_500";
      }
      const trialEndsAt = new Date();
      trialEndsAt.setMonth(trialEndsAt.getMonth() + trialMonths);

      const [created] = await db
        .insert(rosaUsers)
        .values({
          emailOrPhone: email,
          name: email.split("@")[0],
          isFoundingMember,
          foundingMemberType,
          trialEndsAt,
          subscriptionStatus: "trial",
        })
        .returning();
      user = created;
    }

    const customerId = await resolveStripeCustomerId(user);
    const stripe = await getUncachableStripeClient();

    const baseUrl = publicBaseUrl();
    const sessionParams: any = {
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/subscription?checkout=cancel`,
      metadata: {
        userId: user.id.toString(),
        userEmail: email,
        planType: planType || "monthly",
      },
      subscription_data: {
        metadata: { userId: user.id.toString(), userEmail: email },
      },
      allow_promotion_codes: true,
    };

    // Founders Garden 50% off — auto-applied for users with 175+ roses, or via GARDEN175.
    const earnedDiscount =
      (typeof gardenRoses === "number" && gardenRoses >= 175) || promoCode === "GARDEN175";
    if (earnedDiscount) {
      try {
        const promos = await stripe.promotionCodes.list({ code: "GARDEN175", active: true, limit: 1 });
        if (promos.data[0]) {
          sessionParams.discounts = [{ promotion_code: promos.data[0].id }];
          delete sessionParams.allow_promotion_codes;
        }
      } catch (e) {
        logger.warn({ e }, "GARDEN175 promo lookup failed");
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({
      url: session.url,
      userId: user.id,
      isFoundingMember: user.isFoundingMember,
      foundingMemberType: user.foundingMemberType,
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, "Stripe checkout error");
    res.status(500).json({ error: err.message || "Checkout could not be started" });
  }
});

// Customer portal for the signed-in user.
router.post("/stripe/portal", requireSession, async (req: any, res) => {
  try {
    const email: string = req.session.email;
    const [user] = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, email));
    if (!user) return res.status(404).json({ error: "Account not found" });

    // If the user has never checked out we can still spin up a customer so
    // they can manage payment methods / view billing history later.
    const customerId = await resolveStripeCustomerId(user);

    const stripe = await getUncachableStripeClient();
    const baseUrl = publicBaseUrl();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/subscription`,
    });
    res.json({ url: session.url });
  } catch (err: any) {
    logger.error({ err: err?.message }, "Stripe portal error");
    res.status(500).json({ error: err.message || "Billing portal unavailable" });
  }
});

// Subscription status for the signed-in user.
router.get("/stripe/status", requireSession, async (req: any, res) => {
  try {
    const email: string = req.session.email;
    const [user] = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, email));
    if (!user) return res.json({ status: "trial", isFoundingMember: false });

    const now = new Date();
    let status = user.subscriptionStatus || "trial";
    if (status === "trial" && user.trialEndsAt && now > user.trialEndsAt) status = "expired";

    res.json({
      status,
      isFoundingMember: user.isFoundingMember,
      foundingMemberType: user.foundingMemberType,
      isLifetimeFree: user.isLifetimeFree,
      trialEndsAt: user.trialEndsAt,
      signupNumber: user.signupNumber,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Backward-compatible status by emailOrPhone — auth required, and the URL
// param MUST match the signed-in user's email. Without this check anyone could
// look up another user's subscription, founding-member, and lifetime status.
router.get("/stripe/status/:emailOrPhone", requireSession, async (req: any, res) => {
  try {
    const me: string = req.session.email;
    const target = String(req.params.emailOrPhone || "").trim().toLowerCase();
    if (target !== me) return res.status(403).json({ error: "Forbidden" });

    const [user] = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, target));
    if (!user) return res.json({ status: "trial", isFoundingMember: false });

    const now = new Date();
    let status = user.subscriptionStatus || "trial";
    if (status === "trial" && user.trialEndsAt && now > user.trialEndsAt) status = "expired";

    res.json({
      status,
      isFoundingMember: user.isFoundingMember,
      foundingMemberType: user.foundingMemberType,
      isLifetimeFree: user.isLifetimeFree,
      trialEndsAt: user.trialEndsAt,
      signupNumber: user.signupNumber,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Public price lookup — no auth needed (the price IDs are not secret).
router.get("/stripe/prices", async (_req, res) => {
  try {
    const stripe = await getUncachableStripeClient();
    const monthlyPriceId = process.env.STRIPE_MONTHLY_PRICE_ID;
    const yearlyPriceId = process.env.STRIPE_YEARLY_PRICE_ID;

    if (monthlyPriceId && yearlyPriceId) {
      const [monthly, yearly] = await Promise.all([
        stripe.prices.retrieve(monthlyPriceId).catch(() => null),
        stripe.prices.retrieve(yearlyPriceId).catch(() => null),
      ]);
      return res.json({
        monthly: monthly
          ? { id: monthly.id, amount: monthly.unit_amount, currency: monthly.currency }
          : { id: monthlyPriceId, amount: 500, currency: "cad" },
        yearly: yearly
          ? { id: yearly.id, amount: yearly.unit_amount, currency: yearly.currency }
          : { id: yearlyPriceId, amount: 5000, currency: "cad" },
      });
    }

    res.json({
      monthly: { id: monthlyPriceId || "price_monthly", amount: 500, currency: "cad" },
      yearly: { id: yearlyPriceId || "price_yearly", amount: 5000, currency: "cad" },
    });
  } catch (err: any) {
    res.json({
      monthly: {
        id: process.env.STRIPE_MONTHLY_PRICE_ID || "price_monthly",
        amount: 500,
        currency: "cad",
      },
      yearly: {
        id: process.env.STRIPE_YEARLY_PRICE_ID || "price_yearly",
        amount: 5000,
        currency: "cad",
      },
    });
  }
});

export default router;
