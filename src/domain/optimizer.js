import { buildTimeline, groupByWeek, DAY_TYPE } from './calendar.js';
import { weeklyOfficeMin, NOMINAL_WORKWEEK, MAX_WFH_PER_WEEK, DEFAULT_OFFICE_MIN, halfOfISO } from './attendance.js';
import { makeBudgetFn } from './accrual.js';
import { diffDays, onOrBefore, year } from './dates.js';

// Objective keys.
export const OBJ = { OFF: 'OFF', WFH: 'WFH', ANY: 'ANY' };

export const ROLE = {
  OFFICE: 'OFFICE',
  WFH: 'WFH',
  LEAVE: 'LEAVE',
  HOLIDAY: 'HOLIDAY',
  WEEKEND: 'WEEKEND',
};

const MAX_CANDIDATES = 8;
const DEFAULT_BLOCK_LEN = 2; // weeks per half-yearly continuous-WFH block

function normalizeConfig(config = {}) {
  const rawOffice = Number.isFinite(config.officeMin) ? config.officeMin : DEFAULT_OFFICE_MIN;
  const officeMin = Math.max(0, Math.min(NOMINAL_WORKWEEK, Math.round(rawOffice)));
  const blockLen = [0, 2, 4].includes(config.blockLen) ? config.blockLen : DEFAULT_BLOCK_LEN;
  return { officeMin, blockLen };
}

// ---------------------------------------------------------------------------
// Per-week minimum leave cost to make all in-window workdays "non-office".
// k    = workdays of the week that fall inside the window
// H    = public holidays in that (full) week
// out  = workdays of the full week that are OUTSIDE the window (= 5 - H - k)
// Returns the minimum leaves needed, or Infinity if impossible without a block.
// ---------------------------------------------------------------------------
function weekLeafCost(objective, k, H, out, isBlockWeek, officeMin) {
  if (k === 0) return 0;
  if (objective === OBJ.OFF) return k; // every in-day must be a leave
  if (isBlockWeek) return 0; // a continuous-WFH block week is fully WFH (attendance waived)
  if (objective === OBJ.WFH) {
    // WFH days allowed in a normal week = working days minus required office,
    // still capped by the absolute 2/week limit. Office-min aware.
    const cap = Math.min(MAX_WFH_PER_WEEK, (NOMINAL_WORKWEEK - H) - weeklyOfficeMin(H, 0, officeMin));
    return k <= cap ? 0 : Infinity; // beyond the cap you must use a block
  }
  // OBJ.ANY: spend the fewest leaves; WFH covers up to MAX_WFH_PER_WEEK in-days for free.
  for (let L = Math.max(0, k - MAX_WFH_PER_WEEK); L <= k; L++) {
    if (out >= weeklyOfficeMin(H, L, officeMin)) return L;
  }
  return k;
}

function weekInfo(weeksIndex, monday) {
  const w = weeksIndex.get(monday);
  return { H: w ? w.holidaysInWeek : 0 };
}

// Evaluate a contiguous window [sIdx, eIdx]: total leaves required (and how many
// of them fall in `startYear`), or null if infeasible (a full interior week needs
// a block that is not placed).
function evalWindow(days, weeksIndex, sIdx, eIdx, objective, blockSet, officeMin, startYear) {
  const perWeek = new Map(); // monday -> workday indices, in date order
  for (let i = sIdx; i <= eIdx; i++) {
    const d = days[i];
    if (d.type === DAY_TYPE.WORKDAY) {
      const arr = perWeek.get(d.monday) || [];
      arr.push(i);
      perWeek.set(d.monday, arr);
    }
  }
  let leaves = 0;
  let leavesStartYear = 0;
  for (const [monday, idxs] of perWeek) {
    const { H } = weekInfo(weeksIndex, monday);
    const k = idxs.length;
    const out = NOMINAL_WORKWEEK - H - k;
    const cost = weekLeafCost(objective, k, H, out, blockSet.has(monday), officeMin);
    if (!Number.isFinite(cost)) return null;
    leaves += cost;
    // Leave days are the LAST `cost` workdays of the week (mirrors materializeWindow);
    // count those that fall in the window's start year (the only sick-eligible ones).
    for (let j = idxs.length - cost; j < idxs.length; j++) {
      if (j >= 0 && year(days[idxs[j]].iso) === startYear) leavesStartYear += 1;
    }
  }
  return { leaves, leavesStartYear };
}

