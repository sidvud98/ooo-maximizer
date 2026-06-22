import { monthIndex } from './dates.js';

// A nominal working week is 5 days (Mon-Fri).
export const NOMINAL_WORKWEEK = 5;
export const MAX_WFH_PER_WEEK = 2;
export const DEFAULT_OFFICE_MIN = 3;

// Mandatory office days in a week, given H public holidays and L leaves that
// week. The base rule is the 50% pro-rata curve ceil((5 - H - L) / 2), capped
// by a configurable full-week minimum `fullWeekMin` (default 3). With
// fullWeekMin = 3 this reproduces the original rule exactly (since the 50% curve
// never exceeds 3 for a 5-day week); lowering it models e.g. a "min 2 days/week"
// hybrid policy, pro-rated down for holidays/leave. Clamped at 0.
export function weeklyOfficeMin(holidaysInWeek, leavesInWeek, fullWeekMin = DEFAULT_OFFICE_MIN) {
  const fiftyPct = Math.ceil((NOMINAL_WORKWEEK - holidaysInWeek - leavesInWeek) / 2);
  return Math.max(0, Math.min(fullWeekMin, fiftyPct));
}

// Maximum days you may WFH in a normal week without taking leave: capped at 2,
// but also bounded by the attendance rule when holidays shrink the week.
// You must still office at least ceil((5 - H) / 2) of the remaining days, so the
// regular WFH ceiling is min(2, floor((5 - H) / 2)).
export function regularWfhCap(holidaysInWeek) {
  return Math.min(MAX_WFH_PER_WEEK, Math.floor((NOMINAL_WORKWEEK - holidaysInWeek) / 2));
}

// Jan-Jun => H1, Jul-Dec => H2. One 2-week WFH block is allowed per half.
export function halfOfMonthIndex(mIdx) {
  return mIdx <= 5 ? 'H1' : 'H2';
}

export function halfOfISO(iso) {
  return halfOfMonthIndex(monthIndex(iso));
}
