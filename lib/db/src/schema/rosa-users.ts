import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const rosaUsers = pgTable("rosa_users", {
  id: serial("id").primaryKey(),
  emailOrPhone: text("email_or_phone").notNull().unique(),
  name: text("name").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  signupNumber: serial("signup_number"),
  isFoundingMember: boolean("is_founding_member").default(false),
  foundingMemberType: text("founding_member_type"),
  isLifetimeFree: boolean("is_lifetime_free").default(false),
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionStatus: text("subscription_status").default("trial"),
  partnerInviteCode: text("partner_invite_code"),
  partnerOfUserId: integer("partner_of_user_id"),
  // Bumping this number invalidates every session token issued for this user.
  // Used by "Log out of all devices" so all old tokens fail signature/version check.
  tokenVersion: integer("token_version").notNull().default(1),
  // Marketing email consent: "yes" | "later" | "never".
  // Default "later" so a fresh signup is treated as "ask me again from settings"
  // — this keeps us GDPR/CAN-SPAM friendly (no implicit opt-in).
  marketingOptIn: text("marketing_opt_in").notNull().default("later"),
  // Permanent, single-blind pen name used everywhere the user posts
  // anonymously (Rose Wall today; future communities later). It NEVER changes
  // for a given user, so they can build reputation without exposing identity.
  // Format is one of: "RosePetal_<4 digits>" or "Rose_<Adjective><Flower>".
  // Nullable so the column can be added without a migration step; the auth
  // layer backfills any NULL on next sign-in.
  anonymousName: text("anonymous_name").unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// One row per "trusted device" for a given email. Created on every successful
// verify-code that opted into Remember Me. Used to power the Trusted Devices
// settings panel so users can see and revoke individual sessions.
export const trustedDevices = pgTable("trusted_devices", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  deviceId: text("device_id").notNull().unique(),
  deviceName: text("device_name"),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
  rememberMe: boolean("remember_me").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});
