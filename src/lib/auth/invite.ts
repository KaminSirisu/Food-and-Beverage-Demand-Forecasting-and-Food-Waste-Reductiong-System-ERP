// Invite tokens (Lesson 1). One place defines "how a token is hashed" so the CLI, the page and
// the action can never disagree. No "server-only" here: prisma/invite.ts (plain tsx) imports it.
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Valid = hash matches AND not expired. The signup page calls it to decide whether to show the
// form; the signup action calls it AGAIN, because a page check can't protect a POST.
export async function findValidInvite(token: string) {
  const user = await db.user.findUnique({
    where: { inviteTokenHash: hashToken(token) },
    select: { id: true, email: true, role: true, inviteExpiresAt: true, branches: { select: { storeNo: true } } },
  });
  if (!user?.inviteExpiresAt || user.inviteExpiresAt < new Date()) return null;
  return user;
}