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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