function withinRestrict(iso, restrict) {
  if (!restrict) return true;
  return onOrBefore(restrict.start, iso) && onOrBefore(iso, restrict.end);
}

// Scan every window for one objective + block placement. Leaves grow
// monotonically as a window expands, so we stop a start once it exceeds budget
// or hits an infeasible interior week.
function scanWindows(days, weeksIndex, objective, budgetFn, blockSet, restrict, officeMin) {
  const n = days.length;
  let best = null;
  const perStartBest = [];
  for (let s = 0; s < n; s++) {
    if (!withinRestrict(days[s].iso, restrict)) continue;
    const startYear = year(days[s].iso);
    const bud = budgetFn(days[s].iso);
    const annualPool = Math.floor(bud.annual); // carries forward; usable any day
    const sickStart = Math.floor(bud.sick); // usable only on start-year days
    let bestForStart = null;
    for (let e = s; e < n; e++) {
      if (restrict && !onOrBefore(days[e].iso, restrict.end)) break;
      const r = evalWindow(days, weeksIndex, s, e, objective, blockSet, officeMin, startYear);
      if (!r) break;
      // Sick covers up to `sickStart` of the start-year leaves; the leftover
      // start-year leaves plus every later-year leave must come from annual (sick
      // resets Jan 1 and next-year sick has not accrued by the window start).
      const annualNeeded = Math.max(0, r.leavesStartYear - sickStart) + (r.leaves - r.leavesStartYear);
      if (annualNeeded > annualPool) break;
      const length = e - s + 1;
      const cand = {
        sIdx: s, eIdx: e, startIso: days[s].iso, endIso: days[e].iso,
        length, leaves: r.leaves, blockSet,
      };
      bestForStart = cand;
      if (!best || length > best.length || (length === best.length && cand.leaves < best.leaves)) {
        best = cand;
      }
    }
    if (bestForStart) perStartBest.push(bestForStart);
  }
  return { best, candidates: perStartBest };
}

// Enumerate valid continuous-WFH block placements. A block is `blockLen`
// consecutive full Mon-Fri weeks (one block allowed per half-year). Returns the
// empty placement and every single block.
function blockCandidates(weeksIndex, restrict, blockLen) {
  if (blockLen < 1) return []; // "None": no half-yearly WFH block granted
  const mondays = [...weeksIndex.keys()].sort((a, b) => a.localeCompare(b));
  const fullWeeks = mondays.filter((m) => weeksIndex.get(m).weekdayCount === 5);
  const blocks = [];
  for (let i = 0; i + blockLen - 1 < fullWeeks.length; i++) {
    const weeks = [fullWeeks[i]];
    let contiguous = true;
    for (let j = 1; j < blockLen; j++) {
      if (diffDays(fullWeeks[i + j - 1], fullWeeks[i + j]) !== 7) {
        contiguous = false;
        break;
      }
      weeks.push(fullWeeks[i + j]);
    }
    if (!contiguous) continue;
    if (restrict && !weeks.every((w) => withinRestrict(w, restrict))) continue;
    blocks.push({ weeks, half: halfOfISO(weeks[0]) });
  }
  return blocks;
}

