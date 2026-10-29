import type { Metadata } from "next";
import Link from "next/link";
import { findValidInvite } from "@/lib/auth/invite";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Activate account" };

// Next 16: searchParams is a Promise
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
    const { token } = await searchParams;
    const invite = typeof token === "string" ? await findValidInvite(token) : null;

    if (!invite) {
        return (
            <div className="text-center">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Invite link not valid</h1>
                <p className="mt-3 text-sm text-slate-500">
                    This link is wrong, expired, or already used. Ask your Area Manager for a new one.
                </p>
                <Link href="/login" className="mt-8 inline-block text-sm font-medium text-slate-900 underline">
                    Back to log in
                </Link>
            </div>
        )
    }
    return (
        <>
            <div className="mb-10 text-center">
                <h1 className="text-4xl font-bold tracking-tight text-slate-900">Activate your account</h1>
                <p className="mt-2 text-sm text-slate-500">Store Manager · Branch {invite.branches[0]?.storeNo}</p>
            </div>
            <SignupForm token={token as string} email={invite.email} />
        </>
    )
}