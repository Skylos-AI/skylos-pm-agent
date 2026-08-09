"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/pm/modal";
import { createCompanyLead } from "@/lib/mutations/companies";

export function AddLeadDialog({ cities }: { cities: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [cityMode, setCityMode] = useState<"pick" | "new">(
    cities.length > 0 ? "pick" : "new",
  );

  function reset() {
    setName("");
    setPhone("");
    setEmail("");
    setCity("");
    setCityMode(cities.length > 0 ? "pick" : "new");
    setError(null);
  }

  function close() {
    if (pending) return;
    setOpen(false);
    reset();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError("Ingresá al menos un teléfono o un email.");
      return;
    }
    startTransition(async () => {
      const res = await createCompanyLead({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        city: city.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  const inputCls =
    "mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2 bg-white focus:outline-none focus:border-[var(--brand-blue)]";
  const labelCls =
    "text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm rounded-md bg-[var(--brand-blue)] text-white hover:opacity-90"
      >
        + Nuevo lead
      </button>
      <Modal open={open} onClose={close} title="Nuevo lead">
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className={labelCls}>
              Nombre de la empresa <span className="text-red-500">*</span>
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Constructora del Valle S.R.L."
              className={inputCls}
              maxLength={200}
            />
          </label>

          <p className="text-xs text-[var(--brand-fg-muted)] pt-1">
            Ingresá al menos un canal de contacto:
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Teléfono / WhatsApp</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="4123456 o +59171234567"
                className={inputCls}
                maxLength={40}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@empresa.com"
                className={inputCls}
                maxLength={200}
              />
            </label>
          </div>

          <div>
            <span className={labelCls}>Ciudad (opcional)</span>
            {cities.length > 0 && (
              <div className="flex gap-3 mt-1 mb-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setCityMode("pick");
                    setCity("");
                  }}
                  className={
                    cityMode === "pick"
                      ? "text-[var(--brand-blue)] underline"
                      : "text-[var(--brand-fg-muted)] hover:text-[var(--brand-fg)]"
                  }
                >
                  Elegir existente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCityMode("new");
                    setCity("");
                  }}
                  className={
                    cityMode === "new"
                      ? "text-[var(--brand-blue)] underline"
                      : "text-[var(--brand-fg-muted)] hover:text-[var(--brand-fg)]"
                  }
                >
                  Escribir nueva
                </button>
              </div>
            )}
            {cityMode === "pick" && cities.length > 0 ? (
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputCls}
              >
                <option value="">— sin ciudad —</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ej. Santa Cruz"
                className={inputCls}
                maxLength={80}
              />
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="px-4 py-2 text-sm rounded-md border border-[var(--brand-border)] text-[var(--brand-fg-muted)] hover:text-[var(--brand-fg)] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 text-sm rounded-md bg-[var(--brand-blue)] text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Crear lead"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
