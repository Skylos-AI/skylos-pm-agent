"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { requestPasswordReset, type ForgotResult } from "./actions";
import { t } from "@/lib/i18n/es";

export default function ForgotPasswordPage() {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "sending" }
    | { status: "result"; result: ForgotResult }
  >({ status: "idle" });

  async function onSubmit(form: FormData) {
    setState({ status: "sending" });
    const result = await requestPasswordReset(form);
    setState({ status: "result", result });
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

      <div className="w-full max-w-md bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-10 shadow-sm">
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
        {state.status === "result" && state.result.ok ? (
          <>
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-50 border border-green-200 mb-6 mx-auto">
              <svg
                className="w-7 h-7 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.5 5.25a3 3 0 003 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="font-display text-3xl mb-3 tracking-tight text-center">
              {t.forgotPassword.sentTitle}
            </h1>
            <p className="text-[var(--brand-fg-muted)] text-sm text-center mb-2">
              {t.forgotPassword.sentBody}
            </p>
            <p className="text-[var(--brand-fg)] font-medium text-center mb-6 break-all">
              {state.result.sentTo}
            </p>
            <p className="text-[var(--brand-fg-muted)] text-xs text-center bg-[var(--brand-surface-alt,#f7f7fb)] border border-[var(--brand-border)] rounded-lg px-4 py-3 mb-6">
              {t.forgotPassword.sentSpamHint}
            </p>
            <button
              type="button"
              onClick={() => setState({ status: "idle" })}
              className="w-full py-3 rounded-lg font-medium text-[var(--brand-blue)] border border-[var(--brand-border)] hover:bg-[var(--brand-surface-alt,#f7f7fb)] transition"
            >
              {t.forgotPassword.sentTryAnother}
            </button>
            <p className="mt-6 text-sm text-[var(--brand-fg-muted)] text-center">
              <Link href="/login" className="text-[var(--brand-blue)] hover:underline font-medium">
                {t.forgotPassword.backToLogin}
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl mb-2 tracking-tight">
              {t.forgotPassword.title}
            </h1>
            <p className="text-[var(--brand-fg-muted)] text-sm mb-8">
              {t.forgotPassword.subtitle}
            </p>

            <form action={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  {t.forgotPassword.emailLabel}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={t.forgotPassword.emailPlaceholder}
                  className="w-full px-4 py-3 rounded-lg border border-[var(--brand-border)] bg-white text-[var(--brand-fg)] placeholder:text-[var(--brand-fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition"
                />
              </div>

              <button
                type="submit"
                disabled={state.status === "sending"}
                className="w-full py-3 rounded-lg font-medium text-white brand-gradient hover:opacity-90 disabled:opacity-60 transition shadow-sm"
              >
                {state.status === "sending"
                  ? t.forgotPassword.sending
                  : t.forgotPassword.submit}
              </button>
            </form>

            {state.status === "result" && !state.result.ok && (
              <p className="mt-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {state.result.message}
              </p>
            )}

            <p className="mt-8 text-sm text-[var(--brand-fg-muted)] text-center">
              <Link href="/login" className="text-[var(--brand-blue)] hover:underline font-medium">
                {t.forgotPassword.backToLogin}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
