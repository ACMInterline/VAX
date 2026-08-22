import { AuthPage, createAuthPageMetadata } from "@/components/auth/auth-page";

export const metadata = createAuthPageMetadata("bg", "login");

export default function LoginPage() {
  return <AuthPage locale="bg" kind="login" />;
}
