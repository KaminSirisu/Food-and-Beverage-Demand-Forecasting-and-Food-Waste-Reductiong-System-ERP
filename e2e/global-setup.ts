// Logs Playwright in as the seeded e2e Store Manager without typing a password:
// signs the same session JWT as src/lib/auth/session.ts (HS256, { userId, role, storeNo }).
// session.ts itself can't be imported here — it is "server-only".
import { mkdir, writeFile } from "node:fs/promises";
import { config } from "dotenv";
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

const E2E_EMAIL = "e2e-manager@freshwaste.test"; // same as prisma/seed-demo.ts
const STORE_NO = 801;

export default async function globalSetup() {
    config({ quiet: true });
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) throw new Error("SESSION_SECRET missing in .env");

    const db = new PrismaClient();
    try {
        const user = await db.user.findUnique({ where: { email: E2E_EMAIL } });
        if (!user) throw new Error("e2e user missing — run `npm run db:seed && npm run db:seed:demo` first");

        const token = await new SignJWT({ userId: user.id, role: user.role, storeNo: STORE_NO })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(new TextEncoder().encode(secret));

        await mkdir("e2e/.auth", { recursive: true });
        await writeFile("e2e/.auth/manager.json", JSON.stringify({
            cookies: [{
                name: "session", value: token, domain: "localhost", path: "/",
                expires: Math.floor(Date.now() / 1000) + 3600, httpOnly: true, secure: false, sameSite: "Lax",
            }],
            origins: [],
        }));
    } finally {
        await db.$disconnect();
    }
}
