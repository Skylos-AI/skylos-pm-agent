"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/pm/modal";
import { t } from "@/lib/i18n/es";
import { updateCompanyStatus } from "@/lib/mutations/companies";
import { createProject } from "@/lib/mutations/projects";
import type { CompanyStatus } from "@/lib/types/companies";

const SERVICES = [
  "AI_AUDIT",
  "AUTOMATION",
  "CUSTOM_SOFTWARE",
  "BLOCKCHAIN_WEB3",
  "TRAINING",
  "RETAINER",
] as const;

export function ConvertToClientButton({
  companyId,
  currentStatus,
}: {
  companyId: string;
  currentStatus: CompanyStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (currentStatus !== "LEAD" && currentStatus !== "PROSPECT") return null;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await updateCompanyStatus({
        id: companyId,
        status: "ACTIVE_CLIENT",
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm px-3 py-1.5 rounded-md bg-[var(--brand-cyan)] text-white hover:opacity-90"
      >
        ↗ {t.companies.convertToClient}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t.companies.convertToClient}
      >
        <p className="text-sm text-[var(--brand-fg-muted)] mb-4">
          {t.companies.convertConfirm}
        </p>
        {error && <p className="text-sm text-[var(--brand-magenta)] mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 text-sm rounded-md border border-[var(--brand-border)] hover:bg-[var(--brand-bg)]"
          >
            {t.pipeline.cancel}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="px-4 py-2 text-sm rounded-md bg-[var(--brand-cyan)] text-white disabled:opacity-50"
          >
            {pending ? "…" : t.pipeline.confirm}
          </button>
        </div>
      </Modal>
    </>
  );
}

export function NewProjectButton({
  companyId,
  currentStatus,
}: {
  companyId: string;
  currentStatus: CompanyStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [serviceType, setServiceType] =
    useState<(typeof SERVICES)[number]>("AI_AUDIT");
  const [valueBob, setValueBob] = useState("");
  const [targetEnd, setTargetEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (currentStatus !== "ACTIVE_CLIENT") return null;

  function submit() {
    setError(null);
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    startTransition(async () => {
      const res = await createProject({
        companyId,
        name: name.trim(),
        serviceType,
        valueBob: valueBob ? Number(valueBob) : undefined,
        targetEndDate: targetEnd || null,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setOpen(false);
      setName("");
      setValueBob("");
      setTargetEnd("");
      setServiceType("AI_AUDIT");
      router.push(`/projects/${res.data.id}`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm px-3 py-1.5 rounded-md bg-[var(--brand-blue)] text-white hover:opacity-90"
      >
        {t.companies.newProject}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t.companies.newProjectTitle}
      >
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
              {t.companies.newProjectName}
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.companies.newProjectNamePlaceholder}
              className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2 focus:outline-none focus:border-[var(--brand-blue)]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
              {t.companies.newProjectService}
            </span>
            <select
              value={serviceType}
              onChange={(e) =>
                setServiceType(e.target.value as (typeof SERVICES)[number])
              }
              className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2 bg-white"
            >
              {SERVICES.map((s) => (
                <option key={s} value={s}>
                  {t.serviceType[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.companies.newProjectValue}
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={valueBob}
                onChange={(e) => setValueBob(e.target.value)}
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.companies.newProjectTarget}
              </span>
              <input
                type="date"
                value={targetEnd}
                onChange={(e) => setTargetEnd(e.target.value)}
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2"
              />
            </label>
          </div>
          {error && <p className="text-sm text-[var(--brand-magenta)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-[var(--brand-border)] hover:bg-[var(--brand-bg)]"
            >
              {t.companies.newProjectCancel}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="px-4 py-2 text-sm rounded-md bg-[var(--brand-blue)] text-white disabled:opacity-50"
            >
              {pending ? "…" : t.companies.newProjectCreate}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
