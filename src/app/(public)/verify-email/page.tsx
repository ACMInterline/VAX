import { AuthPage, createAuthPageMetadata } from "@/components/auth/auth-page";

export const metadata = createAuthPageMetadata("bg", "verify-email");

export default function VerifyEmailPage() {
  return <AuthPage locale="bg" kind="verify-email" />;
}
