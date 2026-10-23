// One-time "flash" message that survives exactly one redirect (e.g. login → dashboard toast).
// Set by server actions, read by the dashboard layout, cleared by clearFlash() after the toast shows.
import "server-only";
import { cookies } from "next/headers";

const FLASH_COOKIE = "flash";
export type Flash = "login" | "signup";

export async function setFlash(flash: Flash): Promise<void> {
    (await cookies()).set(FLASH_COOKIE, flash, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 });
}

// Only known values pass — a hand-edited cookie can't inject text into the toast.
export async function readFlash(): Promise<Flash | null> {
    const value = (await cookies()).get(FLASH_COOKIE)?.value;
    return value === "login" || value === "signup" ? value : null;
}

export async function deleteFlash(): Promise<void> {
    (await cookies()).delete(FLASH_COOKIE);
}