import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "session";
const SESSION_DAYS = 7;

// Keep it minimal: ids only, no email/name (the cookie is readable by anyone holding it signed, not encrypted).
export type SessionPayload = {
    userId: string;
    role: Role;
    storeNo: number;
}

function key(): Uint8Array {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) throw new Error("SESSION_SECRET missing or shorter than 32 chars");
    return new TextEncoder().encode(secret);
}

export async function encrypt(payload: SessionPayload): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DAYS}d`)
        .sign(key());
}

// Return null for missing, expired or tampered tokens - callers just check for null
export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify<SessionPayload>(token, key(), { algorithms: ["HS256"] });
        return payload;
    } catch {
        return null;
    }
}

export async function createSession(payload: SessionPayload): Promise<void> {
    const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    (await cookies()).set(SESSION_COOKIE, await encrypt(payload), {
        httpOnly: true, // JS in the page can't read it -> XSS can't steal it
        secure: process.env.NODE_ENV === "production", // https only in prod; localhost is http
        sameSite: "lax", // not sent on cross-site POSTs -> basic CSRF protection
        path: "/",
        expires,
    });
}

export async function deleteSession(): Promise<void> {
    (await cookies()).delete(SESSION_COOKIE);
}