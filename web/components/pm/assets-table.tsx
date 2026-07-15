"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/pm/modal";
import { t } from "@/lib/i18n/es";
import { createAsset, updateAsset } from "@/lib/mutations/assets";
import type { AssetRow, AssetKind } from "@/lib/data/assets";
import { formatRelative } from "@/lib/format/date";

const KINDS = [
  "PROPOSAL",
  "DECK",
  "ONE_PAGER",
  "EMAIL_TEMPLATE",
  "BROCHURE",
  "CASE_STUDY",
  "CONTRACT",
  "OTHER",
] as const;

export function AddAssetButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AssetKind>("PROPOSAL");
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setKind("PROPOSAL");
    setUrl("");
    setVersion("");
    setNotes("");
    setError(null);
  }

  function submit() {
    setError(null);
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (url && !/^https?:\/\//.test(url)) {
      setError("El link debe empezar con http(s)://");
      return;
    }
    startTransition(async () => {
      const res = await createAsset({
        name: name.trim(),
        kind,
        externalUrl: url.trim() || null,
        version: version.trim() || null,
        notes: notes.trim() || null,
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
        {t.assets.add}
      </button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title={t.assets.addTitle}
      >
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
              {t.assets.name}
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.assets.namePlaceholder}
              className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2 focus:outline-none focus:border-[var(--brand-blue)]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.assets.kind}
              </span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as AssetKind)}
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2 bg-white"
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t.assetKind[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.assets.version}
              </span>
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1"
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
              {t.assets.externalUrl}
            </span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
              className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
              {t.assets.notes}
            </span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2 resize-none"
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
              {t.assets.cancel}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="px-4 py-2 text-sm rounded-md bg-[var(--brand-blue)] text-white disabled:opacity-50"
            >
              {pending ? "…" : t.assets.submit}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function AssetsTable({ assets }: { assets: AssetRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggleActive(asset: AssetRow) {
    setPendingId(asset.id);
    startTransition(async () => {
      await updateAsset({ id: asset.id, active: !asset.active });
      setPendingId(null);
      router.refresh();
    });
  }

  if (assets.length === 0) {
    return (
      <p className="text-sm text-[var(--brand-fg-muted)] italic bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-6">
        {t.assets.empty}
      </p>
    );
  }

  return (
    <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--brand-fg-muted)] border-b border-[var(--brand-border)]">
              <th className="px-4 py-3">{t.assets.columnName}</th>
              <th className="px-4 py-3">{t.assets.columnKind}</th>
              <th className="px-4 py-3">{t.assets.columnVersion}</th>
              <th className="px-4 py-3 text-right">{t.assets.columnUsage}</th>
              <th className="px-4 py-3">{t.assets.columnLink}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--brand-border)]">
            {assets.map((a) => (
              <tr key={a.id} className={a.active ? "" : "opacity-50"}>
                <td className="px-4 py-3 font-medium">
                  {a.name}
                  {!a.active && (
                    <span className="ml-2 text-xs text-[var(--brand-fg-muted)]">
                      · {t.assets.inactiveLabel}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--brand-fg-muted)]">
                  {t.assetKind[a.kind]}
                </td>
                <td className="px-4 py-3 text-[var(--brand-fg-muted)]">
                  {a.version ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {a.usage_count}
                  {a.last_used_at && (
                    <span className="text-xs text-[var(--brand-fg-muted)]">
                      {" "}
                      · {formatRelative(a.last_used_at)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {a.external_url ? (
                    <a
                      href={a.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[var(--brand-blue)] hover:underline"
                    >
                      Abrir ↗
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--brand-fg-muted)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleActive(a)}
                    disabled={pendingId === a.id}
                    className="text-xs text-[var(--brand-fg-muted)] hover:text-[var(--brand-fg)] underline disabled:opacity-50"
                  >
                    {pendingId === a.id
                      ? "…"
                      : a.active
                        ? t.assets.deactivate
                        : t.assets.activate}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
