// Rose Wall — community feed.
//
// Step 3 of the build plan: replace the JSON-file prototype with a proper
// auth'd, DB-backed, AI-moderated feed. Posts and comments are scanned by
// `moderateText()` BEFORE they go live; failures show the spec block message
// to the user. Likes (one rose per user per post) are toggle-able.
//
// All endpoints require a valid session — anonymity in this product means
// "the public can't see who you are" not "no account is tied to this post".
// Every row carries `authorEmail` for accountability + abuse handling, and
// the frontend is responsible for hiding name/email when `isAnonymous` is set.

import { Router } from "express";
import express from "express";
import { db, rosaUsers, roseWallPosts, roseWallRoses, roseWallComments, roseWallReports } from "@workspace/db";
import { and, desc, eq, sql, inArray, lt } from "drizzle-orm";
import { requireSession } from "./auth";
import { moderateText, BLOCK_MESSAGE } from "../lib/moderation";

const router = Router();
router.use(express.json({ limit: "10kb" }));

const MAX_POST_LEN = 600;
const MAX_COMMENT_LEN = 400;
const RATE_PER_HOUR_POSTS = 5;
const RATE_PER_HOUR_COMMENTS = 30;
const RATE_PER_HOUR_REPORTS = 20;
const ALLOWED_MOODS = ["happy", "loved", "calm", "tired", "sad", "anxious", "angry", "grateful", "hopeful", "proud"];

// Tiny in-process rate limiter (per-process; fine until we shard the API server).
const recentPosts: Map<string, number[]> = new Map();
const recentComments: Map<string, number[]> = new Map();
const recentReports: Map<string, number[]> = new Map();

function rateOk(map: Map<string, number[]>, key: string, perHour: number): boolean {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const arr = (map.get(key) || []).filter((t) => now - t < oneHour);
  if (arr.length >= perHour) {
    map.set(key, arr);
    return false;
  }
  arr.push(now);
  map.set(key, arr);
  return true;
}

async function getDisplayName(email: string): Promise<string> {
  const [u] = await db.select({ name: rosaUsers.name }).from(rosaUsers).where(eq(rosaUsers.emailOrPhone, email)).limit(1);
  return (u?.name || "Rose").trim() || "Rose";
}

// Look up the permanent anonymous pen name for one user. Falls back to the
// generic "Anonymous Rose" label so that legacy rows (or the brief window
// between schema-add and first sign-in) never break the wall UI.
async function getAnonymousName(email: string): Promise<string> {
  const [u] = await db
    .select({ anonymousName: rosaUsers.anonymousName })
    .from(rosaUsers)
    .where(eq(rosaUsers.emailOrPhone, email))
    .limit(1);
  return (u?.anonymousName || "Anonymous Rose").trim() || "Anonymous Rose";
}

// Batch version used by the feed/comment-list endpoints. One round-trip per
// page instead of one per row. Returns a Map keyed by author email so callers
// can look up names while shaping the response.
async function getAnonymousNameMap(emails: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(emails)).filter(Boolean);
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ email: rosaUsers.emailOrPhone, anonymousName: rosaUsers.anonymousName })
    .from(rosaUsers)
    .where(inArray(rosaUsers.emailOrPhone, unique));
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.anonymousName) map.set(r.email, r.anonymousName);
  }
  return map;
}

// Shape sent to the client. When the post is marked anonymous we substitute
// the author's permanent pen name (e.g. "RosePetal_0042" or
// "Rose_GoldenLily") for their real display name. Falls back to the generic
// "Anonymous Rose" label only if the author somehow doesn't have a pen name
// yet — which shouldn't happen post-backfill but keeps the UI safe.
function shapePost(
  p: typeof roseWallPosts.$inferSelect,
  viewerHasRosed: boolean,
  isOwn: boolean,
  anonNameByEmail: Map<string, string>,
) {
  return {
    id: p.id,
    text: p.text,
    mood: p.mood,
    isAnonymous: p.isAnonymous,
    displayName: p.isAnonymous
      ? (anonNameByEmail.get(p.authorEmail) || "Anonymous Rose")
      : p.displayName,
    roseCount: p.roseCount,
    commentCount: p.commentCount,
    createdAt: p.createdAt,
    viewerHasRosed,
    isOwn,
  };
}

