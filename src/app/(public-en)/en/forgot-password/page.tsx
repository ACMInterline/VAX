import { AuthPage, createAuthPageMetadata } from "@/components/auth/auth-page";

export const metadata = createAuthPageMetadata("en", "forgot-password");

export default function ForgotPasswordPage() {
  return <AuthPage locale="en" kind="forgot-password" />;
}
