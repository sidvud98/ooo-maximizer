import { monthIndex } from './dates.js';

// A nominal working week is 5 days (Mon-Fri).
export const NOMINAL_WORKWEEK = 5;
export const MAX_WFH_PER_WEEK = 2;

// Mandatory office days in a week, given H public holidays and L leaves that
// week: office_min = ceil((5 - H - L) / 2). Confirmed rule. Clamped at 0.
export function weeklyOfficeMin(holidaysInWeek, leavesInWeek) {
  return Math.max(0, Math.ceil((NOMINAL_WORKWEEK - holidaysInWeek - leavesInWeek) / 2));
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