// Returns the empty placement, every single block, and back-to-back pairs of
// blocks from different half-years that bridge the Jun/Jul boundary (one block
// per half stays respected, e.g. two 4-week blocks -> 8 contiguous weeks).
function enumerateBlockSets(weeksIndex, restrict, blockLen) {
  const blocks = blockCandidates(weeksIndex, restrict, blockLen);
  const sets = [new Set()];
  for (const b of blocks) sets.push(new Set(b.weeks));
  for (let i = 0; i < blocks.length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i === j) continue;
      const a = blocks[i];
      const b = blocks[j];
      const aLast = a.weeks[a.weeks.length - 1];
      if (diffDays(aLast, b.weeks[0]) === 7 && a.half !== b.half) {
        sets.push(new Set([...a.weeks, ...b.weeks]));
      }
    }
  }
  return sets;
}

// Turn a chosen window into a concrete day-by-day plan plus summary stats.
function materializeWindow(days, weeksIndex, win, objective, budgetFn, officeMin) {
  const { sIdx, eIdx } = win;
  const blockSet = win.blockSet || new Set();
  const weekDays = new Map();
  for (let i = sIdx; i <= eIdx; i++) {
    const d = days[i];
    if (d.type === DAY_TYPE.WORKDAY) {
      const arr = weekDays.get(d.monday) || [];
      arr.push(i);
      weekDays.set(d.monday, arr);
    }
  }

  const roles = {};
  const blockWeeks = new Set();
  let totalLeaves = 0;
  let wfhDays = 0;

  for (const [monday, idxs] of weekDays) {
    const { H } = weekInfo(weeksIndex, monday);
    const k = idxs.length;
    const out = NOMINAL_WORKWEEK - H - k;
    const isBlock = blockSet.has(monday);
    let L;
    if (objective === OBJ.OFF) L = k;
    else if (isBlock) { L = 0; blockWeeks.add(monday); }
    else if (objective === OBJ.WFH) L = 0;
    else {
      L = k;
      for (let cand = Math.max(0, k - MAX_WFH_PER_WEEK); cand <= k; cand++) {
        if (out >= weeklyOfficeMin(H, cand, officeMin)) { L = cand; break; }
      }
    }
    totalLeaves += L;
    // Leave the LAST L workdays of the week; WFH the rest (deterministic).
    idxs.forEach((dayIdx, j) => {
      const iso = days[dayIdx].iso;
      const isLeave = objective === OBJ.OFF || (objective === OBJ.ANY && j >= idxs.length - L);
      if (isLeave) {
        roles[iso] = { role: ROLE.LEAVE };
      } else {
        roles[iso] = { role: ROLE.WFH, block: isBlock };
        wfhDays += 1;
      }
    });
  }

  for (let i = sIdx; i <= eIdx; i++) {
    const d = days[i];
    if (d.type === DAY_TYPE.WEEKEND) roles[d.iso] = { role: ROLE.WEEKEND };
    else if (d.type === DAY_TYPE.HOLIDAY) roles[d.iso] = { role: ROLE.HOLIDAY };
    else if (!roles[d.iso]) roles[d.iso] = { role: ROLE.OFFICE };
  }

  // Split leaves: sick first (use-it-or-lose-it), then annual. Only whole days
  // are spendable, so fractional accrual is floored.
  const budget = budgetFn(win.startIso);
  const startYear = year(win.startIso);
  let sickLeft = Math.floor(budget.sick);
  let annualLeft = Math.floor(budget.annual);
  let sickSpent = 0;
  let annualSpent = 0;
  const list = [];
  for (let i = sIdx; i <= eIdx; i++) {
    const d = days[i];
    const r = roles[d.iso];
    if (r.role === ROLE.LEAVE) {
      // Sick is use-it-or-lose-it within its year, so it can only cover leave days
      // in the window's start year; everything else falls back to annual.
      if (sickLeft >= 1 && year(d.iso) === startYear) { r.leaveType = 'SICK'; sickLeft -= 1; sickSpent += 1; }
      else if (annualLeft >= 1) { r.leaveType = 'ANNUAL'; annualLeft -= 1; annualSpent += 1; }
      else { r.leaveType = 'ANNUAL'; annualSpent += 1; }
    }
    list.push({ ...d, ...r });
  }

  const length = eIdx - sIdx + 1;
  const workdaysBridged = list.filter((d) => d.type === DAY_TYPE.WORKDAY).length;
  const holidays = list.filter((d) => d.type === DAY_TYPE.HOLIDAY).length;
  const weekends = list.filter((d) => d.type === DAY_TYPE.WEEKEND).length;

  return {
    objective,
    startIso: win.startIso,
    endIso: win.endIso,
    length,
    offDays: length,
    workdaysBridged,
    leaves: totalLeaves,
    sickSpent,
    annualSpent,
    wfhDays,
    blockWeeks: blockWeeks.size,
    holidays,
    weekends,
    efficiency: totalLeaves > 0 ? length / totalLeaves : Infinity,
    roles,
    days: list,
    sIdx,
    eIdx,
  };
}

