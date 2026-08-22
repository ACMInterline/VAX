import { AuthPage, createAuthPageMetadata } from "@/components/auth/auth-page";

export const metadata = createAuthPageMetadata("en", "verify-email");

export default function VerifyEmailPage() {
  return <AuthPage locale="en" kind="verify-email" />;
}
