// Optimistic route guard (G2 / NFR4). Runs before every matched request; reads ONLY the cookie signature
// no DB (it runs on every prefetch too). The real check is getCurrentUser() in the layout.
import { type NextRequest, NextResponse } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/auth/session";

const AUTH_PAGES = ['/login', '/signup'];
const ALWAYS_OPEN = ["/logout"];

export default async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;
    if (ALWAYS_OPEN.includes(pathname)) return NextResponse.next();

    const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);
    const isAuthPage = AUTH_PAGES.includes(pathname);

    if (!session && !isAuthPage) return NextResponse.redirect(new URL("/login", req.nextUrl));
    if (session && isAuthPage) return NextResponse.redirect(new URL("/", req.nextUrl));
    return NextResponse.next();
}

export const config = {
    // Skip: /api (Power Automate authenticates /api/ingest with x-api-key, not a cookie),
    // Next internals, and static files.
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
}