"use client";
import { useActionState } from "react";
import { signup } from "../actions";
import { Field } from '../_components/Field';

export function SignupForm({ token, email }: { token: string; email: string }) {
    const [state, action, pending] = useActionState(signup, undefined);

    return (
        <form action={action} className="flex flex-col gap-5">
            <input type="hidden" name="token" value={token} />
            <Field id="email" label="Email" type="email" value={email} readOnly />
            <Field 
                id="name" name="name" label="Your name" placeholder="e.g. Somchai K."
                autoComplete="name" required
                defaultValue={state?.values?.name} errors={state?.errors?.name}
            />
            <Field 
                id="password" name="password" type="password" label="Password" placeholder="At least 8 characters"
                autoComplete="new-password" required minLength={8}
                errors={state?.errors?.password}
            />
            <Field
                id="confirmPassword" name="confirmPassword" type="password" label="Confirm password"
                autoComplete="new-password" required
                errors={state?.errors?.confirmPassword}
            />
            {state?.message && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.message}
                </p>
            )}

            <button
                type="submit" disabled={pending}
                className="h-9 rounded-md bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {pending ? "Activating..." : "Activate account"}
            </button>
        </form>
    )
}