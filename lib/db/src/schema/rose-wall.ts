import { pgTable, serial, text, timestamp, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

// A single post on the Rose Wall.
//
// `authorEmail` is always set (every post is tied to a real signed-in user
// for accountability/abuse handling), but if `isAnonymous` is true the
// frontend will NEVER show the email or name — only "Anonymous Rose".
//
// `displayName` is a snapshot of the user's display name at post time so
// renaming the account later doesn't rewrite history. Ignored when
// `isAnonymous` is true.
//
// `status` controls visibility:
//   "live"    — passed moderation, shown in feed
//   "blocked" — failed moderation, hidden from feed (kept for audit)
//   "deleted" — user-deleted, hidden from feed (kept briefly for audit)
//
// `moderationReason` is the short label from the AI verdict when blocked.
export const roseWallPosts = pgTable("rose_wall_posts", {
  id: serial("id").primaryKey(),
  authorEmail: text("author_email").notNull(),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  displayName: text("display_name").notNull(),
  text: text("text").notNull(),
  mood: text("mood"),
  status: text("status").notNull().default("live"),
  moderationReason: text("moderation_reason"),
  roseCount: integer("rose_count").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  feedIdx: index("rose_wall_posts_feed_idx").on(t.status, t.createdAt),
  authorIdx: index("rose_wall_posts_author_idx").on(t.authorEmail),
}));

// One row per rose (like) — uniqueness on (post, user) gives us toggle semantics
// without race conditions.
export const roseWallRoses = pgTable("rose_wall_roses", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userEmail: text("user_email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniqUserPost: uniqueIndex("rose_wall_roses_user_post_uniq").on(t.postId, t.userEmail),
}));

// Comments on posts. Same anonymity + status semantics as posts.
export const roseWallComments = pgTable("rose_wall_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  authorEmail: text("author_email").notNull(),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  displayName: text("display_name").notNull(),
  text: text("text").notNull(),
  status: text("status").notNull().default("live"),
  moderationReason: text("moderation_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  postIdx: index("rose_wall_comments_post_idx").on(t.postId, t.status, t.createdAt),
}));

// Reports go into a queue for human review later. We do NOT auto-hide on report
// because that's a trivial griefing vector — only the AI moderator hides things.
//
// `targetType` is "post" or "comment", `targetId` is the row id of that thing.
// `status` is "pending" | "reviewed" | "dismissed".
export const roseWallReports = pgTable("rose_wall_reports", {
  id: serial("id").primaryKey(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  reporterEmail: text("reporter_email").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  queueIdx: index("rose_wall_reports_queue_idx").on(t.status, t.createdAt),
  // Don't let a single user spam-report the same target.
  uniqReporter: uniqueIndex("rose_wall_reports_reporter_target_uniq")
    .on(t.targetType, t.targetId, t.reporterEmail),
}));
