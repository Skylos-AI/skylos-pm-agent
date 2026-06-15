"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/pm/modal";
import { t } from "@/lib/i18n/es";

type Contact = {
  id: string;
  full_name: string;
  whatsapp: string | null;
  email: string | null;
  is_primary: boolean;
};

function renderTemplate(
  template: string,
  companyName: string,
  contactName: string | null,
) {
  const firstName = contactName ? contactName.split(" ")[0] : "Gerente General";
  return template
    .replace(/\{\{contact_name\}\}/g, firstName)
    .replace(/\{\{company_name\}\}/g, companyName);
}

export function OutreachButton({
  companyName,
  contacts,
  persona,
}: {
  companyName: string;
  contacts: Contact[];
  persona: { name: string; outreach_template: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const primary = contacts.find((c) => c.is_primary) ?? contacts[0] ?? null;
  const [contactId, setContactId] = useState<string>(primary?.id ?? "");
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [copied, setCopied] = useState(false);

  const contact = useMemo(
    () => contacts.find((c) => c.id === contactId) ?? null,
    [contacts, contactId],
  );
  const message = useMemo(
    () =>
      persona
        ? renderTemplate(
            persona.outreach_template,
            companyName,
            contact?.full_name ?? null,
          )
        : "",
    [persona, companyName, contact],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm px-3 py-1.5 rounded-md border border-[var(--brand-blue)] text-[var(--brand-blue)] hover:bg-[var(--brand-blue)]/5"
      >
        {t.companies.outreachDraft}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t.companies.outreachTitle}
      >
        {!persona ? (
          <p className="text-sm text-[var(--brand-magenta)] bg-[var(--brand-magenta)]/10 rounded-md px-3 py-2">
            {t.companies.outreachMissingPersona}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide flex-1 min-w-[140px]">
                {t.companies.outreachContactLabel}
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white"
                >
                  <option value="">— Gerente General —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.companies.outreachChannelLabel}
                <select
                  value={channel}
                  onChange={(e) =>
                    setChannel(e.target.value as "whatsapp" | "email")
                  }
                  className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white"
                >
                  <option value="whatsapp">
                    {t.companies.outreachChannelWa}
                  </option>
                  <option value="email">
                    {t.companies.outreachChannelEmail}
                  </option>
                </select>
              </label>
            </div>
            <p className="text-xs text-[var(--brand-fg-muted)]">
              Persona: {persona.name}
            </p>
            <textarea
              readOnly
              rows={8}
              value={message}
              className="w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2 font-mono bg-[var(--brand-bg)] resize-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={copy}
                className="text-sm px-3 py-1.5 rounded-md bg-[var(--brand-blue)] text-white hover:opacity-90"
              >
                {copied ? t.companies.outreachCopied : t.companies.outreachCopy}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
