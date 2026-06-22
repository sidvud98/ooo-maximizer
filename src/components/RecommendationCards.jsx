import { OBJECTIVE_ORDER, OBJECTIVE_META, fmtLeaves, fmtEfficiency } from '../uiMeta.js';
import { formatShort } from '../domain/dates.js';

function Composition({ win }) {
  const parts = [
    { n: win.weekends, cls: 'role-weekend' },
    { n: win.holidays, cls: 'role-holiday' },
    { n: win.wfhDays, cls: 'role-wfh' },
    { n: win.sickSpent + win.annualSpent, cls: 'role-leave' },
  ].filter((p) => p.n > 0);
  const total = parts.reduce((a, p) => a + p.n, 0) || 1;
  return (
    <div className="composition" title="Make-up of the stretch">
      {parts.map((p, i) => (
        <span key={i} className={`composition-seg ${p.cls}`} style={{ flexGrow: p.n / total }} />
      ))}
    </div>
  );
}

function Card({ meta, data, selected, onSelect }) {
  const win = data?.best;
  return (
    <button
      type="button"
      className={`reco-card ${selected ? 'selected' : ''}`}
      onClick={() => win && onSelect(meta.key, win)}
    >
      <div className="reco-head">
        <span className="reco-short">{meta.short}</span>
        {win ? <span className="reco-eff">{fmtEfficiency(win.efficiency)}</span> : null}
      </div>
      {win ? (
        <>
          <div className="reco-length">
            <strong>{win.length}</strong> days off
          </div>
          <div className="reco-range">
            {formatShort(win.startIso)} &rarr; {formatShort(win.endIso)}
          </div>
          <Composition win={win} />
          <div className="reco-badges">
            {win.leaves > 0 ? (
              <span className="badge badge-leave">
                {fmtLeaves(win.leaves)} leave{win.leaves === 1 ? '' : 's'}
              </span>
            ) : (
              <span className="badge badge-free">0 leaves</span>
            )}
            {win.wfhDays > 0 ? <span className="badge badge-wfh">{win.wfhDays} WFH</span> : null}
            {win.blockWeeks > 0 ? <span className="badge badge-block">{win.blockWeeks}-wk block</span> : null}
          </div>
        </>
      ) : (
        <div className="reco-empty">No feasible window in range.</div>
      )}
      <p className="reco-desc muted small">{meta.desc}</p>
    </button>
  );
}

export default function RecommendationCards({ result, selectedKey, onSelect }) {
  return (
    <div className="reco-grid">
      {OBJECTIVE_ORDER.map((key) => (
        <Card
          key={key}
          meta={OBJECTIVE_META[key]}
          data={result[key]}
          selected={selectedKey === key}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
