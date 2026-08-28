import type { AuthLocale } from "@/auth/validation";

export type AuthPageKind =
  | "login"
  | "signup"
  | "forgot-password"
  | "reset-password"
  | "verify-email";

export const authContent = {
  bg: {
    common: {
      email: "Имейл",
      password: "Парола",
      passwordConfirmation: "Потвърдете паролата",
      displayName: "Име",
      passwordHint: "Използвайте поне 12 знака. Можете да поставите парола от мениджър на пароли.",
      working: "Обработва се…",
      backHome: "Към началната страница",
      switchLocale: "English",
      switchLocaleCode: "EN",
      verifyEmailAction: "Към потвърждение на имейл",
      required: "Задължително поле",
    },
    login: {
      eyebrow: "Защитен достъп",
      title: "Вход във VAX",
      description: "Влезте в защитената зона за клиенти и екипа.",
      submit: "Вход",
      forgot: "Забравена парола?",
      alternateLead: "Нямате профил?",
      alternateLink: "Създайте клиентски профил",
    },
    signup: {
      eyebrow: "Клиентски профил",
      title: "Създаване на профил",
      description: "Регистрацията създава само клиентски достъп. Данни за имот и услуга ще се добавят по-късно.",
      submit: "Създаване на профил",
      terms: "Потвърждавам, че съм запознат/а с бъдещите условия и политика за поверителност.",
      alternateLead: "Вече имате профил?",
      alternateLink: "Вход",
    },
    forgot: {
      eyebrow: "Възстановяване",
      title: "Забравена парола",
      description: "Въведете имейла си. Отговорът е еднакъв независимо дали профилът съществува.",
      submit: "Изпращане на инструкции",
      alternateLink: "Обратно към вход",
    },
    reset: {
      eyebrow: "Нова парола",
      title: "Смяна на парола",
      description: "Създайте нова парола чрез защитената връзка от доставчика на идентичност.",
      submit: "Запазване на новата парола",
      missingToken: "Връзката за възстановяване липсва или е невалидна. Заявете нова.",
      alternateLink: "Заявете нова връзка",
    },
    verify: {
      eyebrow: "Потвърждение",
      title: "Потвърдете имейла си",
      description: "Въведете шестцифрения код от съобщението или заявете нов код. Не споделяйте кода с други хора.",
      otp: "Код за потвърждение",
      submit: "Потвърждение",
      resend: "Изпращане на нов код",
      alternateLink: "Обратно към вход",
    },
  },
  en: {
    common: {
      email: "Email",
      password: "Password",
      passwordConfirmation: "Confirm password",
      displayName: "Name",
      passwordHint: "Use at least 12 characters. Pasting from a password manager is supported.",
      working: "Working…",
      backHome: "Back to the public site",
      switchLocale: "Български",
      switchLocaleCode: "BG",
      verifyEmailAction: "Go to email verification",
      required: "Required field",
    },
    login: {
      eyebrow: "Secure access",
      title: "Sign in to VAX",
      description: "Enter the protected customer and staff application.",
      submit: "Sign in",
      forgot: "Forgot your password?",
      alternateLead: "No account yet?",
      alternateLink: "Create a customer account",
    },
    signup: {
      eyebrow: "Customer account",
      title: "Create an account",
      description: "Registration creates customer access only. Property and service details come later.",
      submit: "Create account",
      terms: "I acknowledge the hooks for the future terms and privacy policy.",
      alternateLead: "Already have an account?",
      alternateLink: "Sign in",
    },
    forgot: {
      eyebrow: "Account recovery",
      title: "Forgotten password",
      description: "Enter your email. The response is the same whether or not an account exists.",
      submit: "Send recovery instructions",
      alternateLink: "Back to sign in",
    },
    reset: {
      eyebrow: "New password",
      title: "Reset your password",
      description: "Set a new password through the identity provider's protected recovery link.",
      submit: "Save new password",
      missingToken: "The recovery link is missing or invalid. Request a new one.",
      alternateLink: "Request another link",
    },
    verify: {
      eyebrow: "Verification",
      title: "Verify your email",
      description: "Enter the six-digit code from the message or request a new one. Do not share the code with anyone.",
      otp: "Verification code",
      submit: "Verify email",
      resend: "Send another code",
      alternateLink: "Back to sign in",
    },
  },
} as const satisfies Record<AuthLocale, Record<string, unknown>>;

export function localizedAuthPath(locale: AuthLocale, path: string): string {
  return locale === "en" ? `/en${path}` : path;
}

export function getAuthLocaleSwitchHref(
  locale: AuthLocale,
  kind: AuthPageKind,
  resetToken?: string,
): string | null {
  if (kind === "reset-password" && resetToken) {
    return null;
  }
  const alternateLocale = locale === "bg" ? "en" : "bg";
  return localizedAuthPath(alternateLocale, `/${kind}`);
}
