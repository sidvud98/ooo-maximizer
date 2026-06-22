import { onOrBefore, year, pad2, diffDays } from './dates.js';

// Accrual model (confirmed with user):
// - Credit posts at the START of each period (front-loaded): once a period has
//   begun, you hold its full credit. The single exception is the period you join
//   in, which is prorated by the share of the period from your join date onward.
// - Sick: 1 / month, resets every calendar year (no carry-forward).
// - Annual: 4.5 / quarter, carries forward across years.

export const SICK_PER_MONTH = 1;
export const ANNUAL_PER_QUARTER = 4.5;

// Fraction of a period [start, endExclusive) credited given a join date:
//   1 if employed before the period began, 0 if joined on/after it ends,
//   otherwise the day-share from the join date to the period end (front-loaded).
function periodFraction(joiningIso, startIso, endExclusiveIso) {
  if (onOrBefore(joiningIso, startIso)) return 1;
  if (onOrBefore(endExclusiveIso, joiningIso)) return 0;
  const total = diffDays(startIso, endExclusiveIso);
  const present = diffDays(joiningIso, endExclusiveIso);
  return total > 0 ? present / total : 0;
}

// Sick accrued during the calendar year of `asOf`, prorating the joining month.
export function accruedSick(joiningIso, asOfIso, perMonth = SICK_PER_MONTH) {
  if (!joiningIso || !asOfIso) return { value: 0, periods: [] };
  const rate = Number.isFinite(perMonth) ? perMonth : SICK_PER_MONTH;
  const y = year(asOfIso);
  const periods = [];
  let value = 0;
  for (let m = 0; m < 12; m++) {
    const start = `${y}-${pad2(m + 1)}-01`;
    if (!onOrBefore(start, asOfIso)) break; // month not started yet
    const endExcl = m === 11 ? `${y + 1}-01-01` : `${y}-${pad2(m + 2)}-01`;
    const frac = periodFraction(joiningIso, start, endExcl);
    if (frac > 0) {
      value += frac * rate;
      periods.push(start);
    }
  }
  return { value, periods };
}

// Annual accrued from the joining year through `asOf` (carries forward),
// prorating the joining quarter.
export function accruedAnnual(joiningIso, asOfIso, perQuarter = ANNUAL_PER_QUARTER) {
  if (!joiningIso || !asOfIso) return { value: 0, periods: [] };
  const rate = Number.isFinite(perQuarter) ? perQuarter : ANNUAL_PER_QUARTER;
  const y0 = year(joiningIso);
  const y1 = year(asOfIso);
  const periods = [];
  let value = 0;
  const quarterStarts = [1, 4, 7, 10];
  for (let y = y0; y <= y1; y++) {
    for (const mm of quarterStarts) {
      const start = `${y}-${pad2(mm)}-01`;
      if (!onOrBefore(start, asOfIso)) break; // quarter not started yet
      const endExcl = mm === 10 ? `${y + 1}-01-01` : `${y}-${pad2(mm + 3)}-01`;
      const frac = periodFraction(joiningIso, start, endExcl);
      if (frac > 0) {
        value += frac * rate;
        periods.push(start);
      }
    }
  }
  return { value, periods };
}

function pickOverride(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Current balances as of `asOf`, applying manual overrides when supplied.
export function computeBalances(joiningIso, asOfIso, overrides = {}, rates = {}) {
  const sick = accruedSick(joiningIso, asOfIso, rates.sickPerMonth);
  const annual = accruedAnnual(joiningIso, asOfIso, rates.annualPerQuarter);
  const ovSick = pickOverride(overrides.sick);
  const ovAnnual = pickOverride(overrides.annual);
  const sickValue = ovSick != null ? ovSick : sick.value;
  const annualValue = ovAnnual != null ? ovAnnual : annual.value;
  return {
    sick: sickValue,
    annual: annualValue,
    spendable: Math.floor(sickValue) + Math.floor(annualValue),
    derivedSick: sick.value,
    derivedAnnual: annual.value,
    sickPeriods: sick.periods,
    annualPeriods: annual.periods,
    sickOverridden: ovSick != null && ovSick !== sick.value,
    annualOverridden: ovAnnual != null && ovAnnual !== annual.value,
  };
}

// Returns a function giving the balance available to SPEND as of any date.
// This powers the "save up then spend" semantics: a window may only use leaves
// that have accrued by its start date. Overrides are treated as the balance as
// of today, with future accrual added on top.
export function makeBudgetFn(joiningIso, todayIso, overrides = {}, rates = {}) {
  const sickRate = rates.sickPerMonth;
  const annualRate = rates.annualPerQuarter;
  const ovSick = pickOverride(overrides.sick);
  const ovAnnual = pickOverride(overrides.annual);
  const baseSickToday = accruedSick(joiningIso, todayIso, sickRate).value;
  const baseAnnualToday = accruedAnnual(joiningIso, todayIso, annualRate).value;

  return (iso) => {
    const dSick = accruedSick(joiningIso, iso, sickRate).value;
    const dAnnual = accruedAnnual(joiningIso, iso, annualRate).value;

    let annual = ovAnnual == null ? dAnnual : ovAnnual + Math.max(0, dAnnual - baseAnnualToday);
    let sick;
    if (ovSick == null) sick = dSick;
    else if (year(iso) === year(todayIso)) sick = ovSick + Math.max(0, dSick - baseSickToday);
    else sick = dSick; // overrides apply to the current year only; sick resets

    sick = Math.max(0, sick);
    annual = Math.max(0, annual);
    return { sick, annual, spendable: Math.floor(sick) + Math.floor(annual) };
  };
}
