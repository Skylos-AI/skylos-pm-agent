const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUsd(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return fmt.format(n);
}

// Legacy alias — the underlying column is still named value_bob in the
// schema, but everything user-facing now reads as USD. Keep the old name
// importable to avoid touching every call site in lockstep.
export const formatBob = formatUsd;
