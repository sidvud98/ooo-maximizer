import { fmtLeaves } from '../uiMeta.js';
import { formatShort } from '../domain/dates.js';

function Stat({ value, label, sub, tone }) {
  return (
    <div className={`stat ${tone || ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  );
}

export default function BalanceSummary({ balances, asOfIso }) {
  return (
    <div className="balance-summary">
      <Stat
        value={fmtLeaves(balances.sick)}
        label="Sick leave"
        sub={balances.sickOverridden ? 'manual override' : `accrued by ${formatShort(asOfIso)}`}
        tone="tone-sick"
      />
      <Stat
        value={fmtLeaves(balances.annual)}
        label="Annual leave"
        sub={balances.annualOverridden ? 'manual override' : `accrued by ${formatShort(asOfIso)}`}
        tone="tone-annual"
      />
      <Stat
        value={fmtLeaves(balances.spendable)}
        label="Spendable days"
        sub="whole sick + whole annual days"
        tone="tone-total"
      />
    </div>
  );
}
