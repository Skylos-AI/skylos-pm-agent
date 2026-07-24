"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCompanyTags } from "@/lib/mutations/companies";

const SIZE_TAGS = ["size:small", "size:medium", "size:big"] as const;
const SIZE_LABEL: Record<(typeof SIZE_TAGS)[number], string> = {
  "size:small": "Pequeña",
  "size:medium": "Mediana",
  "size:big": "Grande",
};

export function CompanyTagsEditor({
  companyId,
  initialTags,
}: {
  companyId: string;
  initialTags: string[];
}) {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const currentSize = useMemo(
    () => tags.find((t) => (SIZE_TAGS as readonly string[]).includes(t)) ?? null,
    [tags],
  );

  function commit(next: string[]) {
    // Optimistic — snap back on failure.
    const prev = tags;
    setTags(next);
    setError(null);
    startTransition(async () => {
      const res = await updateCompanyTags({ id: companyId, tags: next });
      if (!res.ok) {
        setTags(prev);
        setError(res.error.message);
        return;
      }
      setTags(res.data.tags);
      router.refresh();
    });
  }

  function addTag(raw: string) {
    const clean = raw.trim();
    if (!clean) return;
    if (tags.includes(clean)) {
      setInput("");
      return;
    }
    let next = [...tags, clean];
    // Enforce single size:* — dropping any other size tags.
    if ((SIZE_TAGS as readonly string[]).includes(clean)) {
      next = next.filter(
        (t) => t === clean || !(SIZE_TAGS as readonly string[]).includes(t),
      );
    }
    setInput("");
    commit(next);
  }

  function removeTag(t: string) {
    commit(tags.filter((x) => x !== t));
  }

  function setSize(size: (typeof SIZE_TAGS)[number]) {
    if (currentSize === size) {
      commit(tags.filter((t) => t !== size));
      return;
    }
    const next = [
      ...tags.filter((t) => !(SIZE_TAGS as readonly string[]).includes(t)),
      size,
    ];
    commit(next);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-[var(--brand-fg-muted)] mb-2">Tamaño</p>
        <div className="flex flex-wrap gap-2">
          {SIZE_TAGS.map((s) => {
            const active = currentSize === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                disabled={pending}
                aria-pressed={active}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                  active
                    ? "border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]"
                    : "border-[var(--brand-border)] text-[var(--brand-fg-muted)] hover:text-[var(--brand-fg)] hover:border-[var(--brand-fg-muted)]"
                }`}
              >
                {SIZE_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs text-[var(--brand-fg-muted)] mb-2">
          Todas las etiquetas
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tags.length === 0 && (
            <span className="text-xs text-[var(--brand-fg-muted)]">
              Sin etiquetas.
            </span>
          )}
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--brand-bg)] border border-[var(--brand-border)] text-[var(--brand-fg)]"
            >
              {t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                disabled={pending}
                aria-label={`Quitar etiqueta ${t}`}
                className="text-[var(--brand-fg-muted)] hover:text-[var(--brand-magenta)] disabled:opacity-50"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(input);
            } else if (
              e.key === "Backspace" &&
              input === "" &&
              tags.length > 0
            ) {
              e.preventDefault();
              removeTag(tags[tags.length - 1]);
            }
          }}
          placeholder="Agregar etiqueta y Enter"
          disabled={pending}
          className="flex-1 text-xs px-2.5 py-1.5 rounded-md border border-[var(--brand-border)] bg-transparent focus:outline-none focus:border-[var(--brand-blue)] disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => addTag(input)}
          disabled={pending || input.trim() === ""}
          className="text-xs px-2.5 py-1.5 rounded-md border border-[var(--brand-border)] text-[var(--brand-fg-muted)] hover:text-[var(--brand-blue)] hover:border-[var(--brand-blue)] disabled:opacity-50"
        >
          {pending ? "…" : "Agregar"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-[var(--brand-magenta)]">{error}</p>
      )}
    </div>
  );
}
