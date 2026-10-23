"use server";
// Auth server actions. Server actions are public POST endpoint: anyone can call them with any FormData
// So every check (validate, invite, password) happens HERE, not in the form
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { LoginSchema, SignupSchema, type FormState } from "@/lib/auth/schema";
import { dummyHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import { findValidInvite, hashToken } from "@/lib/auth/invite";

const INVALID_LOGIN = "Invalid email or password";

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
    const email = String(formData.get("email") ?? "");
    // Converts FormData to a plain JS object, then validates it against LoginSchema.
    // safeParse returns { success: true, data } if valid, or { success: false, error }
    const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
    // flatten() convert complex error object into clean, flat Javascript object
    if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values: { email } };

    const user = await db.user.findUnique({
        where: { email: parsed.data.email },
        select: { id:true, role:true, passwordHash:true, branches: { select: { storeNo: true }}},
    })

    // Always run exactly one scrypt — even for unknown emails — so response time doesn't reveal who exists.
    const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await dummyHash()));
    const storeNo = user?.branches[0]?.storeNo; // scope = one branch per manager (G2)
    if (!user?.passwordHash || !ok || storeNo === undefined) return { message: INVALID_LOGIN, values: { email } };

    await createSession({ userId: user.id, role: user.role, storeNo });
    await db.auditLog.create({ data: { actor: user.id, action: "LOGIN", entity: "app_user", entityId: user.id } } ); // NFR5
    redirect("/");
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
    const name = String(formData.get("name") ?? "");
    const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values: { name } };

    // Re-check the invite: the signup PAGE checked it, but this action can be called without the page.
    const invite = await findValidInvite(parsed.data.token);
    const storeNo = invite?.branches[0]?.storeNo;
    if (!invite || storeNo === undefined) return { message: "This invite link is no longer valid. Ask for a new one."};

    // Claim the invite atomically: the WHERE includes the token hash, so if two submits race,
    // only the first matches; the second updates 0 rows. Single-use is enforced by the DB, not by luck.
    const { count } = await db.user.updateMany({
        where: { id: invite.id, inviteTokenHash: hashToken(parsed.data.token) },
        data: {
            name: parsed.data.name,
            passwordHash: await hashPassword(parsed.data.password),
            inviteTokenHash: null,
            inviteExpiresAt: null,
        }
    });
    if (count === 0) return { message: "This invite link is no longer valid. Ask for a new one." };
    // Role and branch come from the invite row — never from the form.
    await createSession({ userId: invite.id, role: invite.role, storeNo });
    await db.auditLog.create({ data: { actor: invite.id, action: "SIGNUP", entity: "app_user", entityId: invite.id } }); // NFR5
    redirect("/");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}