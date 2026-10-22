// Form validation, shared by the server actions (the server never trusts the browser's checks).
import { z } from "zod";

export const LoginSchema = z.object({
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password: z.string().min(1, "Enter your password"),
})

export const SignupSchema = z
    .object({
        token: z.string().min(1),
        name: z.string().trim().min(1, "Enter you name").max(100),
        password: z.string().min(8, "At least 8 characters").max(128), // max: stops 1 MB passwords hogging scrypt
        confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

// What a server action returns to useActionState: field errors and/or one form-level message.
export type FormState = { error?: Record<string, string[] | undefined>; message?: string } | undefined;