import { AuthPage, createAuthPageMetadata } from "@/components/auth/auth-page";

export const metadata = createAuthPageMetadata("bg", "forgot-password");

export default function ForgotPasswordPage() {
  return <AuthPage locale="bg" kind="forgot-password" />;
}
