import { onOrBefore, year, pad2 } from './dates.js';

// Accrual model (confirmed with user):
// - Credit posts at the START of each period. You earn a period's credit if you
//   are employed on its first day (joiningDate <= period start).
// - Sick: 1 / month, resets every calendar year (no carry-forward).
// - Annual: 4.5 / quarter, carries forward across years.

export const SICK_PER_MONTH = 1;
export const ANNUAL_PER_QUARTER = 4.5;

// Sick accrued during the calendar year of `asOf`, up to and including `asOf`.
export function accruedSick(joiningIso, asOfIso) {
  if (!joiningIso || !asOfIso) return { value: 0, periods: [] };
  const y = year(asOfIso);
  const periods = [];
  for (let m = 0; m < 12; m++) {
    const first = `${y}-${pad2(m + 1)}-01`;
    if (onOrBefore(joiningIso, first) && onOrBefore(first, asOfIso)) periods.push(first);
  }
  return { value: periods.length * SICK_PER_MONTH, periods };
}

// Annual accrued from the joining year through `asOf` (carries forward).
export function accruedAnnual(joiningIso, asOfIso) {
  if (!joiningIso || !asOfIso) return { value: 0, periods: [] };
  const y0 = year(joiningIso);
  const y1 = year(asOfIso);
  const periods = [];
  for (let y = y0; y <= y1; y++) {
    for (const mm of ['01', '04', '07', '10']) {
      const first = `${y}-${mm}-01`;
      if (onOrBefore(joiningIso, first) && onOrBefore(first, asOfIso)) periods.push(first);
    }
  }
  return { value: periods.length * ANNUAL_PER_QUARTER, periods };
}

function pickOverride(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Current balances as of `asOf`, applying manual overrides when supplied.
export function computeBalances(joiningIso, asOfIso, overrides = {}) {
  const sick = accruedSick(joiningIso, asOfIso);
  const annual = accruedAnnual(joiningIso, asOfIso);
  const ovSick = pickOverride(overrides.sick);
  const ovAnnual = pickOverride(overrides.annual);
  const sickValue = ovSick != null ? ovSick : sick.value;
  const annualValue = ovAnnual != null ? ovAnnual : annual.value;
  return {
    sick: sickValue,
    annual: annualValue,
    spendable: sickValue + Math.floor(annualValue),
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
export function makeBudgetFn(joiningIso, todayIso, overrides = {}) {
  const ovSick = pickOverride(overrides.sick);
  const ovAnnual = pickOverride(overrides.annual);
  const baseSickToday = accruedSick(joiningIso, todayIso).value;
  const baseAnnualToday = accruedAnnual(joiningIso, todayIso).value;

  return (iso) => {
    const dSick = accruedSick(joiningIso, iso).value;
    const dAnnual = accruedAnnual(joiningIso, iso).value;

    let annual = ovAnnual == null ? dAnnual : ovAnnual + Math.max(0, dAnnual - baseAnnualToday);
    let sick;
    if (ovSick == null) sick = dSick;
    else if (year(iso) === year(todayIso)) sick = ovSick + Math.max(0, dSick - baseSickToday);
    else sick = dSick; // overrides apply to the current year only; sick resets

    sick = Math.max(0, sick);
    annual = Math.max(0, annual);
    return { sick, annual, spendable: sick + Math.floor(annual) };
  };
}
