"use client";

import { useState } from "react";
import { setNewPassword, type ResetResult } from "./actions";
import { t } from "@/lib/i18n/es";

export function ResetPasswordForm() {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "saving" }
    | { status: "error"; result: ResetResult }
  >({ status: "idle" });

  async function onSubmit(form: FormData) {
    setState({ status: "saving" });
    const result = await setNewPassword(form);
    setState({ status: "error", result });
  }

  return (
    <>
      <form action={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            {t.resetPassword.passwordLabel}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={t.resetPassword.passwordPlaceholder}
            className="w-full px-4 py-3 rounded-lg border border-[var(--brand-border)] bg-white text-[var(--brand-fg)] placeholder:text-[var(--brand-fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium mb-2">
            {t.resetPassword.confirmLabel}
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={t.resetPassword.passwordPlaceholder}
            className="w-full px-4 py-3 rounded-lg border border-[var(--brand-border)] bg-white text-[var(--brand-fg)] placeholder:text-[var(--brand-fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition"
          />
        </div>

        <button
          type="submit"
          disabled={state.status === "saving"}
          className="w-full py-3 rounded-lg font-medium text-white brand-gradient hover:opacity-90 disabled:opacity-60 transition shadow-sm"
        >
          {state.status === "saving" ? t.resetPassword.saving : t.resetPassword.submit}
        </button>
      </form>

      {state.status === "error" && !state.result.ok && (
        <p className="mt-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {state.result.message}
        </p>
      )}
    </>
  );
}
