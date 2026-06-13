const { formatInTimeZone, toZonedTime, fromZonedTime } = require("date-fns-tz");
const {
  addDays,
  startOfDay,
  endOfDay,
  parseISO,
  differenceInCalendarDays,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  nextSunday,
} = require("date-fns");

const TZ = "America/La_Paz";

function nowInTz() {
  return toZonedTime(new Date(), TZ);
}

function todayIso() {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
}

function startOfDayUtc(dateLike) {
  const zoned = toZonedTime(
    typeof dateLike === "string" ? parseISO(dateLike) : dateLike,
    TZ,
  );
  return fromZonedTime(startOfDay(zoned), TZ);
}

function endOfDayUtc(dateLike) {
  const zoned = toZonedTime(
    typeof dateLike === "string" ? parseISO(dateLike) : dateLike,
    TZ,
  );
  return fromZonedTime(endOfDay(zoned), TZ);
}

const WEEKDAY_FNS = {
  monday: nextMonday,
  tuesday: nextTuesday,
  wednesday: nextWednesday,
  thursday: nextThursday,
  friday: nextFriday,
  saturday: nextSaturday,
  sunday: nextSunday,
};

function parseRelative(input) {
  if (!input) return null;
  const trimmed = String(input).trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return parseISO(input);
  }
  const base = nowInTz();
  if (trimmed === "today" || trimmed === "hoy") return startOfDayUtc(base);
  if (trimmed === "tomorrow" || trimmed === "mañana")
    return startOfDayUtc(addDays(base, 1));
  if (trimmed === "yesterday" || trimmed === "ayer")
    return startOfDayUtc(addDays(base, -1));
  const nextMatch = trimmed.match(/^next\s+(\w+)$/);
  if (nextMatch) {
    const fn = WEEKDAY_FNS[nextMatch[1]];
    if (fn) return startOfDayUtc(fn(base));
  }
  const inDaysMatch = trimmed.match(/^in\s+(\d+)\s+days?$/);
  if (inDaysMatch) return startOfDayUtc(addDays(base, Number(inDaysMatch[1])));
  return null;
}

function daysBetween(from, to) {
  return differenceInCalendarDays(
    typeof to === "string" ? parseISO(to) : to,
    typeof from === "string" ? parseISO(from) : from,
  );
}

module.exports = {
  TZ,
  nowInTz,
  todayIso,
  startOfDayUtc,
  endOfDayUtc,
  parseRelative,
  daysBetween,
};
