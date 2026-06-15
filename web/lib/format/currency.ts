const fmt = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  maximumFractionDigits: 0,
});

export function formatBob(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return fmt.format(n);
}
