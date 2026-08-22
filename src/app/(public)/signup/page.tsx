import { AuthPage, createAuthPageMetadata } from "@/components/auth/auth-page";

export const metadata = createAuthPageMetadata("bg", "signup");

export default function SignupPage() {
  return <AuthPage locale="bg" kind="signup" />;
}
