import { OBJECTIVE_META, fmtLeaves, fmtEfficiency } from '../uiMeta.js';
import { formatShort, formatHuman, year } from '../domain/dates.js';
import { ROLE } from '../domain/optimizer.js';

export default function SaveUpStrategy({ target, focusKey, onSelect }) {
  if (!target) return null;
  const meta = OBJECTIVE_META[focusKey];
  const data = target[focusKey];
  const plan = data?.best;
  const budget = target.budgetAtStart;
  const leaveDays = plan ? plan.days.filter((d) => d.role === ROLE.LEAVE) : [];

  const crossesYear = plan && year(plan.startIso) !== year(plan.endIso);
  const usesSick = plan && plan.sickSpent > 0;

  return (
    <section className="saveup panel">
      <h2>Save-up strategy &middot; {meta.short}</h2>
      <p className="muted small">
        Target window {formatShort(target.range.start)} &rarr; {formatShort(target.range.end)}. Bank your leaves until the
        window opens, then spend them as below.
      </p>

      <div className="saveup-budget">
        <span>By {formatShort(target.range.start)} you will have</span>
        <strong className="tone-sick">{fmtLeaves(budget.sick)} sick</strong>
        <span>+</span>
        <strong className="tone-annual">{fmtLeaves(budget.annual)} annual</strong>
        <span>= {fmtLeaves(budget.spendable)} spendable days.</span>
      </div>

      {!plan ? (
        <p className="warn">No feasible stretch fits inside this window with the available balance. Widen the window or accrue more leave.</p>
      ) : (
        <>
          <button type="button" className="saveup-result" onClick={() => onSelect(focusKey, plan)}>
            <div>
              <div className="saveup-length"><strong>{plan.length}</strong> continuous days out of office</div>
              <div className="muted">{formatHuman(plan.startIso)} &rarr; {formatHuman(plan.endIso)}</div>
            </div>
            <div className="saveup-cost">
              <span className="badge badge-leave">{fmtLeaves(plan.leaves)} leaves</span>
              <span className="badge">{fmtEfficiency(plan.efficiency)}</span>
            </div>
          </button>

          {plan.leaves === 0 ? (
            <p className="ok small">This window needs no leave at all &mdash; it is fully covered by WFH, holidays and weekends.</p>
          ) : (
            <div className="leave-schedule">
              <span className="muted small">Apply leave on:</span>
              <div className="leave-chips">
                {leaveDays.map((d) => (
                  <span key={d.iso} className={`leave-chip ${d.leaveType === 'SICK' ? 'tone-sick' : 'tone-annual'}`}>
                    {formatShort(d.iso)} <em>{d.leaveType === 'SICK' ? 'sick' : 'annual'}</em>
                  </span>
                ))}
              </div>
            </div>
          )}

          {usesSick && crossesYear ? (
            <p className="warn small">
              Heads up: sick leave does not carry into the next year. The sick days above must fall before Dec 31 of {year(plan.startIso)}.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
