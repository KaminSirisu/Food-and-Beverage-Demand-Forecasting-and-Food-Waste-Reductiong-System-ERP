"use client";
// Shows the one-time success toast after login / signup, then clears the flash cookie.
import { useEffect, useRef } from "react";
import { sileo } from "sileo";
import { clearFlash } from "../actions";
import type { Flash } from "@/lib/flash"; // type-only: erased at build, so server-only isn't pulled in

const MESSAGES: Record<Flash, (name: string) => { title: string, description: string }> = {
    login: (name) => ({ title: `Welcome back, ${name}`, description: "You're signed in." }),
    signup: (name) => ({ title: "Account activated", description: `Welcome to FreshWaste, ${name}.` }),
}

export function FlashToast({ flash, name }: { flash: Flash | null; name: string }) {
    const shown = useRef(false);

    useEffect(() => {
        // Dev StrictMode runs effects twice on purpose; the ref keeps it to one toast.
        if (!flash || shown.current) return;
        shown.current = true;
        sileo.success(MESSAGES[flash](name));
        void clearFlash(); // fire-and-forget: the toast doesn't need to wait for the cookie delete
    }, [flash, name]);

    return null; // renders nothing — it only triggers the toast
}