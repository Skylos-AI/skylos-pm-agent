import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getOutreachQueue, type OutreachRow } from "@/lib/data/outreach";
import { formatDate, formatRelative } from "@/lib/format/date";
import { t } from "@/lib/i18n/es";

type Bucket = "PRESENCIAL" | "EMAIL" | "PHONE" | "OTHER";

function bucketOf(row: OutreachRow): Bucket {
  switch (row.preferred_channel) {
    case "IN_PERSON":
      return "PRESENCIAL";
    case "EMAIL":
      return "EMAIL";
    case "PHONE":
    case "WHATSAPP":
      return "PHONE";
    default:
      return "OTHER";
  }
}

const BUCKET_LABEL: Record<Bucket, string> = {
  PRESENCIAL: t.outreach.tabPresencial,
  EMAIL: t.outreach.tabEmail,
  PHONE: t.outreach.tabPhone,
  OTHER: t.outreach.tabOther,
};

export default async function OutreachPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const rows = await getOutreachQueue();
  const grouped: Record<Bucket, OutreachRow[]> = {
    PRESENCIAL: [],
    EMAIL: [],
    PHONE: [],
    OTHER: [],
  };
  for (const r of rows) grouped[bucketOf(r)].push(r);

  return (
    <div className="min-h-screen p-8 lg:p-10 space-y-6 max-w-6xl">
      <header className="space-y-2">
        <h1 className="font-display text-5xl tracking-tight leading-tight">
          {t.outreach.title}
        </h1>
        <p className="text-sm text-[var(--brand-fg-muted)] max-w-2xl">
          {t.outreach.subtitle}
        </p>
        <p className="text-xs text-[var(--brand-fg-muted)]">
          {rows.length === 0
            ? "Ninguna empresa con seguimiento programado para hoy."
            : `${rows.length} empresa${rows.length === 1 ? "" : "s"} para chasear hoy.`}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(Object.keys(grouped) as Bucket[]).map((bucket) => (
          <BucketCard
            key={bucket}
            title={BUCKET_LABEL[bucket]}
            rows={grouped[bucket]}
          />
        ))}
      </div>
    </div>
  );
}

function BucketCard({ title, rows }: { title: string; rows: OutreachRow[] }) {
  return (
    <section className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-5 shadow-sm">
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="font-display text-lg tracking-tight">{title}</h2>
        <span className="text-xs text-[var(--brand-fg-muted)]">
          {rows.length} pendiente{rows.length === 1 ? "" : "s"}
        </span>
      </header>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--brand-fg-muted)] italic py-3">
          {t.outreach.empty}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--brand-border)]">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/companies/${r.id}`}
                    className="text-sm font-medium hover:text-[var(--brand-blue)] truncate block"
                  >
                    {r.name}
                  </Link>
                  <p className="text-xs text-[var(--brand-fg-muted)] mt-0.5">
                    {r.city ?? r.department ?? "—"}
                    {r.last_touch
                      ? ` · último toque ${formatRelative(r.last_touch.occurred_at)} (${r.last_touch.type})`
                      : ` · ${t.outreach.noLastTouch}`}
                  </p>
                </div>
                <div className="text-right shrink-0 text-xs text-[var(--brand-fg-muted)]">
                  <div>{formatDate(r.next_touch_at)}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
