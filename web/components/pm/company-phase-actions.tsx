"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/pm/modal";
import { t } from "@/lib/i18n/es";
import { updateCompanyStatus } from "@/lib/mutations/companies";
import { createProject } from "@/lib/mutations/projects";
import { createPipelineDeal } from "@/lib/mutations/pipeline";
import type { CompanyStatus } from "@/lib/types/companies";

const STAGES = [
  "LEAD",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
] as const;

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

export function AddToPipelineButton({
  companyId,
  companyName,
  currentStatus,
}: {
  companyId: string;
  companyName: string;
  currentStatus: CompanyStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<(typeof STAGES)[number]>("LEAD");
  const [valueStr, setValueStr] = useState("");
  const [expectedClose, setExpectedClose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (
    currentStatus !== "LEAD" &&
    currentStatus !== "PROSPECT" &&
    currentStatus !== "ACTIVE_CLIENT"
  )
    return null;

  function reset() {
    setTitle("");
    setStage("LEAD");
    setValueStr("");
    setExpectedClose("");
    setError(null);
  }

  function submit() {
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError("El título es obligatorio.");
      return;
    }
    const value = valueStr ? Number(valueStr) : undefined;
    if (typeof value === "number" && Number.isNaN(value)) {
      setError("Valor inválido.");
      return;
    }
    startTransition(async () => {
      const res = await createPipelineDeal({
        companyId,
        title: trimmed,
        stage,
        valueBob: value,
        expectedCloseDate: expectedClose || undefined,
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm px-3 py-1.5 rounded-md bg-[var(--brand-magenta)] text-white hover:opacity-90"
      >
        {t.companies.addToPipeline}
      </button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title={t.companies.addToPipelineTitle}
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--brand-fg-muted)]">
            {companyName}
          </p>
          <label className="block">
            <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
              {t.companies.addToPipelineDealTitle}
            </span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.companies.addToPipelineDealPlaceholder}
              className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2 focus:outline-none focus:border-[var(--brand-blue)]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
              {t.companies.addToPipelineStage}
            </span>
            <select
              value={stage}
              onChange={(e) =>
                setStage(e.target.value as (typeof STAGES)[number])
              }
              className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2 bg-white"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {t.stage[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.companies.addToPipelineValue}
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.companies.addToPipelineExpectedClose}
              </span>
              <input
                type="date"
                value={expectedClose}
                onChange={(e) => setExpectedClose(e.target.value)}
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2"
              />
            </label>
          </div>
          {error && <p className="text-sm text-[var(--brand-magenta)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="px-4 py-2 text-sm rounded-md border border-[var(--brand-border)] hover:bg-[var(--brand-bg)]"
            >
              {t.companies.addToPipelineCancel}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="px-4 py-2 text-sm rounded-md bg-[var(--brand-magenta)] text-white disabled:opacity-50"
            >
              {pending ? "…" : t.companies.addToPipelineCreate}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
