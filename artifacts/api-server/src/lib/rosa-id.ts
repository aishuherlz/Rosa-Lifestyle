import { db, rosaUsers } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function generateUniqueRosaId(): Promise<string> {
  let attempts = 0;
  while (attempts < 20) {
    const num = Math.floor(1000 + Math.random() * 9000);
    const rosaId = `ROSA#${num}`;
    const existing = await db
      .select({ id: rosaUsers.id })
      .from(rosaUsers)
      .where(eq(rosaUsers.rosaId, rosaId))
      .limit(1);
    if (existing.length === 0) return rosaId;
    attempts++;
  }
  const num = Math.floor(10000 + Math.random() * 90000);
  return `ROSA#${num}`;
}

export function validateNickname(nickname: string): { valid: boolean; error?: string } {
  if (!nickname) return { valid: false, error: "Nickname is required" };
  if (nickname.length < 3) return { valid: false, error: "Nickname must be at least 3 characters" };
  if (nickname.length > 20) return { valid: false, error: "Nickname must be 20 characters or less" };
  if (!/^[a-zA-Z0-9_]+$/.test(nickname)) return { valid: false, error: "Only letters, numbers and underscores allowed" };
  return { valid: true };
}
