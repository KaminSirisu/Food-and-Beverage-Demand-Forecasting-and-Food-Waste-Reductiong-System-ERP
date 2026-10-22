"use server";
import type { FormState } from "@/lib/auth/schema";

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
    return { message: "Login is not wired up yet", values: { email: String(formData.get("email") ?? "") } };
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
    return { message: "Signup is not wired up yet", values: { name: String(formData.get("name") ?? "") } };
}