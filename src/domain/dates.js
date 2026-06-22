// Pure date helpers. Dates are represented as 'YYYY-MM-DD' strings and parsed
// at local noon so arithmetic never drifts across DST/timezone boundaries.

const MS_PER_DAY = 86400000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function dayOfWeek(iso) {
  return parseISO(iso).getDay();
}

export function isWeekend(iso) {
  const dow = dayOfWeek(iso);
  return dow === 0 || dow === 6;
}

export function diffDays(aIso, bIso) {
  return Math.round((parseISO(bIso) - parseISO(aIso)) / MS_PER_DAY);
}

// a <= b
export function onOrBefore(aIso, bIso) {
  return diffDays(aIso, bIso) >= 0;
}

export function mondayOf(iso) {
  const dow = dayOfWeek(iso);
  const offset = (dow + 6) % 7; // days since Monday
  return addDays(iso, -offset);
}

export function eachDay(startIso, endIso) {
  const out = [];
  let cur = startIso;
  while (diffDays(cur, endIso) >= 0) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function year(iso) {
  return Number(iso.slice(0, 4));
}

export function monthIndex(iso) {
  return Number(iso.slice(5, 7)) - 1;
}

export function dayNum(iso) {
  return Number(iso.slice(8, 10));
}

export function formatHuman(iso) {
  const d = parseISO(iso);
  return `${DOWS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatShort(iso) {
  const d = parseISO(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function monthName(idx) {
  return MONTHS[idx];
}

export function monthNameLong(idx) {
  return MONTHS_LONG[idx];
}

export function dowName(idx) {
  return DOWS[idx];
}

export function todayISO() {
  return toISO(new Date());
}
