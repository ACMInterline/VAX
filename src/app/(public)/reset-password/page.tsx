import { AuthPage, createAuthPageMetadata } from "@/components/auth/auth-page";

export const metadata = createAuthPageMetadata("bg", "reset-password");

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tokenValue = (await searchParams).token;
  const token = typeof tokenValue === "string" ? tokenValue : undefined;
  return <AuthPage locale="bg" kind="reset-password" resetToken={token} />;
}
