// Default public-holiday list for 2026 (from the user's holiday card).
// Fully editable in the UI; the optimizer only relies on this array.

export const DEFAULT_HOLIDAYS = [
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

export function holidayMap(holidays) {
  const m = new Map();
  for (const h of holidays) {
    if (h && h.date) m.set(h.date, h.name || 'Holiday');
  }
  return m;
}
