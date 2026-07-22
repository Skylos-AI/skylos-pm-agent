import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getWaTemplates } from "@/lib/data/wa";
import { WaTemplateForm } from "@/components/pm/wa-template-form";
import { WaTemplateActiveToggle } from "@/components/pm/wa-template-active-toggle";

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

export default async function WaTemplatesPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const templates = await getWaTemplates();
  const ids = templates.map((t) => t.id);

  return (
    <div className="min-h-screen p-8 lg:p-10 space-y-6 max-w-6xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="font-display text-5xl tracking-tight leading-tight">
            Templates de WhatsApp
          </h1>
          <p className="text-sm text-[var(--brand-fg-muted)] max-w-2xl">
            Cada secuencia es una cadena: un template apunta al siguiente con su
            delay. El primer toque de cada empresa siempre pasa por aprobación.{" "}
            <Link href="/wa" className="text-[var(--brand-blue)] hover:underline">
              ← Volver a WhatsApp automático
            </Link>
          </p>
        </div>
        <WaTemplateForm allTemplateIds={ids} />
      </header>

      {templates.length === 0 ? (
        <section className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-8 text-center">
          <p className="text-sm text-[var(--brand-fg-muted)]">
            Sin templates todavía. Creá el primero — por ejemplo{" "}
            <code className="text-xs">wa_touch1_general</code> con trigger LEAD, y
            encadenale un bump con 72h de delay.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {templates.map((t) => (
            <section
              key={t.id}
              className={`bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-5 [box-shadow:var(--shadow-card)] ${
                t.active ? "" : "opacity-60"
              }`}
            >
              <header className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h2 className="font-display text-lg tracking-tight">{t.id}</h2>
                  <span className="text-xs text-[var(--brand-fg-muted)]">
                    trigger {t.stage_trigger}
                    {t.vertical ? ` · ${t.vertical}` : " · cualquier vertical"}
                    {" · "}delay {t.send_delay_hours}h
                    {t.send_window
                      ? ` · ${(t.send_window.days ?? []).map((d) => DAY_LABELS[d - 1]).join("")} ${t.send_window.start}–${t.send_window.end}`
                      : " · sin ventana"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <WaTemplateActiveToggle id={t.id} active={t.active} />
                  <WaTemplateForm template={t} allTemplateIds={ids} />
                </div>
              </header>
              <p className="text-sm whitespace-pre-wrap bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-lg px-3 py-2">
                {t.body}
              </p>
              <p className="text-xs text-[var(--brand-fg-muted)] mt-2">
                {t.variables_required.length
                  ? `Variables: ${t.variables_required.join(", ")}`
                  : "Sin variables"}
                {" · "}
                {t.next_template_id
                  ? `sigue → ${t.next_template_id}`
                  : "fin de secuencia"}
              </p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
