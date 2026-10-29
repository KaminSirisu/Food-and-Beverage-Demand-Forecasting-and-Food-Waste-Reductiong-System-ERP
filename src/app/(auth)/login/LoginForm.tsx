"use client";
import { useActionState } from "react";
import { login } from "../actions";
import { Field } from "../_components/Field";

export function LoginForm() {
    const [state, action, pending] = useActionState(login, undefined);

    return (
        <form action={action} className="flex flex-col gap-5">
            <Field 
                id="email" name="email" type="email" label="Email" placeholder="Type your email"
                autoComplete="email" required
                defaultValue={state?.values?.email}
                errors={state?.errors?.email}
            />
            <Field 
                id="password" name="password" type="password" label="Password" placeholder="Type your password"
                autoComplete="current-password" required
                errors={state?.errors?.password}
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
                {pending ? "Signing in..." : "Continue with email"}
            </button>
        </form>
    )
}