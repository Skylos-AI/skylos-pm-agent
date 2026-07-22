"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewApproval } from "@/lib/mutations/wa";
import { formatRelative } from "@/lib/format/date";
import type { WaApproval } from "@/lib/data/wa";

export function WaApprovalCard({ approval }: { approval: WaApproval }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(decision: "APPROVED" | "REJECTED") {
    setError(null);
    startTransition(async () => {
      const res = await reviewApproval({ id: approval.id, decision });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="py-4 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {approval.companies?.name ?? approval.company_id}
          </p>
          <p className="text-xs text-[var(--brand-fg-muted)]">
            {approval.template_id}
            {approval.companies?.sector ? ` · ${approval.companies.sector}` : ""}
            {" · "}
            {formatRelative(approval.created_at)}
            {!approval.companies?.wa_jid && (
              <span className="text-[var(--brand-magenta)]"> · sin wa_jid — no se podrá enviar</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => decide("REJECTED")}
            disabled={pending}
            className="text-xs px-3 py-1.5 rounded-md border border-[var(--brand-border)] text-[var(--brand-fg-muted)] hover:text-[var(--brand-magenta)] hover:border-[var(--brand-magenta)] disabled:opacity-50"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => decide("APPROVED")}
            disabled={pending}
            className="text-xs px-3 py-1.5 rounded-md bg-[var(--brand-blue)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "…" : "Aprobar y enviar"}
          </button>
        </div>
      </div>
      <blockquote className="text-sm whitespace-pre-wrap bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-lg px-3 py-2">
        {approval.rendered_body}
      </blockquote>
      {error && <p className="text-xs text-[var(--brand-magenta)]">{error}</p>}
    </li>
  );
}
