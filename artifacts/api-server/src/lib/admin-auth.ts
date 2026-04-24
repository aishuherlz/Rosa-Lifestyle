// Tiny shared gate for diagnostic / admin-only endpoints.
// Requires header `x-admin-token: <ADMIN_DIAG_TOKEN>` or `?token=<ADMIN_DIAG_TOKEN>`.
// In dev (no token configured) we still allow access from localhost so the
// developer can hit diagnostics without ceremony.
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_DIAG_TOKEN?.trim();
  const supplied =
    (req.headers["x-admin-token"] as string | undefined)?.trim() ||
    (typeof req.query.token === "string" ? req.query.token.trim() : "");

  if (expected) {
    if (supplied && safeEqual(supplied, expected)) { next(); return; }
    res.status(401).json({ ok: false, error: "Admin token required" });
    return;
  }

  // No token configured → allow only loopback so prod accidentally-unset
  // tokens don't leak diagnostics, but local dev still works.
  const ip = (req.ip || "").replace(/^::ffff:/, "");
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") { next(); return; }
  res.status(401).json({ ok: false, error: "Admin token required (set ADMIN_DIAG_TOKEN env var)" });
}
