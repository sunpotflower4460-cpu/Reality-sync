const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dateKeyFromDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string') return null;
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) return null;

  return date;
}

export function isValidDateKey(dateKey) {
  return parseDateKey(dateKey) !== null;
}

export function shiftDateKey(dateKey, amount) {
  const date = parseDateKey(dateKey);
  if (!date || !Number.isFinite(Number(amount))) return dateKeyFromDate();
  date.setDate(date.getDate() + Number(amount));
  return dateKeyFromDate(date);
}

export function startOfWeekDateKey(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return dateKeyFromDate();
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return dateKeyFromDate(date);
}

export function getWeekDateKeys(dateKey) {
  const monday = startOfWeekDateKey(dateKey);
  return Array.from({ length: 7 }, (_, index) => shiftDateKey(monday, index));
}

export function formatDateLabel(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

export function formatShortDateLabel(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

export function formatWeekLabel(dateKey) {
  const keys = getWeekDateKeys(dateKey);
  const start = parseDateKey(keys[0]);
  const end = parseDateKey(keys[6]);
  if (!start || !end) return dateKey;

  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = new Intl.DateTimeFormat('ja-JP', {
    ...(sameYear ? {} : { year: 'numeric' }),
    month: 'numeric',
    day: 'numeric',
  }).format(start);
  const endLabel = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(end);
  return `${startLabel} – ${endLabel}`;
}

export function isToday(dateKey, now = new Date()) {
  return dateKey === dateKeyFromDate(now);
}
