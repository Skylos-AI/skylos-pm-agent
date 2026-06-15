import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";

const TZ = "America/La_Paz";

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "—";
  return formatInTimeZone(input, TZ, "dd MMM yyyy", { locale: es });
}

export function formatDateTime(
  input: string | Date | null | undefined,
): string {
  if (!input) return "—";
  return formatInTimeZone(input, TZ, "dd MMM yyyy · HH:mm", { locale: es });
}

export function formatRelative(
  input: string | Date | null | undefined,
): string {
  if (!input) return "—";
  const target = new Date(input).getTime();
  const diff = Date.now() - target;
  const day = 86400000;
  if (Math.abs(diff) < day) return "hoy";
  if (diff > 0 && diff < day * 2) return "ayer";
  if (diff < 0 && diff > -day * 2) return "mañana";
  const days = Math.floor(diff / day);
  if (days > 0) return `hace ${days} días`;
  return `en ${Math.abs(days)} días`;
}
