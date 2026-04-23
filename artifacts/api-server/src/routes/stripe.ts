import { Router } from 'express';
import { db } from '@workspace/db';
import { rosaUsers } from '@workspace/db';
import { eq, sql } from 'drizzle-orm';
import { getUncachableStripeClient } from '../stripeClient';
import { logger } from '../lib/logger';
import { verifyEmailToken } from './auth';

const router = Router();

function bearer(req: any): string | null {
  const h = req.headers["authorization"];
  if (typeof h === "string" && h.startsWith("Bearer ")) return h.slice(7).trim();
  return null;
}
// Server-side allowlist — only these prices are valid. Prevents price tampering.
function allowedPriceFor(planType: string | undefined): string | null {
  if (planType === 'monthly') return process.env.STRIPE_MONTHLY_PRICE_ID || null;
  if (planType === 'yearly')  return process.env.STRIPE_YEARLY_PRICE_ID  || null;
  return null;
}

// Create or get Stripe customer + checkout session
router.post('/stripe/checkout', async (req: any, res) => {
  try {
    // AUTHN: must have completed email verification
    const verifiedEmail = verifyEmailToken(String(bearer(req) || (req.body && req.body.token) || ''));
    if (!verifiedEmail) return res.status(401).json({ error: 'Verified email token required. Sign in first.' });

    const { name, planType } = req.body;
    const emailOrPhone = verifiedEmail; // ALWAYS use the verified identity, never trust client-supplied
    const priceId = allowedPriceFor(planType);
    if (!priceId) return res.status(400).json({ error: "planType must be 'monthly' or 'yearly'" });

    const stripe = await getUncachableStripeClient();

    let [user] = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, emailOrPhone));

    if (!user) {
      const customer = await stripe.customers.create({ email: emailOrPhone, name });
      const totalUsers = await db.execute(sql`SELECT COUNT(*) FROM rosa_users`);
      const count = Number((totalUsers.rows[0] as any).count);

      let trialMonths = 3;
      let isFoundingMember = false;
      let foundingMemberType = null;
      if (count < 100) { trialMonths = 6; isFoundingMember = true; foundingMemberType = "first_100"; }
      else if (count < 500) { trialMonths = 3; isFoundingMember = true; foundingMemberType = "first_500"; }

      const trialEndsAt = new Date();
      trialEndsAt.setMonth(trialEndsAt.getMonth() + trialMonths);

      const [created] = await db.insert(rosaUsers).values({
        emailOrPhone,
        name: name || emailOrPhone,
        stripeCustomerId: customer.id,
        isFoundingMember,
        foundingMemberType,
        trialEndsAt,
        subscriptionStatus: 'trial',
      }).returning();
      user = created;
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: emailOrPhone, name: user.name });
      await db.update(rosaUsers).set({ stripeCustomerId: customer.id }).where(eq(rosaUsers.id, user.id));
      customerId = customer.id;
    }

    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/subscription?checkout=cancel`,
      metadata: { userId: user.id.toString(), planType: planType || 'monthly' },
    });

    res.json({ url: session.url, userId: user.id, isFoundingMember: user.isFoundingMember, foundingMemberType: user.foundingMemberType });
  } catch (err: any) {
    logger.error({ err }, 'Stripe checkout error');
    res.status(500).json({ error: err.message });
  }
});

// Customer portal — AUTHENTICATED, identity from verified token
router.post('/stripe/portal', async (req: any, res) => {
  try {
    const verifiedEmail = verifyEmailToken(String(bearer(req) || (req.body && req.body.token) || ''));
    if (!verifiedEmail) return res.status(401).json({ error: 'Verified email token required.' });
    const [user] = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, verifiedEmail));
    if (!user?.stripeCustomerId) return res.status(404).json({ error: 'No billing account found' });

    const stripe = await getUncachableStripeClient();
    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/subscription`,
    });
    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get user subscription status — AUTHENTICATED, identity from verified token
// (Removed the IDOR-prone path-param variant.)
router.get('/stripe/status', async (req: any, res) => {
  try {
    const verifiedEmail = verifyEmailToken(String(bearer(req) || ''));
    if (!verifiedEmail) return res.status(401).json({ error: 'Verified email token required.' });
    const [user] = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, verifiedEmail));
    if (!user) return res.json({ status: 'trial', isFoundingMember: false });

    const now = new Date();
    let status = user.subscriptionStatus || 'trial';
    if (status === 'trial' && user.trialEndsAt && now > user.trialEndsAt) status = 'expired';

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

// Get Stripe price IDs from env
router.get('/stripe/prices', async (_req, res) => {
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
        monthly: monthly ? { id: monthly.id, amount: monthly.unit_amount, currency: monthly.currency } : { id: monthlyPriceId, amount: 500, currency: 'cad' },
        yearly: yearly ? { id: yearly.id, amount: yearly.unit_amount, currency: yearly.currency } : { id: yearlyPriceId, amount: 5000, currency: 'cad' },
      });
    }

    res.json({
      monthly: { id: monthlyPriceId || 'price_monthly', amount: 500, currency: 'cad' },
      yearly: { id: yearlyPriceId || 'price_yearly', amount: 5000, currency: 'cad' },
    });
  } catch (err: any) {
    res.json({
      monthly: { id: process.env.STRIPE_MONTHLY_PRICE_ID || 'price_monthly', amount: 500, currency: 'cad' },
      yearly: { id: process.env.STRIPE_YEARLY_PRICE_ID || 'price_yearly', amount: 5000, currency: 'cad' },
    });
  }
});

export default router;
