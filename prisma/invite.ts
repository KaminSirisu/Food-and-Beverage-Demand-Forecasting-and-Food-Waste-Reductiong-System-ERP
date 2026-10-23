// Leader-only CLI: invite the Store Manager. The only way an account can come into existence (G2 / NFR4).
// Usage: npx tsx prisma/invite.ts <email> <storeNo>
// Re-running for the same email issues a fresh link (doubles as a password reset).
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth/invite";

const INVITE_TTL_HOURS = 48;

async function main() {
   const [emailArg, storeArg] = process.argv.slice(2);
   const storeNo = Number(storeArg);
   if (!emailArg || !Number.isInteger(storeNo)) {
        console.error("usage: npx tsx prisma/invite.ts <email> <storeNo>");
        process.exit(1);
   }
   const email = emailArg.trim().toLowerCase(); // login compares lowercase, so store lowercase

   const branch = await db.branch.findUnique({ where: { storeNo } });
   if (!branch?.isActive) throw new Error(`branch ${storeNo} missing or inactive - run npm run db:seed first`);

   // 32 random bytes -> ~43 URL-safe chars. Only the hash goes to the DB.
   const token = randomBytes(32).toString("base64url");
   const inviteTokenHash = hashToken(token);
   const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

   // Role is decided HERE, by whoever has DB access - never by the person signing up.
   const user = await db.user.upsert({
     where: { email },
     update: { inviteTokenHash, inviteExpiresAt },
     create: { email, name: email.split("@")[0], role: "STORE_MANAGER", inviteTokenHash, inviteExpiresAt },
   });

   // G2: which branch this user may see.
   await db.userBranch.upsert({
    where: { userId_storeNo: { userId: user.id, storeNo }},
    update: {},
    create: { userId: user.id, storeNo },
   });

   const appUrl = process.env.APP_URL ?? "http://localhost:3000";
   console.log(`✔ ${email} → STORE_MANAGER, branch ${storeNo}`);
   console.log(`→ ${appUrl}/signup?token=${token}`);
   console.log(`  expires ${inviteExpiresAt.toLocaleString()} — send it privately, it is shown only once`);
}

main().finally(() => db.$disconnect());