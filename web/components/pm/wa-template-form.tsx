"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/pm/modal";
import { upsertTemplate } from "@/lib/mutations/wa";
import type { WaTemplate } from "@/lib/data/wa";

const STAGES = ["LEAD", "PROSPECT", "ACTIVE_CLIENT", "PAST_CLIENT", "DISQUALIFIED"] as const;
const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"]; // 1=Lun .. 7=Dom

type Props = {
  template?: WaTemplate; // absent = create
  allTemplateIds: string[];
};

export function WaTemplateForm({ template, allTemplateIds }: Props) {
  const router = useRouter();
  const isNew = !template;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [id, setId] = useState(template?.id ?? "");
  const [stageTrigger, setStageTrigger] = useState<(typeof STAGES)[number]>(
    (template?.stage_trigger as (typeof STAGES)[number]) ?? "LEAD",
  );
  const [vertical, setVertical] = useState(template?.vertical ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [variables, setVariables] = useState(
    (template?.variables_required ?? []).join(", "),
  );
  const [delayHours, setDelayHours] = useState(String(template?.send_delay_hours ?? 0));
  const [useWindow, setUseWindow] = useState(!!template?.send_window);
  const [days, setDays] = useState<number[]>(template?.send_window?.days ?? [1, 2, 3, 4, 5]);
  const [start, setStart] = useState(template?.send_window?.start ?? "09:00");
  const [end, setEnd] = useState(template?.send_window?.end ?? "18:00");
  const [nextTemplateId, setNextTemplateId] = useState(template?.next_template_id ?? "");
  const [active, setActive] = useState(template?.active ?? true);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await upsertTemplate({
        id,
        channel: "WHATSAPP",
        stageTrigger,
        vertical: vertical.trim() || null,
        body,
        variablesRequired: variables
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        sendDelayHours: Number(delayHours) || 0,
        sendWindow: useWindow ? { days, start, end } : null,
        nextTemplateId: nextTemplateId || null,
        active,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const inputCls =
    "mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2";
  const labelCls = "text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          isNew
            ? "px-4 py-2 text-sm rounded-md bg-[var(--brand-blue)] text-white hover:opacity-90"
            : "text-xs px-2 py-1 rounded-md border border-[var(--brand-border)] text-[var(--brand-fg-muted)] hover:text-[var(--brand-blue)] hover:border-[var(--brand-blue)]"
        }
      >
        {isNew ? "Nuevo template" : "Editar"}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isNew ? "Nuevo template de WhatsApp" : `Editar ${template!.id}`}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Id (slug)</span>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                disabled={!isNew}
                placeholder="wa_touch1_construccion"
                className={`${inputCls} disabled:opacity-60`}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Etapa trigger</span>
              <select
                value={stageTrigger}
                onChange={(e) => setStageTrigger(e.target.value as (typeof STAGES)[number])}
                className={`${inputCls} bg-white`}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Vertical (opcional)</span>
              <input
                value={vertical}
                onChange={(e) => setVertical(e.target.value)}
                placeholder="construccion"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Delay desde toque anterior (horas)</span>
              <input
                type="number"
                min={0}
                value={delayHours}
                onChange={(e) => setDelayHours(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>

          <label className="block">
            <span className={labelCls}>Cuerpo — usa {"{{variable}}"}</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder={"Hola {{nombre}}, soy Jhonny de Skylos…"}
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className={labelCls}>
              Variables requeridas (separadas por coma: empresa, sector, ciudad, contacto, nombre)
            </span>
            <input
              value={variables}
              onChange={(e) => setVariables(e.target.value)}
              placeholder="nombre, empresa"
              className={inputCls}
            />
          </label>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useWindow}
                onChange={(e) => setUseWindow(e.target.checked)}
              />
              Restringir a ventana de envío (hora de La Paz)
            </label>
            {useWindow && (
              <div className="flex flex-wrap items-center gap-3 pl-6">
                <div className="flex gap-1">
                  {DAY_LABELS.map((label, i) => {
                    const d = i + 1;
                    const on = days.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        className={`w-7 h-7 text-xs rounded-md border transition ${
                          on
                            ? "bg-[var(--brand-blue)] text-white border-[var(--brand-blue)]"
                            : "border-[var(--brand-border)] text-[var(--brand-fg-muted)]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5"
                />
                <span className="text-xs text-[var(--brand-fg-muted)]">a</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Siguiente template (cadena)</span>
              <select
                value={nextTemplateId}
                onChange={(e) => setNextTemplateId(e.target.value)}
                className={`${inputCls} bg-white`}
              >
                <option value="">— fin de secuencia —</option>
                {allTemplateIds
                  .filter((t) => t !== id)
                  .map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
              </select>
            </label>
            <label className="flex items-end gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Activo
            </label>
          </div>

          {error && <p className="text-sm text-[var(--brand-magenta)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-[var(--brand-border)] hover:bg-[var(--brand-bg)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending || !id || !body}
              className="px-4 py-2 text-sm rounded-md bg-[var(--brand-blue)] text-white disabled:opacity-50"
            >
              {pending ? "…" : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
