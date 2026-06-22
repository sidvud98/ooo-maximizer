import { OBJ, ROLE } from './domain/optimizer.js';

export const ROLE_COLORS = {
  'role-office': '#ef4444',
  'role-wfh': '#3b82f6',
  'role-leave': '#22c55e',
  'role-holiday': '#f59e0b',
  'role-weekend': '#94a3b8',
};

export const TONE_COLORS = {
  'tone-sick': '#f59e0b',
  'tone-annual': '#a855f7',
  'tone-total': '#14b8a6',
};

export const OBJECTIVE_ORDER = [OBJ.ANY, OBJ.OFF, OBJ.WFH];

export const OBJECTIVE_META = {
  [OBJ.OFF]: {
    key: OBJ.OFF,
    short: 'Longest Vacation',
    title: 'Longest fully-off stretch',
    desc: 'Consecutive days doing zero work: weekends + public holidays + planned & sick leave. No WFH inside.',
  },
  [OBJ.WFH]: {
    key: OBJ.WFH,
    short: 'Longest WFH',
    title: 'Longest work-from-home run',
    desc: 'Consecutive days away from office using only WFH (max 2/week, or a half-yearly WFH block) bridged by weekends/holidays. No leave spent.',
  },
  [OBJ.ANY]: {
    key: OBJ.ANY,
    short: 'Longest Out-of-Office',
    title: 'Longest no-commute stretch',
    desc: 'The maximum run with no office commute by any means: leave + WFH + holidays + weekends + half-yearly WFH blocks.',
  },
};

export const ROLE_META = {
  [ROLE.OFFICE]: { label: 'Office', cls: 'role-office', abbr: 'O' },
  [ROLE.WFH]: { label: 'Work from home', cls: 'role-wfh', abbr: 'W' },
  [ROLE.LEAVE]: { label: 'Leave', cls: 'role-leave', abbr: 'L' },
  [ROLE.HOLIDAY]: { label: 'Public holiday', cls: 'role-holiday', abbr: 'H' },
  [ROLE.WEEKEND]: { label: 'Weekend', cls: 'role-weekend', abbr: '·' },
};

export function fmtLeaves(n) {
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function fmtEfficiency(eff) {
  if (!Number.isFinite(eff)) return 'free';
  return `${eff.toFixed(1)}x`;
}
