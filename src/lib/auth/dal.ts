// Data Access Layer: the REAL auth check. proxy.ts only does a fast, optimistic redirect;
// every protected page / action calls verifySession() (G2 / NFR4).
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { decrypt, SESSION_COOKIE } from "./session";

// cache(): many components can call this in one render; the cookie is verified once.
export const verifySession = cache(async () => {
    const session = await decrypt((await cookies()).get(SESSION_COOKIE)?.value);
    if (!session) redirect("/login");
    return session;
});

// DTO: return only what the UI needs - never the user row with passwordHash / inviteTokenHash.
export const getCurrentUser = cache(async () => {
    const { userId, storeNo } = await verifySession();
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true },
    });
    // Valid cookie but user deleted -> clear the cookie via /logout (a page can't delete cookies itself).
    if (!user) redirect("/logout");
    return { ...user, storeNo };
});