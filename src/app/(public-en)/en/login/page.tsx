import { AuthPage, createAuthPageMetadata } from "@/components/auth/auth-page";

export const metadata = createAuthPageMetadata("en", "login");

export default function LoginPage() {
  return <AuthPage locale="en" kind="login" />;
}
