import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const friendRequests = pgTable("friend_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromEmail: text("from_email").notNull(),
  toEmail: text("to_email").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const friendships = pgTable("friendships", {
  id: uuid("id").defaultRandom().primaryKey(),
  userEmail: text("user_email").notNull(),
  friendEmail: text("friend_email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const blockedUsers = pgTable("blocked_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  blockerEmail: text("blocker_email").notNull(),
  blockedEmail: text("blocked_email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
