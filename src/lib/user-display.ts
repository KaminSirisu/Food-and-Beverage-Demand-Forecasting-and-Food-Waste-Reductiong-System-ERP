// Display helpers for the signed-in user (sidebar card, header avatar).
import type { Role } from "@prisma/client";

// Record<Role, ...>: add a new Role to the schema and TypeScript forces a label here.
export const ROLE_LABEL: Record<Role, string> = {
    STORE_MANAGER: "Store Manager",
    AREA_MANAGER: "Area Manager",
}

export function initials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => Array.from(word.replace(/^[เแโใไ]/, ""))[0] ?? "")
        .join("")
        .toUpperCase();
}