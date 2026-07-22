import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getWaOverview } from "@/lib/data/wa";
import { formatRelative } from "@/lib/format/date";
import { WaKillSwitch } from "@/components/pm/wa-kill-switch";
import { WaApprovalCard } from "@/components/pm/wa-approval-card";
import { WaClearErrorButton } from "@/components/pm/wa-clear-error-button";

export default async function WaPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const o = await getWaOverview();

  return (
    <div className="min-h-screen p-8 lg:p-10 space-y-6 max-w-6xl">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <h1 className="font-display text-5xl tracking-tight leading-tight">
              WhatsApp automático
            </h1>
            <p className="text-sm text-[var(--brand-fg-muted)] max-w-2xl">
              Secuencias de outreach por WhatsApp: aprobaciones de primer toque,
              cola de envíos y respuestas recientes.{" "}
              <Link href="/wa/templates" className="text-[var(--brand-blue)] hover:underline">
                Gestionar templates →
              </Link>
            </p>
          </div>
          <WaKillSwitch enabled={o.enabled} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="Aprobaciones pendientes"
          count={o.approvals.length}
          countLabel="por revisar"
        >
          {o.approvals.length === 0 ? (
            <Empty text="Nada por aprobar." />
          ) : (
            <ul className="divide-y divide-[var(--brand-border)]">
              {o.approvals.map((a) => (
                <WaApprovalCard key={a.id} approval={a} />
              ))}
            </ul>
          )}
        </Card>

        <Card title="Próximos envíos" count={o.due.length} countLabel="en cola">
          {o.due.length === 0 ? (
            <Empty text="Ninguna secuencia programada." />
          ) : (
            <ul className="divide-y divide-[var(--brand-border)]">
              {o.due.map((c) => (
                <li key={c.id} className="py-3 flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/companies/${c.id}`}
                      className="text-sm font-medium hover:text-[var(--brand-blue)] truncate block"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-[var(--brand-fg-muted)]">
                      {c.next_action} · toque #{c.sequence_position + 1}
                      {!c.wa_jid && (
                        <span className="text-[var(--brand-magenta)]"> · sin wa_jid</span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--brand-fg-muted)] shrink-0">
                    {c.next_action_at ? formatRelative(c.next_action_at) : "esperando aprobación"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Errores de secuencia"
          count={o.errored.length}
          countLabel="bloqueadas"
        >
          {o.errored.length === 0 ? (
            <Empty text="Sin errores." />
          ) : (
            <ul className="divide-y divide-[var(--brand-border)]">
              {o.errored.map((c) => (
                <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/companies/${c.id}`}
                      className="text-sm font-medium hover:text-[var(--brand-blue)] truncate block"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-[var(--brand-magenta)]">{c.next_action}</p>
                  </div>
                  <WaClearErrorButton companyId={c.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Actividad reciente"
          count={o.recentSends.length + o.recentInbound.length}
          countLabel="últimos movimientos"
        >
          {o.recentSends.length === 0 && o.recentInbound.length === 0 ? (
            <Empty text="Todavía no hay envíos ni respuestas." />
          ) : (
            <ul className="divide-y divide-[var(--brand-border)]">
              {o.recentInbound.map((m) => (
                <li key={m.wa_message_id} className="py-3">
                  <p className="text-sm">
                    <span className="text-[var(--brand-cyan)] font-medium">← respuesta</span>{" "}
                    {m.company_name ?? m.jid}
                  </p>
                  <p className="text-xs text-[var(--brand-fg-muted)] truncate">
                    {m.text ?? "(sin texto)"} · {formatRelative(m.received_at)}
                  </p>
                </li>
              ))}
              {o.recentSends.map((s) => (
                <li key={s.id} className="py-3">
                  <p className="text-sm">
                    <span className="text-[var(--brand-blue)] font-medium">→ enviado</span>{" "}
                    {s.companies?.name ?? "?"}
                  </p>
                  <p className="text-xs text-[var(--brand-fg-muted)]">
                    {s.template_id} · {formatRelative(s.sent_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  count,
  countLabel,
  children,
}: {
  title: string;
  count: number;
  countLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-5 [box-shadow:var(--shadow-card)]">
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="font-display text-lg tracking-tight">{title}</h2>
        <span className="text-xs text-[var(--brand-fg-muted)]">
          {count} {countLabel}
        </span>
      </header>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-[var(--brand-fg-muted)] italic py-3">{text}</p>;
}
