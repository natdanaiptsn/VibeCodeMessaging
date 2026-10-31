/** แปลงวันที่ (YYYY-MM-DD) ตาม Timezone ให้เป็นเวลา UTC */
function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function zonedDayStart(dateStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  return new Date(guess - tzOffsetMs(new Date(guess), timeZone));
}

export function zonedDayEnd(dateStr: string, timeZone: string): Date {
  return new Date(zonedDayStart(dateStr, timeZone).getTime() + 24 * 60 * 60 * 1000);
}

export function dateRange(from: string | undefined, to: string | undefined, timeZone: string) {
  return {
    from: from ? zonedDayStart(from, timeZone) : undefined,
    to: to ? zonedDayEnd(to, timeZone) : undefined,
  };
}
