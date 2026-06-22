import { ROLE_META } from '../uiMeta.js';
import { monthIndex, year, dayNum, monthNameLong, todayISO } from '../domain/dates.js';
import { DAY_TYPE } from '../domain/calendar.js';

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function leadingBlanks(dow) {
  // dow: 0=Sun..6=Sat -> columns start at Monday
  return (dow + 6) % 7;
}

function groupByMonth(days) {
  const months = [];
  let cur = null;
  for (const d of days) {
    const key = d.iso.slice(0, 7);
    if (!cur || cur.key !== key) {
      cur = { key, y: year(d.iso), m: monthIndex(d.iso), days: [] };
      months.push(cur);
    }
    cur.days.push(d);
  }
  return months;
}

function cellClass(day, win) {
  const role = win && win.roles[day.iso] ? win.roles[day.iso].role : null;
  if (role) return ROLE_META[role].cls;
  if (day.type === DAY_TYPE.WEEKEND) return 'role-weekend';
  if (day.type === DAY_TYPE.HOLIDAY) return 'role-holiday';
  return 'day-workday';
}

export default function CalendarTimeline({ days, selectedWin }) {
  const months = groupByMonth(days);
  const today = todayISO();

  return (
    <div className="calendar">
      {months.map((mo) => (
        <div className="cal-month" key={mo.key}>
          <div className="cal-month-title">
            {monthNameLong(mo.m)} <span className="muted">{mo.y}</span>
          </div>
          <div className="cal-grid">
            {WEEKDAY_HEADERS.map((h) => (
              <div className="cal-dow" key={h}>{h}</div>
            ))}
            {Array.from({ length: leadingBlanks(mo.days[0].dow) }).map((_, i) => (
              <div className="cal-cell blank" key={`b${i}`} />
            ))}
            {mo.days.map((day) => {
              const inWin = selectedWin && !!selectedWin.roles[day.iso];
              const meta = inWin ? ROLE_META[selectedWin.roles[day.iso].role] : null;
              const title = day.holiday
                ? `${day.holidayName}${meta ? ` (${meta.label})` : ''}`
                : meta
                ? meta.label
                : day.iso;
              return (
                <div
                  key={day.iso}
                  className={`cal-cell ${cellClass(day, selectedWin)} ${inWin ? 'in-window' : ''} ${day.iso === today ? 'is-today' : ''}`}
                  title={title}
                >
                  <span className="cal-num">{dayNum(day.iso)}</span>
                  {day.holiday ? <span className="cal-dot" /> : null}
                  {inWin && selectedWin.roles[day.iso].block ? <span className="cal-block" /> : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
