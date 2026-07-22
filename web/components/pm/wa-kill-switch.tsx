"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOutreachEnabled } from "@/lib/mutations/wa";

export function WaKillSwitch({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await setOutreachEnabled({ enabled: !enabled });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`px-4 py-2 text-sm rounded-md font-medium transition disabled:opacity-50 ${
          enabled
            ? "bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)] border border-[var(--brand-magenta)]/40 hover:bg-[var(--brand-magenta)]/20"
            : "bg-[var(--brand-blue)] text-white hover:opacity-90"
        }`}
      >
        {pending ? "…" : enabled ? "Detener envíos automáticos" : "Activar envíos automáticos"}
      </button>
      <span
        className={`text-xs px-2 py-1 rounded-full ${
          enabled
            ? "bg-[var(--brand-cyan)]/15 text-[var(--brand-cyan)]"
            : "bg-[var(--brand-border)] text-[var(--brand-fg-muted)]"
        }`}
      >
        {enabled ? "ACTIVO" : "APAGADO"}
      </span>
      {error && <p className="text-xs text-[var(--brand-magenta)]">{error}</p>}
    </div>
  );
}
