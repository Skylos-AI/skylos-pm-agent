"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTemplateActive } from "@/lib/mutations/wa";

export function WaTemplateActiveToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await setTemplateActive({ id, active: !active });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`text-xs px-2 py-1 rounded-md border transition disabled:opacity-50 ${
          active
            ? "border-[var(--brand-cyan)]/50 text-[var(--brand-cyan)]"
            : "border-[var(--brand-border)] text-[var(--brand-fg-muted)]"
        }`}
      >
        {pending ? "…" : active ? "Activo" : "Inactivo"}
      </button>
      {error && <span className="text-xs text-[var(--brand-magenta)]">{error}</span>}
    </span>
  );
}
