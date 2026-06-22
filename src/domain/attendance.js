import { monthIndex } from './dates.js';

// A nominal working week is 5 days (Mon-Fri).
export const NOMINAL_WORKWEEK = 5;
export const MAX_WFH_PER_WEEK = 2;
export const DEFAULT_OFFICE_MIN = 3;

// Mandatory office days in a week, given H public holidays and L leaves that
// week. Two rules combine, taking whichever demands MORE office:
//   1. The 50% pro-rata curve ceil((5 - H - L) / 2), capped at fullWeekMin.
//   2. A flat floor fullWeekMin - H - L: each holiday/leave frees one office day.
// With fullWeekMin = 3 the flat term never exceeds the 50% term, so this
// reproduces the original rule exactly (3,2,2,1,1,0). Raising fullWeekMin above 3
// forces more office days (e.g. 5 => office every non-off day, so no casual WFH);
// lowering it models a relaxed "min N days/week" hybrid policy.
export function weeklyOfficeMin(holidaysInWeek, leavesInWeek, fullWeekMin = DEFAULT_OFFICE_MIN) {
  const remaining = NOMINAL_WORKWEEK - holidaysInWeek - leavesInWeek;
  const fiftyPctCapped = Math.min(fullWeekMin, Math.ceil(remaining / 2));
  const flatFloor = fullWeekMin - holidaysInWeek - leavesInWeek;
  return Math.max(0, fiftyPctCapped, flatFloor);
}

// Jan-Jun => H1, Jul-Dec => H2. One 2-week WFH block is allowed per half.
export function halfOfMonthIndex(mIdx) {
  return mIdx <= 5 ? 'H1' : 'H2';
}

export function halfOfISO(iso) {
  return halfOfMonthIndex(monthIndex(iso));
}
