import { Router } from "express";
import { eq, and, or } from "drizzle-orm";
import { db, rosaUsers } from "@workspace/db";
import { friendRequests, friendships, blockedUsers } from "@workspace/db";
import { requireSession } from "./auth";

const router = Router();

// Search users by ROSA ID or nickname
router.get("/search", requireSession, async (req, res) => {
  const q = String(req.query.q || "").trim().toUpperCase();
  if (!q || q.length < 3) return res.json({ users: [] });
  try {
    const users = await db.select({
      rosaId: rosaUsers.rosaId,
      name: rosaUsers.name,
      nickname: rosaUsers.nickname,
      profilePhotoUrl: rosaUsers.profilePhotoUrl,
    })
    .from(rosaUsers)
    .where(
      or(
        eq(rosaUsers.rosaId, q),
        eq(rosaUsers.nickname, q.toLowerCase())
      )
    )
    .limit(10);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

// Send friend request
router.post("/request", requireSession, async (req, res) => {
  const fromEmail = req.rosaUser?.emailOrPhone;
  const { toRosaId } = req.body;
  try {
    const target = await db.select().from(rosaUsers).where(eq(rosaUsers.rosaId, toRosaId)).limit(1);
    if (!target[0]) return res.status(404).json({ error: "User not found" });
    const toEmail = target[0].emailOrPhone;
    if (toEmail === fromEmail) return res.status(400).json({ error: "Cannot add yourself" });
    await db.insert(friendRequests).values({ fromEmail, toEmail, status: "pending" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to send request" });
  }
});

// Accept friend request
router.post("/accept/:id", requireSession, async (req, res) => {
  const email = req.rosaUser?.emailOrPhone;
  try {
    const [request] = await db.select().from(friendRequests)
      .where(and(eq(friendRequests.id, req.params.id), eq(friendRequests.toEmail, email))).limit(1);
    if (!request) return res.status(404).json({ error: "Request not found" });
    await db.update(friendRequests).set({ status: "accepted" }).where(eq(friendRequests.id, req.params.id));
    await db.insert(friendships).values({ userEmail: email, friendEmail: request.fromEmail });
    await db.insert(friendships).values({ userEmail: request.fromEmail, friendEmail: email });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to accept request" });
  }
});

// Decline friend request
router.post("/decline/:id", requireSession, async (req, res) => {
  const email = req.rosaUser?.emailOrPhone;
  try {
    await db.update(friendRequests).set({ status: "declined" })
      .where(and(eq(friendRequests.id, req.params.id), eq(friendRequests.toEmail, email)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to decline request" });
  }
});

// Get friends list
router.get("/", requireSession, async (req, res) => {
  const email = req.rosaUser?.emailOrPhone;
  try {
    const friends = await db.select({
      rosaId: rosaUsers.rosaId,
      name: rosaUsers.name,
      nickname: rosaUsers.nickname,
      profilePhotoUrl: rosaUsers.profilePhotoUrl,
    })
    .from(friendships)
    .innerJoin(rosaUsers, eq(rosaUsers.emailOrPhone, friendships.friendEmail))
    .where(eq(friendships.userEmail, email));
    res.json({ friends });
  } catch (err) {
    res.status(500).json({ error: "Failed to get friends" });
  }
});

// Get pending requests
router.get("/requests", requireSession, async (req, res) => {
  const email = req.rosaUser?.emailOrPhone;
  try {
    const requests = await db.select({
      id: friendRequests.id,
      fromEmail: friendRequests.fromEmail,
      createdAt: friendRequests.createdAt,
      name: rosaUsers.name,
      nickname: rosaUsers.nickname,
      rosaId: rosaUsers.rosaId,
      profilePhotoUrl: rosaUsers.profilePhotoUrl,
    })
    .from(friendRequests)
    .innerJoin(rosaUsers, eq(rosaUsers.emailOrPhone, friendRequests.fromEmail))
    .where(and(eq(friendRequests.toEmail, email), eq(friendRequests.status, "pending")));
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: "Failed to get requests" });
  }
});

// Remove friend
router.delete("/:friendEmail", requireSession, async (req, res) => {
  const email = req.rosaUser?.emailOrPhone;
  const friendEmail = req.params.friendEmail;
  try {
    await db.delete(friendships).where(
      or(
        and(eq(friendships.userEmail, email), eq(friendships.friendEmail, friendEmail)),
        and(eq(friendships.userEmail, friendEmail), eq(friendships.friendEmail, email))
      )
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove friend" });
  }
});

// Block user
router.post("/block/:blockEmail", requireSession, async (req, res) => {
  const email = req.rosaUser?.emailOrPhone;
  const blockedEmail = req.params.blockEmail;
  try {
    await db.insert(blockedUsers).values({ blockerEmail: email, blockedEmail });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to block user" });
  }
});

export default router;
