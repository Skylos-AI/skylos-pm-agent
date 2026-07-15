"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/pm/modal";
import { t } from "@/lib/i18n/es";
import { logActivity } from "@/lib/mutations/activities";

const CHANNELS = ["IN_PERSON", "PHONE", "EMAIL", "WHATSAPP"] as const;
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

const CHANNEL_TYPE: Record<(typeof CHANNELS)[number], "MEETING" | "CALL" | "EMAIL" | "MESSAGE_SENT"> = {
  IN_PERSON: "MEETING",
  PHONE: "CALL",
  EMAIL: "EMAIL",
  WHATSAPP: "MESSAGE_SENT",
};

export function QuickTouchButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("PHONE");
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>("REACHED");
  const [note, setNote] = useState("");
  const [nextTouch, setNextTouch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setChannel("PHONE");
    setOutcome("REACHED");
    setNote("");
    setNextTouch("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await logActivity({
        companyId,
        type: CHANNEL_TYPE[channel],
        channel,
        outcome,
        description:
          note.trim() ||
          `Toque de outreach por ${t.activityChannel[channel]} — ${t.activityOutcome[outcome]}.`,
        nextTouchAt: nextTouch || undefined,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setOpen(false);
      reset();
      setDone(true);
      setTimeout(() => setDone(false), 1800);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-xs px-2 py-1 rounded-md transition ${
          done
            ? "bg-[var(--brand-cyan)]/15 text-[var(--brand-cyan)]"
            : "border border-[var(--brand-border)] text-[var(--brand-fg-muted)] hover:text-[var(--brand-blue)] hover:border-[var(--brand-blue)]"
        }`}
      >
        {done ? t.companies.markedContactedToast : t.companies.quickTouch}
      </button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title={t.companies.quickTouchTitle}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.companies.quickTouchChannel}
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
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.companies.quickTouchOutcome}
              </span>
              <select
                value={outcome}
                onChange={(e) =>
                  setOutcome(e.target.value as (typeof OUTCOMES)[number])
                }
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2 bg-white"
              >
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {t.activityOutcome[o]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
              {t.companies.quickTouchNote}
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
              {t.companies.quickTouchNextTouch}
            </span>
            <input
              type="date"
              value={nextTouch}
              onChange={(e) => setNextTouch(e.target.value)}
              className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2"
            />
          </label>
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
              {t.companies.logActivityCancel}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="px-4 py-2 text-sm rounded-md bg-[var(--brand-blue)] text-white disabled:opacity-50"
            >
              {pending ? "…" : t.companies.quickTouchSubmit}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
