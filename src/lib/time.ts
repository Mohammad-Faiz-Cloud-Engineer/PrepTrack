export const IST_ZONE = 'Asia/Kolkata';
export const IST_OFFSET = '+05:30';
export const DAY_MS = 24 * 60 * 60 * 1000;

export function istDateString(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: IST_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ms);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function istMidnightMs(dateString: string): number { return Date.parse(`${dateString}T00:00:00${IST_OFFSET}`); }

export function addDays(dateString: string, amount: number): string {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = istMidnightMs(value);
  return Number.isFinite(ms) && istDateString(ms) === value;
}

export function isPlanDateAllowed(today: string, candidate: string): boolean {
  return isCalendarDate(today) && isCalendarDate(candidate) && candidate > today && candidate <= addDays(today, 7);
}

export function formatIST(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_ZONE, day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(ms);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  const time = `${part('hour')}:${part('minute')} ${part('dayPeriod').toLowerCase()}`;
  return `${part('day')} ${part('month')}, ${time} IST`;
}

export function formatDateIST(dateString: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: IST_ZONE, ...options }).format(istMidnightMs(dateString));
}
