"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n/es";
import { logActivity } from "@/lib/mutations/activities";

export function MarkContactedButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await logActivity({
        companyId,
        type: "MESSAGE_SENT",
        channel: "WHATSAPP",
        description: "Primer contacto enviado por WhatsApp.",
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setDone(true);
      setTimeout(() => setDone(false), 1800);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={submit}
      disabled={pending}
      title={t.companies.markContactedHint}
      className={`text-xs px-2 py-1 rounded-md transition ${
        done
          ? "bg-[var(--brand-cyan)]/15 text-[var(--brand-cyan)]"
          : "border border-[var(--brand-border)] text-[var(--brand-fg-muted)] hover:text-[var(--brand-blue)] hover:border-[var(--brand-blue)]"
      } disabled:opacity-50`}
    >
      {done
        ? t.companies.markedContactedToast
        : pending
          ? "…"
          : t.companies.markContacted}
      {error && <span className="ml-1 text-[var(--brand-magenta)]">!</span>}
    </button>
  );
}
