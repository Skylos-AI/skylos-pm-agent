"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { sendMagicLink, type LoginResult } from "./actions";
import { t } from "@/lib/i18n/es";

const ERROR_MESSAGES: Record<string, string> = {
  exchange_failed:
    "El enlace no pudo validarse. Abrí el enlace en el mismo navegador donde solicitaste el código.",
  verify_failed: "El enlace no pudo validarse o ya expiró. Probá pedir uno nuevo.",
  access_denied:
    "El enlace expiró. Pedí un nuevo enlace y abrilo dentro de los 60 segundos.",
  otp_expired:
    "El enlace expiró. Pedí un nuevo enlace y abrilo dentro de los 60 segundos.",
  not_allowed: "Ese correo no está en el equipo de Skylos.",
  missing_code: "El enlace está incompleto. Pedí otro nuevo.",
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const urlDetail = searchParams.get("detail");

  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "sending" }
    | { status: "result"; result: LoginResult }
  >({ status: "idle" });

  useEffect(() => {
    if (urlError) {
      const message =
        ERROR_MESSAGES[urlError] ??
        `Error: ${urlError}${urlDetail ? ` (${urlDetail})` : ""}`;
      setState({
        status: "result",
        result: { ok: false, code: "SEND_FAILED", message },
      });
    }
  }, [urlError, urlDetail]);

  async function onSubmit(form: FormData) {
    setState({ status: "sending" });
    const result = await sendMagicLink(form);
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

          <button
            type="submit"
            disabled={state.status === "sending"}
            className="w-full py-3 rounded-lg font-medium text-white brand-gradient hover:opacity-90 disabled:opacity-60 transition shadow-sm"
          >
            {state.status === "sending" ? t.login.sending : t.login.submit}
          </button>
        </form>

        {state.status === "result" && state.result.ok && (
          <p className="mt-6 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            {t.login.sent}
            <br />
            <span className="text-[var(--brand-fg-muted)]">
              {state.result.sentTo}
            </span>
          </p>
        )}
        {state.status === "result" && !state.result.ok && (
          <p className="mt-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {state.result.message}
          </p>
        )}
      </div>
    </div>
  );
}
