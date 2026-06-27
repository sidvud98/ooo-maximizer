import { year } from './dates.js';

// Default public-holiday list for 2026 (from the user's holiday card).
// Fully editable in the UI; the optimizer only relies on this array.

// Names matching any of these (case-insensitive substring) recur every year by
// default, both for the built-in list below and for CSV imports.
const REPEATING_NAME_PATTERNS = ['christmas', 'republic', 'independence', 'new year'];

export function isRepeatingHolidayName(name) {
  const n = String(name || '').toLowerCase();
  return REPEATING_NAME_PATTERNS.some((k) => n.includes(k));
}

const DEFAULT_HOLIDAY_DATES = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-03-19', name: 'Ugadi Festival' },
  { date: '2026-05-01', name: 'May Day' },
  { date: '2026-09-14', name: 'Varasiddhi Vinayaka Vrata' },
  { date: '2026-10-02', name: 'Gandhi Jayanti' },
  { date: '2026-10-20', name: 'Maha Navami' },
  { date: '2026-10-21', name: 'Vijaya Dashami (Dussehra)' },
  { date: '2026-11-10', name: 'Balipadyami (Deepavali Holiday)' },
  { date: '2026-12-25', name: 'Christmas Day' },
];

// Pre-mark recurring defaults (New Year's Day, Republic Day, Christmas Day).
export const DEFAULT_HOLIDAYS = DEFAULT_HOLIDAY_DATES.map((h) => ({
  ...h,
  repeatsAnnually: isRepeatingHolidayName(h.name),
}));

export function holidayMap(holidays) {
  const m = new Map();
  for (const h of holidays) {
    if (h && h.date) m.set(h.date, h.name || 'Holiday');
  }
  return m;
}

// Materialize annually-repeating holidays across every year the horizon spans.
// Non-repeating entries pass through unchanged; this is the single place the
// optimizer/calendar learn about future-year occurrences.
export function expandHolidays(holidays, startIso, endIso) {
  const y0 = year(startIso);
  const y1 = year(endIso);
  const out = [];
  for (const h of holidays) {
    if (!h || !h.date) continue;
    out.push(h);
    if (!h.repeatsAnnually) continue;
    const baseYear = year(h.date);
    const md = h.date.slice(4); // '-MM-DD'
    for (let y = y0; y <= y1; y++) {
      if (y !== baseYear) out.push({ ...h, date: `${y}${md}` });
    }
  }
  return out;
}
