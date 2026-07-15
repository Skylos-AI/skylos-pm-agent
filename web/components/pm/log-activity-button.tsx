"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/pm/modal";
import { t } from "@/lib/i18n/es";
import { logActivity } from "@/lib/mutations/activities";

const TYPES = [
  "CALL",
  "MEETING",
  "MESSAGE_SENT",
  "MESSAGE_RECEIVED",
  "EMAIL",
  "NOTE",
  "MILESTONE",
  "PROPOSAL_SENT",
  "CONTRACT_SIGNED",
] as const;
const CHANNELS = [
  "WHATSAPP",
  "PHONE",
  "IN_PERSON",
  "EMAIL",
  "VIDEO_CALL",
  "OTHER",
] as const;
const OUTCOMES = [
  "NO_ANSWER",
  "REACHED",
  "INTERESTED",
  "NOT_INTERESTED",
  "CALLBACK_REQUESTED",
  "MEETING_SCHEDULED",
  "VOICEMAIL_LEFT",
  "NEUTRAL",
] as const;

export type AssetOption = { id: string; name: string; version: string | null };

export function LogActivityButton({
  companyId,
  contacts,
  assets = [],
}: {
  companyId: string;
  contacts: { id: string; full_name: string }[];
  assets?: AssetOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<(typeof TYPES)[number]>("NOTE");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("OTHER");
  const [outcome, setOutcome] = useState<string>("");
  const [assetId, setAssetId] = useState<string>("");
  const [nextTouch, setNextTouch] = useState<string>("");
  const [contactId, setContactId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setDescription("");
    setContactId("");
    setType("NOTE");
    setChannel("OTHER");
    setOutcome("");
    setAssetId("");
    setNextTouch("");
    setError(null);
  }

  function submit() {
    setError(null);
    if (!description.trim()) {
      setError("La descripción es obligatoria.");
      return;
    }
    startTransition(async () => {
      const res = await logActivity({
        companyId,
        type,
        channel,
        outcome: outcome ? (outcome as (typeof OUTCOMES)[number]) : undefined,
        assetId: assetId || null,
        nextTouchAt: nextTouch || undefined,
        description: description.trim(),
        contactId: contactId || null,
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
        className="text-sm px-3 py-1.5 rounded-md bg-[var(--brand-blue)] text-white hover:opacity-90"
      >
        {t.companies.logActivity}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t.companies.logActivityTitle}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.companies.logActivityType}
              </span>
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as (typeof TYPES)[number])
                }
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2 bg-white"
              >
                {TYPES.map((tp) => (
                  <option key={tp} value={tp}>
                    {t.activityType[tp]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.companies.logActivityChannel}
              </span>
              <select
                value={channel}
                onChange={(e) =>
                  setChannel(e.target.value as (typeof CHANNELS)[number])
                }
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2 bg-white"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {t.activityChannel[ch]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.companies.logActivityOutcome}
              </span>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2 bg-white"
              >
                <option value="">{t.companies.logActivityOutcomeNone}</option>
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {t.activityOutcome[o]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.companies.logActivityNextTouch}
              </span>
              <input
                type="date"
                value={nextTouch}
                onChange={(e) => setNextTouch(e.target.value)}
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2"
              />
            </label>
          </div>
          {assets.length > 0 && (
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.companies.logActivityAsset}
              </span>
              <select
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2 bg-white"
              >
                <option value="">{t.companies.logActivityAssetNone}</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.version ? ` (${a.version})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {contacts.length > 0 && (
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.companies.logActivityContact}
              </span>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2 bg-white"
              >
                <option value="">{t.companies.logActivityNoContact}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
              {t.companies.logActivityDescription}
            </span>
            <textarea
              autoFocus
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2 resize-none focus:outline-none focus:border-[var(--brand-blue)]"
            />
          </label>
          {error && <p className="text-sm text-[var(--brand-magenta)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-[var(--brand-border)] hover:bg-[var(--brand-bg)]"
            >
              {t.companies.logActivityCancel}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="px-4 py-2 text-sm rounded-md bg-[var(--brand-blue)] text-white disabled:opacity-50"
            >
              {pending ? "…" : t.companies.logActivitySubmit}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