// ---------------------------------------------------------------------------
// GET /rose-wall — paginated feed of live posts.
// ---------------------------------------------------------------------------
router.get("/rose-wall", requireSession, async (req: any, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || "30", 10) || 30));
    const beforeId = parseInt((req.query.beforeId as string) || "0", 10) || 0;
    const me = req.session.email as string;

    const rows = beforeId > 0
      ? await db.select().from(roseWallPosts)
          .where(and(eq(roseWallPosts.status, "live"), lt(roseWallPosts.id, beforeId)))
          .orderBy(desc(roseWallPosts.id))
          .limit(limit)
      : await db.select().from(roseWallPosts)
          .where(eq(roseWallPosts.status, "live"))
          .orderBy(desc(roseWallPosts.id))
          .limit(limit);

    if (rows.length === 0) return res.json({ posts: [] });

    // Which of these has the viewer rose'd?
    const ids = rows.map((r) => r.id);
    const myRoses = await db.select({ postId: roseWallRoses.postId })
      .from(roseWallRoses)
      .where(and(eq(roseWallRoses.userEmail, me), inArray(roseWallRoses.postId, ids)));
    const rosedSet = new Set(myRoses.map((r) => r.postId));

    // Batch-fetch the permanent anonymous pen names for any author whose post
    // on this page is marked anonymous, so shapePost can substitute them in.
    const anonAuthors = rows.filter((r) => r.isAnonymous).map((r) => r.authorEmail);
    const anonNameByEmail = await getAnonymousNameMap(anonAuthors);

    res.json({ posts: rows.map((r) => shapePost(r, rosedSet.has(r.id), r.authorEmail === me, anonNameByEmail)) });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[rose-wall] feed error:", err?.message || err);
    res.status(500).json({ error: "Could not load the wall right now. Try again in a moment 🌹" });
  }
});

