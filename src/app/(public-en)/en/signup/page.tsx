import { AuthPage, createAuthPageMetadata } from "@/components/auth/auth-page";

export const metadata = createAuthPageMetadata("en", "signup");

export default function SignupPage() {
  return <AuthPage locale="en" kind="signup" />;
}
