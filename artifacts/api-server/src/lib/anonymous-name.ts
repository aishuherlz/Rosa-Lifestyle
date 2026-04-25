// Generates a permanent, single-blind pen name for use on the Rose Wall and
// any other community surface where the user posts anonymously. Names are
// chosen from one of two formats so the wall feels less repetitive:
//
//   - "RosePetal_NNNN"          — 4 random digits, ~10k space
//   - "Rose_<Adjective><Flower>"— curated luxury/feminine adjective + flower
//
// Combined name space is ~10k + 40*40 ≈ 11.6k unique values; well above any
// realistic concurrent user count for the foreseeable product roadmap.
//
// The DB column `rosa_users.anonymous_name` is UNIQUE so collisions surface
// as 23505 errors. We defend against those at write-time with a small retry
// loop (`generateUniqueAnonymousName`) — at low double-digit attempts the
// chance of repeated collision is negligible. If the namespace is so
// saturated that we can't find a free name in 20 tries, we return `null`
// rather than emit a non-conforming fallback; callers (auth's insert/
// backfill paths) skip the write and try again on the next sign-in. This
// keeps the format contract strict and gives ops a clear "saturation"
// signal long before we'd ever actually run out.

import { db, rosaUsers } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

const ADJECTIVES = [
  "Golden", "Velvet", "Silken", "Crimson", "Coral", "Amber", "Pearl", "Ivory",
  "Sapphire", "Emerald", "Ruby", "Blush", "Wild", "Quiet", "Bold", "Brave",
  "Soft", "Bright", "Gentle", "Fearless", "Radiant", "Serene", "Lush", "Dreamy",
  "Tender", "Mystic", "Honey", "Sunny", "Moonlit", "Starlit", "Twilight",
  "Dawning", "Garden", "Daring", "Joyful", "Tranquil", "Vibrant", "Flourishing",
  "Whispering", "Glowing",
];

const FLOWERS = [
  "Daisy", "Rose", "Lily", "Iris", "Peony", "Tulip", "Orchid", "Magnolia",
  "Jasmine", "Lotus", "Violet", "Camellia", "Lavender", "Sunflower", "Hibiscus",
  "Gardenia", "Dahlia", "Poppy", "Marigold", "Azalea", "Wisteria", "Bluebell",
  "Foxglove", "Snapdragon", "Petunia", "Buttercup", "Anemone", "Freesia",
  "Begonia", "Plumeria", "Geranium", "Larkspur", "Mimosa", "Carnation",
  "Yarrow", "Aster", "Cosmos", "Zinnia", "Dahlia", "Bluebell",
];

function pick<T>(arr: T[]): T {
  // Use crypto for a balanced distribution; Math.random would also be fine
  // here, but we already pull crypto in for token signing so might as well
  // be uniform with no modulo bias.
  const i = crypto.randomInt(0, arr.length);
  return arr[i];
}

function fourDigits(): string {
  // Pad-leading zeros so "0042" reads cleaner than "42".
  return crypto.randomInt(0, 10000).toString().padStart(4, "0");
}

export function randomAnonymousName(): string {
  // 50/50 split between formats for variety.
  if (crypto.randomInt(0, 2) === 0) {
    return `RosePetal_${fourDigits()}`;
  }
  return `Rose_${pick(ADJECTIVES)}${pick(FLOWERS)}`;
}

// Generates a name and verifies it isn't already in `rosa_users`. There is a
// theoretical TOCTOU race between the SELECT and the eventual INSERT/UPDATE,
// but the DB UNIQUE constraint makes that race safe (caller catches 23505 and
// retries). In practice 20 attempts is more than enough for an ~11k-name
// namespace.
//
// Returns `null` when the namespace is so saturated we can't find a free
// candidate. We deliberately do NOT fall back to a non-conforming format
// (e.g. timestamp-padded names) because the spec says all names must be
// either "RosePetal_NNNN" or "Rose_<Adjective><Flower>" — preserving that
// contract is more important than always succeeding on the first attempt.
// The caller decides what to do with `null` (skip backfill / insert without
// a name / etc).
export async function generateUniqueAnonymousName(): Promise<string | null> {
  for (let i = 0; i < 20; i++) {
    const candidate = randomAnonymousName();
    const existing = await db
      .select({ id: rosaUsers.id })
      .from(rosaUsers)
      .where(eq(rosaUsers.anonymousName, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
  }
  return null;
}