// ---------------------------------------------------------------------------
// POST /rose-wall — create a post (moderated).
// ---------------------------------------------------------------------------
router.post("/rose-wall", requireSession, async (req: any, res) => {
  try {
    const me = req.session.email as string;
    const body = req.body || {};
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const mood = typeof body.mood === "string" && ALLOWED_MOODS.includes(body.mood) ? body.mood : null;
    const isAnonymous = !!body.isAnonymous;

    if (!text) return res.status(400).json({ error: "Write something first 🌹" });
    if (text.length > MAX_POST_LEN) {
      return res.status(400).json({ error: `Posts are limited to ${MAX_POST_LEN} characters.` });
    }
    if (!rateOk(recentPosts, me, RATE_PER_HOUR_POSTS)) {
      return res.status(429).json({ error: "Slow down sister 🌹 — try again in a bit." });
    }

    // Moderate BEFORE the row exists. We still log blocked attempts as rows
    // with status='blocked' so we have an audit trail for repeat offenders.
    const verdict = await moderateText(text, { context: "post" });
    const displayName = await getDisplayName(me);

    if (!verdict.allow) {
      await db.insert(roseWallPosts).values({
        authorEmail: me,
        isAnonymous,
        displayName,
        text,
        mood,
        status: "blocked",
        moderationReason: verdict.reason,
      });
      return res.status(422).json({ blocked: true, error: BLOCK_MESSAGE });
    }

    const [row] = await db.insert(roseWallPosts).values({
      authorEmail: me,
      isAnonymous,
      displayName,
      text,
      mood,
      status: "live",
      moderationReason: verdict.severity === "warn" ? verdict.reason : null,
    }).returning();

    // For the create response we only need the author's own anon name, so a
    // single-row lookup is fine — and we only do it when actually anonymous.
    const ownAnonMap = new Map<string, string>();
    if (isAnonymous) ownAnonMap.set(me, await getAnonymousName(me));

    res.json({ post: shapePost(row, false, true, ownAnonMap) });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[rose-wall] post error:", err?.message || err);
    res.status(500).json({ error: "Could not post right now. Try again 🌹" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /rose-wall/:id — delete OWN post (soft delete so audit survives).
// ---------------------------------------------------------------------------
router.delete("/rose-wall/:id", requireSession, async (req: any, res) => {
  try {
    const me = req.session.email as string;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });

    const [row] = await db.select().from(roseWallPosts).where(eq(roseWallPosts.id, id)).limit(1);
    if (!row || row.status === "deleted") return res.status(404).json({ error: "Post not found" });
    if (row.authorEmail !== me) return res.status(403).json({ error: "You can only delete your own posts." });

    await db.update(roseWallPosts).set({ status: "deleted" }).where(eq(roseWallPosts.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[rose-wall] delete error:", err?.message || err);
    res.status(500).json({ error: "Could not delete that post. Try again 🌹" });
  }
});

// ---------------------------------------------------------------------------
// POST /rose-wall/:id/rose — toggle a rose (like). Returns new state.
// Wrapped in a transaction so the rose row + parent counter stay in sync,
// and we use the unique (post_id, user_email) constraint to defend against
// concurrent double-likes (race winners get the row, losers get a no-op).
// ---------------------------------------------------------------------------
router.post("/rose-wall/:id/rose", requireSession, async (req: any, res) => {
  try {
    const me = req.session.email as string;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });

    const result = await db.transaction(async (tx) => {
      const [post] = await tx.select().from(roseWallPosts).where(eq(roseWallPosts.id, id)).limit(1);
      if (!post || post.status !== "live") return { notFound: true as const };

      const [existing] = await tx.select().from(roseWallRoses)
        .where(and(eq(roseWallRoses.postId, id), eq(roseWallRoses.userEmail, me)))
        .limit(1);

      if (existing) {
        const deleted = await tx.delete(roseWallRoses)
          .where(eq(roseWallRoses.id, existing.id))
          .returning({ id: roseWallRoses.id });
        // Only decrement when we actually deleted a row (race: someone else may have raced us).
        if (deleted.length > 0) {
          const [u] = await tx.update(roseWallPosts)
            .set({ roseCount: sql`GREATEST(${roseWallPosts.roseCount} - 1, 0)` })
            .where(eq(roseWallPosts.id, id))
            .returning({ roseCount: roseWallPosts.roseCount });
          return { rosed: false, roseCount: u?.roseCount ?? 0 };
        }
        const [u] = await tx.select({ roseCount: roseWallPosts.roseCount })
          .from(roseWallPosts).where(eq(roseWallPosts.id, id)).limit(1);
        return { rosed: false, roseCount: u?.roseCount ?? 0 };
      }

      // Insert with onConflictDoNothing to swallow concurrent double-clicks
      // (the unique index on (post_id, user_email) is what makes this safe).
      const inserted = await tx.insert(roseWallRoses)
        .values({ postId: id, userEmail: me })
        .onConflictDoNothing()
        .returning({ id: roseWallRoses.id });
      if (inserted.length === 0) {
        // Another concurrent request already added the rose — read current count.
        const [u] = await tx.select({ roseCount: roseWallPosts.roseCount })
          .from(roseWallPosts).where(eq(roseWallPosts.id, id)).limit(1);
        return { rosed: true, roseCount: u?.roseCount ?? 0 };
      }
      const [u] = await tx.update(roseWallPosts)
        .set({ roseCount: sql`${roseWallPosts.roseCount} + 1` })
        .where(eq(roseWallPosts.id, id))
        .returning({ roseCount: roseWallPosts.roseCount });
      return { rosed: true, roseCount: u?.roseCount ?? 1 };
    });

    if ("notFound" in result) return res.status(404).json({ error: "Post not found" });
    res.json(result);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[rose-wall] rose error:", err?.message || err);
    res.status(500).json({ error: "Could not register that rose. Try again 🌹" });
  }
});

// ---------------------------------------------------------------------------
// GET /rose-wall/:id/comments — list comments on a post.
// ---------------------------------------------------------------------------
router.get("/rose-wall/:id/comments", requireSession, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });
    const me = req.session.email as string;

    const rows = await db.select().from(roseWallComments)
      .where(and(eq(roseWallComments.postId, id), eq(roseWallComments.status, "live")))
      .orderBy(desc(roseWallComments.id))
      .limit(100);

    // Same batched lookup pattern as the feed: collect anon authors on this
    // page and fetch their permanent pen names in one query.
    const anonAuthors = rows.filter((r) => r.isAnonymous).map((r) => r.authorEmail);
    const anonNameByEmail = await getAnonymousNameMap(anonAuthors);

    res.json({
      comments: rows.map((c) => ({
        id: c.id,
        text: c.text,
        isAnonymous: c.isAnonymous,
        displayName: c.isAnonymous
          ? (anonNameByEmail.get(c.authorEmail) || "Anonymous Rose")
          : c.displayName,
        createdAt: c.createdAt,
        isOwn: c.authorEmail === me,
      })),
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[rose-wall] comments error:", err?.message || err);
    res.status(500).json({ error: "Could not load comments. Try again 🌹" });
  }
});

// ---------------------------------------------------------------------------
// POST /rose-wall/:id/comments — add a comment (moderated).
// ---------------------------------------------------------------------------
router.post("/rose-wall/:id/comments", requireSession, async (req: any, res) => {
  try {
    const me = req.session.email as string;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const isAnonymous = !!req.body?.isAnonymous;
    if (!text) return res.status(400).json({ error: "Write something first 🌹" });
    if (text.length > MAX_COMMENT_LEN) return res.status(400).json({ error: `Comments are limited to ${MAX_COMMENT_LEN} characters.` });

    const [post] = await db.select().from(roseWallPosts).where(eq(roseWallPosts.id, id)).limit(1);
    if (!post || post.status !== "live") return res.status(404).json({ error: "Post not found" });

    if (!rateOk(recentComments, me, RATE_PER_HOUR_COMMENTS)) {
      return res.status(429).json({ error: "Easy now 🌹 — too many comments in a short time." });
    }

    const verdict = await moderateText(text, { context: "comment" });
    const displayName = await getDisplayName(me);

    if (!verdict.allow) {
      await db.insert(roseWallComments).values({
        postId: id, authorEmail: me, isAnonymous, displayName,
        text, status: "blocked", moderationReason: verdict.reason,
      });
      return res.status(422).json({ blocked: true, error: BLOCK_MESSAGE });
    }

    const [row] = await db.insert(roseWallComments).values({
      postId: id, authorEmail: me, isAnonymous, displayName,
      text, status: "live",
      moderationReason: verdict.severity === "warn" ? verdict.reason : null,
    }).returning();

    await db.update(roseWallPosts)
      .set({ commentCount: sql`${roseWallPosts.commentCount} + 1` })
      .where(eq(roseWallPosts.id, id));

    // Single-row anon-name lookup (only when actually anonymous) so the new
    // comment shows the author's pen name in-place without a refresh.
    const ownAnon = isAnonymous ? await getAnonymousName(me) : null;

    res.json({
      comment: {
        id: row.id,
        text: row.text,
        isAnonymous: row.isAnonymous,
        displayName: row.isAnonymous ? (ownAnon || "Anonymous Rose") : row.displayName,
        createdAt: row.createdAt,
        isOwn: true,
      },
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[rose-wall] comment error:", err?.message || err);
    res.status(500).json({ error: "Could not post that comment. Try again 🌹" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /rose-wall/:postId/comments/:cid — delete OWN comment.
// We require the URL :postId to match the comment's actual postId so a user
// can't decrement the count of an unrelated post by passing a wrong path id.
// Status flip + count decrement happen in one transaction so a half-update
// can't leave the count drifting.
// ---------------------------------------------------------------------------
router.delete("/rose-wall/:postId/comments/:cid", requireSession, async (req: any, res) => {
  try {
    const me = req.session.email as string;
    const cid = parseInt(req.params.cid, 10);
    const pid = parseInt(req.params.postId, 10);
    if (!Number.isFinite(cid) || !Number.isFinite(pid)) return res.status(400).json({ error: "bad id" });

    const outcome = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(roseWallComments).where(eq(roseWallComments.id, cid)).limit(1);
      if (!row || row.status === "deleted") return { code: 404 as const };
      if (row.postId !== pid) return { code: 404 as const }; // path mismatch — treat as not found
      if (row.authorEmail !== me) return { code: 403 as const };

      await tx.update(roseWallComments).set({ status: "deleted" }).where(eq(roseWallComments.id, cid));
      await tx.update(roseWallPosts)
        .set({ commentCount: sql`GREATEST(${roseWallPosts.commentCount} - 1, 0)` })
        .where(eq(roseWallPosts.id, row.postId));
      return { code: 200 as const };
    });

    if (outcome.code === 404) return res.status(404).json({ error: "Comment not found" });
    if (outcome.code === 403) return res.status(403).json({ error: "You can only delete your own comments." });
    res.json({ ok: true });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[rose-wall] delete comment error:", err?.message || err);
    res.status(500).json({ error: "Could not delete that comment. Try again 🌹" });
  }
});

// ---------------------------------------------------------------------------
// POST /rose-wall/:id/report — report a post (queued for human review).
// Body: { reason?: string, commentId?: number }
// ---------------------------------------------------------------------------
router.post("/rose-wall/:id/report", requireSession, async (req: any, res) => {
  try {
    const me = req.session.email as string;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });

    // Throttle reports so a single user can't spam-fill the moderation queue.
    if (!rateOk(recentReports, me, RATE_PER_HOUR_REPORTS)) {
      return res.status(429).json({ error: "You're reporting a lot — give us a moment to review 🌹" });
    }

    const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 200) : null;
    const rawCommentId = req.body?.commentId != null ? parseInt(req.body.commentId, 10) : null;
    const commentId = Number.isFinite(rawCommentId as number) ? (rawCommentId as number) : null;

    const targetType = commentId ? "comment" : "post";
    const targetId = commentId || id;

    // Validate the target actually exists & isn't deleted, so junk IDs don't
    // bloat the moderation queue. Anyone who can see the wall can report;
    // we don't restrict to live-only because reporting a still-blocked post
    // (e.g. for an admin to confirm) is fine, but it must exist.
    if (commentId) {
      const [c] = await db.select({ id: roseWallComments.id, status: roseWallComments.status })
        .from(roseWallComments).where(eq(roseWallComments.id, commentId)).limit(1);
      if (!c || c.status === "deleted") return res.status(404).json({ error: "Comment not found" });
    } else {
      const [p] = await db.select({ id: roseWallPosts.id, status: roseWallPosts.status })
        .from(roseWallPosts).where(eq(roseWallPosts.id, id)).limit(1);
      if (!p || p.status === "deleted") return res.status(404).json({ error: "Post not found" });
    }

    try {
      await db.insert(roseWallReports).values({
        targetType, targetId, reporterEmail: me, reason, status: "pending",
      });
    } catch (e: any) {
      // Unique constraint on (target_type, target_id, reporter_email) — already reported.
      if (String(e?.message || e).includes("rose_wall_reports_reporter_target_uniq")) {
        return res.json({ ok: true, alreadyReported: true });
      }
      throw e;
    }
    res.json({ ok: true });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[rose-wall] report error:", err?.message || err);
    res.status(500).json({ error: "Could not file that report. Try again 🌹" });
  }
});

export default router;
