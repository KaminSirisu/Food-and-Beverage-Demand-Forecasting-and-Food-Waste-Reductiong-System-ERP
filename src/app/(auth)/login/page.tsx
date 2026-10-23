import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
    return (
        <>
            <div className="mb-10 text-center">
                <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                    Welcome to FreshWaste ERP
                </h1>
                <p className="mt-2 text-sm text-slate-500">Forecast and waste control for your branch</p>
            </div>
            <LoginForm />
        </>
    )
}