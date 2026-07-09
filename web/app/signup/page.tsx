"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { signUp, type SignupResult } from "./actions";
import { t } from "@/lib/i18n/es";

export default function SignupPage() {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "sending" }
    | { status: "result"; result: SignupResult }
  >({ status: "idle" });

  async function onSubmit(form: FormData) {
    setState({ status: "sending" });
    const result = await signUp(form);
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
        <h1 className="font-display text-3xl mb-2 tracking-tight">
          {t.signup.title}
        </h1>
        <p className="text-[var(--brand-fg-muted)] text-sm mb-8">
          {t.signup.subtitle}
        </p>

        <form action={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              {t.signup.emailLabel}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder={t.signup.emailPlaceholder}
              className="w-full px-4 py-3 rounded-lg border border-[var(--brand-border)] bg-white text-[var(--brand-fg)] placeholder:text-[var(--brand-fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              {t.signup.passwordLabel}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder={t.signup.passwordPlaceholder}
              className="w-full px-4 py-3 rounded-lg border border-[var(--brand-border)] bg-white text-[var(--brand-fg)] placeholder:text-[var(--brand-fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium mb-2">
              {t.signup.confirmLabel}
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder={t.signup.passwordPlaceholder}
              className="w-full px-4 py-3 rounded-lg border border-[var(--brand-border)] bg-white text-[var(--brand-fg)] placeholder:text-[var(--brand-fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition"
            />
          </div>

          <button
            type="submit"
            disabled={state.status === "sending"}
            className="w-full py-3 rounded-lg font-medium text-white brand-gradient hover:opacity-90 disabled:opacity-60 transition shadow-sm"
          >
            {state.status === "sending" ? t.signup.sending : t.signup.submit}
          </button>
        </form>

        {state.status === "result" && state.result.ok && (
          <p className="mt-6 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            {t.signup.success}
            <br />
            <span className="text-[var(--brand-fg-muted)]">
              {state.result.email}
            </span>
          </p>
        )}
        {state.status === "result" && !state.result.ok && (
          <p className="mt-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {state.result.message}
          </p>
        )}

        <p className="mt-8 text-sm text-[var(--brand-fg-muted)] text-center">
          {t.signup.haveAccount}{" "}
          <Link href="/login" className="text-[var(--brand-blue)] hover:underline font-medium">
            {t.signup.loginLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
