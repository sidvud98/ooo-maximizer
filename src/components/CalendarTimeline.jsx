import { Box, Paper, Typography, useTheme } from '@mui/material';
import { ROLE_META, ROLE_COLORS } from '../uiMeta.js';
import { monthIndex, year, dayNum, monthNameLong, todayISO } from '../domain/dates.js';
import { DAY_TYPE } from '../domain/calendar.js';

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function leadingBlanks(dow) {
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

function cellColor(day, win) {
  const role = win && win.roles[day.iso] ? win.roles[day.iso].role : null;
  if (role) return ROLE_META[role].cls;
  if (day.type === DAY_TYPE.WEEKEND) return 'role-weekend';
  if (day.type === DAY_TYPE.HOLIDAY) return 'role-holiday';
  return null;
}

export default function CalendarTimeline({ days, selectedWin }) {
  const theme = useTheme();
  const months = groupByMonth(days);
  const today = todayISO();

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
        gap: 1.5,
      }}
    >
      {months.map((mo) => (
        <Paper key={mo.key} variant="outlined" sx={{ p: 1.25, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            {monthNameLong(mo.m)}{' '}
            <Typography component="span" variant="caption" color="text.secondary">
              {mo.y}
            </Typography>
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 0.25,
            }}
          >
            {WEEKDAY_HEADERS.map((h) => (
              <Typography
                key={h}
                variant="caption"
                color="text.secondary"
                sx={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 600 }}
              >
                {h}
              </Typography>
            ))}
            {Array.from({ length: leadingBlanks(mo.days[0].dow) }).map((_, i) => (
              <Box key={`b${i}`} />
            ))}
            {mo.days.map((day) => {
              const inWin = selectedWin && !!selectedWin.roles[day.iso];
              const meta = inWin ? ROLE_META[selectedWin.roles[day.iso].role] : null;
              const title = day.holiday
                ? `${day.holidayName}${meta ? ` (${meta.label})` : ''}`
                : meta
                  ? meta.label
                  : day.iso;
              const roleCls = cellColor(day, selectedWin);
              const bgColor = roleCls ? ROLE_COLORS[roleCls] : 'transparent';
              const isToday = day.iso === today;

              return (
                <Box
                  key={day.iso}
                  title={title}
                  sx={{
                    position: 'relative',
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 0.5,
                    fontSize: '0.7rem',
                    fontWeight: inWin ? 600 : 400,
                    bgcolor: roleCls ? bgColor : 'action.hover',
                    color: roleCls ? '#fff' : 'text.primary',
                    outline: isToday ? `2px solid ${theme.palette.primary.main}` : 'none',
                    outlineOffset: -1,
                    opacity: inWin || roleCls ? 1 : 0.85,
                  }}
                >
                  {dayNum(day.iso)}
                  {day.holiday ? (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 2,
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        bgcolor: roleCls ? '#fff' : ROLE_COLORS['role-holiday'],
                      }}
                    />
                  ) : null}
                  {inWin && selectedWin.roles[day.iso].block ? (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 1,
                        right: 1,
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        bgcolor: '#fff',
                        opacity: 0.9,
                      }}
                    />
                  ) : null}
                </Box>
              );
            })}
          </Box>
        </Paper>
      ))}
    </Box>
  );
}
