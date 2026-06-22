import { eachDay, isWeekend, mondayOf, dayOfWeek } from './dates.js';
import { holidayMap } from './holidays.js';

export const DAY_TYPE = { WEEKEND: 'WEEKEND', HOLIDAY: 'HOLIDAY', WORKDAY: 'WORKDAY' };

// Build a day-by-day timeline classifying every date in [startIso, endIso].
export function buildTimeline(startIso, endIso, holidays) {
  const hmap = holidayMap(holidays);
  return eachDay(startIso, endIso).map((iso) => {
    const weekend = isWeekend(iso);
    const holidayName = hmap.get(iso) || null;
    let type = DAY_TYPE.WORKDAY;
    if (weekend) type = DAY_TYPE.WEEKEND;
    else if (holidayName) type = DAY_TYPE.HOLIDAY;
    return {
      iso,
      dow: dayOfWeek(iso),
      weekend,
      holiday: !weekend && !!holidayName,
      holidayName: weekend ? null : holidayName,
      type,
      monday: mondayOf(iso),
    };
  });
}

// Group timeline days by their Monday (Mon-Fri working week key).
export function groupByWeek(days) {
  const map = new Map();
  for (const d of days) {
    let w = map.get(d.monday);
    if (!w) {
      w = { monday: d.monday, days: [], holidaysInWeek: 0, workdaysInWeek: 0, weekdayCount: 0 };
      map.set(d.monday, w);
    }
    w.days.push(d);
    if (d.dow >= 1 && d.dow <= 5) w.weekdayCount += 1;
    if (d.type === DAY_TYPE.HOLIDAY) w.holidaysInWeek += 1;
    if (d.type === DAY_TYPE.WORKDAY) w.workdaysInWeek += 1;
  }
  return map;
}
