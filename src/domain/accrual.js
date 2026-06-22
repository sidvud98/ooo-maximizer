import { onOrBefore, year, pad2, diffDays } from './dates.js';

// Accrual model (confirmed with user):
// - Credit posts at the START of each period (front-loaded): once a period has
//   begun, you hold its full credit. The single exception is the period you join
//   in, which is prorated by the share of the period from your join date onward.
// - Sick: 1 / month, resets every calendar year (no carry-forward).
// - Planned: 4.5 / quarter (or 1.5 / month), carries forward across years.

export const SICK_PER_MONTH = 1;
export const ANNUAL_PER_QUARTER = 4.5;
// Max planned leave that rolls over into a new calendar year. The balance carried
// into each Jan 1 is clamped to this; the year's fresh accrual is then added on
// top (so the peak balance can exceed the cap mid/late year, e.g. 45 + 18 = 63).
export const ANNUAL_CARRY_CAP = 45;

function resolveCap(carryCap) {
  return Number.isFinite(carryCap) ? carryCap : ANNUAL_CARRY_CAP;
}

function resolveAccrualPeriod(period) {
  return period === 'monthly' ? 'monthly' : 'quarterly';
}

function periodStarts(period) {
  if (period === 'monthly') return Array.from({ length: 12 }, (_, i) => i + 1);
  return [1, 4, 7, 10];
}

function periodEndExclusive(y, startMonth, period) {
  if (period === 'monthly') {
    return startMonth === 12 ? `${y + 1}-01-01` : `${y}-${pad2(startMonth + 1)}-01`;
  }
  return startMonth === 10 ? `${y + 1}-01-01` : `${y}-${pad2(startMonth + 3)}-01`;
}

// Highest planned balance reachable at `asOf` under the rollover cap: the cap
// carried in, plus this calendar year's accrual to date (assumes an established
// employee, which is the only case where an override is meaningful).
function annualYearCeiling(asOfIso, rate, cap, period = 'quarterly') {
  const y = year(asOfIso);
  const accrualPeriod = resolveAccrualPeriod(period);
  let started = 0;
  for (const mm of periodStarts(accrualPeriod)) {
    if (onOrBefore(`${y}-${pad2(mm)}-01`, asOfIso)) started += 1;
  }
  return cap + started * rate;
}

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

// Planned leave accrued from the joining year through `asOf` (carries forward),
// prorating the joining period.
export function accruedAnnual(
  joiningIso,
  asOfIso,
  perPeriod = ANNUAL_PER_QUARTER,
  carryCap = ANNUAL_CARRY_CAP,
  accrualPeriod = 'quarterly',
) {
  if (!joiningIso || !asOfIso) return { value: 0, periods: [] };
  const rate = Number.isFinite(perPeriod) ? perPeriod : ANNUAL_PER_QUARTER;
  const cap = resolveCap(carryCap);
  const period = resolveAccrualPeriod(accrualPeriod);
  const y0 = year(joiningIso);
  const y1 = year(asOfIso);
  const periods = [];
  let value = 0;
  const starts = periodStarts(period);
  for (let y = y0; y <= y1; y++) {
    value = Math.min(value, cap); // clamp the rollover carried into this year
    for (const mm of starts) {
      const start = `${y}-${pad2(mm)}-01`;
      if (!onOrBefore(start, asOfIso)) break; // period not started yet
      const endExcl = periodEndExclusive(y, mm, period);
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
  const cap = resolveCap(rates.annualCarryCap);
  const accrualPeriod = resolveAccrualPeriod(rates.annualAccrualPeriod);
  const sick = accruedSick(joiningIso, asOfIso, rates.sickPerMonth);
  const annual = accruedAnnual(joiningIso, asOfIso, rates.annualPerQuarter, cap, accrualPeriod);
  const ovSick = pickOverride(overrides.sick);
  const ovAnnualRaw = pickOverride(overrides.annual);
  const ovAnnual = ovAnnualRaw == null ? null : Math.min(ovAnnualRaw, cap); // clamp override to the cap
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
  const annualRateResolved = Number.isFinite(annualRate) ? annualRate : ANNUAL_PER_QUARTER;
  const accrualPeriod = resolveAccrualPeriod(rates.annualAccrualPeriod);
  const cap = resolveCap(rates.annualCarryCap);
  const ovSick = pickOverride(overrides.sick);
  const ovAnnualRaw = pickOverride(overrides.annual);
  const ovAnnual = ovAnnualRaw == null ? null : Math.min(ovAnnualRaw, cap); // clamp override to the cap
  const baseSickToday = accruedSick(joiningIso, todayIso, sickRate).value;
  const baseAnnualToday = accruedAnnual(joiningIso, todayIso, annualRate, cap, accrualPeriod).value;

  return (iso) => {
    const dSick = accruedSick(joiningIso, iso, sickRate).value;
    const dAnnual = accruedAnnual(joiningIso, iso, annualRate, cap, accrualPeriod).value;

    let annual;
    if (ovAnnual == null) {
      annual = dAnnual;
    } else {
      // Override is the balance as of today; add future capped accrual, then keep
      // the projection under the year's rollover ceiling.
      const future = Math.max(0, dAnnual - baseAnnualToday);
      annual = Math.min(
        annualYearCeiling(iso, annualRateResolved, cap, accrualPeriod),
        ovAnnual + future,
      );
    }

    let sick;
    if (ovSick == null) sick = dSick;
    else if (year(iso) === year(todayIso)) sick = ovSick + Math.max(0, dSick - baseSickToday);
    else sick = dSick; // overrides apply to the current year only; sick resets

    sick = Math.max(0, sick);
    annual = Math.max(0, annual);
    return { sick, annual, spendable: Math.floor(sick) + Math.floor(annual) };
  };
}
