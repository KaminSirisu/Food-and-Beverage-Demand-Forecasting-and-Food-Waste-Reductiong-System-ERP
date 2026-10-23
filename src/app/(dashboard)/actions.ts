"use server";
// Dashboard server actions. Every export here is a public POST endpoint — keep them minimal.
import { deleteFlash } from "@/lib/flash";

export async function clearFlash(): Promise<void> {
    await deleteFlash();
}