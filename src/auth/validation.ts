import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1)
  .max(254)
  .email()
  .transform((value) => value.toLowerCase());

const password = z.string().min(12).max(128);

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const signupSchema = z
  .object({
    displayName: z.string().trim().min(2).max(160),
    email,
    password,
    passwordConfirmation: z.string().min(1).max(128),
    preferredLocale: z.enum(["bg", "en"]),
    termsAccepted: z.literal("on"),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ["passwordConfirmation"],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1).max(4_096),
    password,
    passwordConfirmation: z.string().min(1).max(128),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ["passwordConfirmation"],
  });

export const emailVerificationRequestSchema = z.object({ email });

export const emailVerificationSchema = z.object({
  email,
  otp: z.string().trim().regex(/^\d{6}$/),
});

export type AuthLocale = "bg" | "en";

export function authLocale(value: FormDataEntryValue | null): AuthLocale {
  return value === "en" ? "en" : "bg";
}
