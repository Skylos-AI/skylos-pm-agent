"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearCompanyError } from "@/lib/mutations/wa";

export function WaClearErrorButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function clear() {
    setError(null);
    startTransition(async () => {
      const res = await clearCompanyError({ id: companyId });
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
        onClick={clear}
        disabled={pending}
        className="text-xs px-2 py-1 rounded-md border border-[var(--brand-border)] text-[var(--brand-fg-muted)] hover:text-[var(--brand-blue)] hover:border-[var(--brand-blue)] disabled:opacity-50"
      >
        {pending ? "…" : "Limpiar error"}
      </button>
      {error && <span className="text-xs text-[var(--brand-magenta)]">{error}</span>}
    </span>
  );
}
