import { Router } from 'express';
import { db } from '@workspace/db';
import { rosaUsers } from '@workspace/db';
import { eq, sql } from 'drizzle-orm';
import { getUncachableStripeClient } from '../stripeClient';
import { logger } from '../lib/logger';

const router = Router();

// Create or get Stripe customer + checkout session
router.post('/stripe/checkout', async (req: any, res) => {
  try {
    const { emailOrPhone, name, priceId, planType } = req.body;
    if (!emailOrPhone || !priceId) {
      return res.status(400).json({ error: 'emailOrPhone and priceId are required' });
    }

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

// Customer portal
router.post('/stripe/portal', async (req: any, res) => {
  try {
    const { emailOrPhone } = req.body;
    const [user] = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, emailOrPhone));
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

// Get user subscription status
router.get('/stripe/status/:emailOrPhone', async (req, res) => {
  try {
    const [user] = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, req.params.emailOrPhone));
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