function overlap(a, b) {
  const lo = Math.max(a.sIdx, b.sIdx);
  const hi = Math.min(a.eIdx, b.eIdx);
  return Math.max(0, hi - lo + 1);
}

function rankCandidates(cands, days, weeksIndex, objective, budgetFn, officeMin) {
  const sorted = [...cands].sort((a, b) => b.length - a.length || a.leaves - b.leaves);
  const picked = [];
  for (const c of sorted) {
    if (c.length < 3) continue;
    if (picked.length >= MAX_CANDIDATES) break;
    const dominated = picked.some((p) => overlap(p, c) > 0.6 * Math.min(p.length, c.length));
    if (dominated) continue;
    picked.push(c);
  }
  return picked.map((c) => materializeWindow(days, weeksIndex, c, objective, budgetFn, officeMin));
}

function optimizeObjective(days, weeksIndex, objective, budgetFn, restrict, config) {
  const { officeMin, blockLen } = config;
  const scenarios = objective === OBJ.OFF ? [new Set()] : enumerateBlockSets(weeksIndex, restrict, blockLen);
  let best = null;
  const allCands = [];
  for (const blockSet of scenarios) {
    const { best: sBest, candidates } = scanWindows(days, weeksIndex, objective, budgetFn, blockSet, restrict, officeMin);
    for (const c of candidates) allCands.push(c);
    if (sBest && (!best || sBest.length > best.length || (sBest.length === best.length && sBest.leaves < best.leaves))) {
      best = sBest;
    }
  }
  return {
    best: best ? materializeWindow(days, weeksIndex, best, objective, budgetFn, officeMin) : null,
    candidates: rankCandidates(allCands, days, weeksIndex, objective, budgetFn, officeMin),
  };
}

// Main entry point used by the UI.
export function runPlanner(input) {
  const { startIso, endIso, todayIso, joiningIso, holidays, overrides, targetWindow, rates } = input;
  const config = normalizeConfig(input.config);
  const days = buildTimeline(startIso, endIso, holidays);
  const weeksIndex = groupByWeek(days);
  const budgetFn = makeBudgetFn(joiningIso, todayIso, overrides, rates);

  const result = {
    [OBJ.OFF]: optimizeObjective(days, weeksIndex, OBJ.OFF, budgetFn, null, config),
    [OBJ.WFH]: optimizeObjective(days, weeksIndex, OBJ.WFH, budgetFn, null, config),
    [OBJ.ANY]: optimizeObjective(days, weeksIndex, OBJ.ANY, budgetFn, null, config),
  };

  let target = null;
  if (targetWindow && targetWindow.start && targetWindow.end && onOrBefore(targetWindow.start, targetWindow.end)) {
    const restrict = { start: targetWindow.start, end: targetWindow.end };
    target = {
      range: restrict,
      budgetAtStart: budgetFn(targetWindow.start),
      [OBJ.OFF]: optimizeObjective(days, weeksIndex, OBJ.OFF, budgetFn, restrict, config),
      [OBJ.WFH]: optimizeObjective(days, weeksIndex, OBJ.WFH, budgetFn, restrict, config),
      [OBJ.ANY]: optimizeObjective(days, weeksIndex, OBJ.ANY, budgetFn, restrict, config),
    };
  }

  return { days, weeksIndex, result, target };
}
