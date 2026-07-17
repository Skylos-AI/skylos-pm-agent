"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { signInWithPassword, type LoginResult } from "./actions";
import { t } from "@/lib/i18n/es";

const ERROR_MESSAGES: Record<string, string> = {
  exchange_failed:
    "El enlace no pudo validarse. Abrí el enlace en el mismo navegador donde solicitaste el código.",
  verify_failed: "El enlace no pudo validarse o ya expiró. Probá pedir uno nuevo.",
  access_denied: "El enlace expiró. Pedí uno nuevo.",
  otp_expired: "El enlace expiró. Pedí uno nuevo.",
  not_allowed: "Ese correo no está en el equipo de Skylos.",
  missing_code: "El enlace está incompleto. Pedí otro nuevo.",
  email_confirmed: "Tu correo fue confirmado. Iniciá sesión abajo.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  email_confirmed: "Tu correo fue confirmado. Iniciá sesión abajo.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const urlDetail = searchParams.get("detail");
  const urlNotice = searchParams.get("notice");

  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "sending" }
    | { status: "error"; result: LoginResult }
    | { status: "notice"; message: string }
  >({ status: "idle" });

  useEffect(() => {
    if (urlError) {
      const message =
        ERROR_MESSAGES[urlError] ??
        `Error: ${urlError}${urlDetail ? ` (${urlDetail})` : ""}`;
      setState({
        status: "error",
        result: { ok: false, code: "SIGN_IN_FAILED", message },
      });
      return;
    }
    if (urlNotice && SUCCESS_MESSAGES[urlNotice]) {
      setState({ status: "notice", message: SUCCESS_MESSAGES[urlNotice] });
    }
  }, [urlError, urlDetail, urlNotice]);

  async function onSubmit(form: FormData) {
    setState({ status: "sending" });
    const result = await signInWithPassword(form);
    setState({ status: "error", result });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-[0.06] brand-gradient"
        aria-hidden
      />
      <div className="absolute -top-20 -right-20 w-[480px] h-[480px] -z-10 opacity-70 pointer-events-none">
        <Image
          src="/crystals/crystal-octahedron-blue.png"
          alt=""
          fill
          sizes="480px"
          priority
          style={{ objectFit: "contain" }}
        />
      </div>
      <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] -z-10 opacity-60 pointer-events-none">
        <Image
          src="/crystals/crystal-prism-blue.png"
          alt=""
          fill
          sizes="420px"
          style={{ objectFit: "contain" }}
        />
      </div>

      <div className="w-full max-w-md bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-10 [box-shadow:var(--shadow-card)]">
        <div className="flex items-center gap-3 mb-8">
          <Image
            src="/logo-skylos.svg"
            alt="Skylos"
            width={120}
            height={28}
            style={{ height: "auto" }}
            priority
          />
        </div>
        <h1 className="font-display text-3xl mb-2 tracking-tight">
          {t.login.title}
        </h1>
        <p className="text-[var(--brand-fg-muted)] text-sm mb-8">
          {t.login.subtitle}
        </p>

        <form action={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-2"
            >
              {t.login.emailLabel}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder={t.login.emailPlaceholder}
              className="w-full px-4 py-3 rounded-lg border border-[var(--brand-border)] bg-white text-[var(--brand-fg)] placeholder:text-[var(--brand-fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="block text-sm font-medium">
                {t.login.passwordLabel}
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[var(--brand-blue)] hover:underline"
              >
                {t.login.forgotPassword}
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder={t.login.passwordPlaceholder}
              className="w-full px-4 py-3 rounded-lg border border-[var(--brand-border)] bg-white text-[var(--brand-fg)] placeholder:text-[var(--brand-fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition"
            />
          </div>

          <button
            type="submit"
            disabled={state.status === "sending"}
            className="w-full py-3 rounded-lg font-medium text-white brand-gradient hover:opacity-90 disabled:opacity-60 transition shadow-sm"
          >
            {state.status === "sending" ? t.login.sending : t.login.submit}
          </button>
        </form>

        {state.status === "notice" && (
          <p className="mt-6 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            {state.message}
          </p>
        )}
        {state.status === "error" && !state.result.ok && (
          <p className="mt-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {state.result.message}
          </p>
        )}

        <p className="mt-8 text-sm text-[var(--brand-fg-muted)] text-center">
          {t.login.noAccount}{" "}
          <Link href="/signup" className="text-[var(--brand-blue)] hover:underline font-medium">
            {t.login.signupLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
