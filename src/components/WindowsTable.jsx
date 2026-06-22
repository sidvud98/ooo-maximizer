import { OBJECTIVE_META, fmtLeaves, fmtEfficiency } from '../uiMeta.js';
import { formatShort } from '../domain/dates.js';

export default function WindowsTable({ objectiveKey, candidates, selectedWin, onSelect }) {
  const meta = OBJECTIVE_META[objectiveKey];
  if (!candidates || candidates.length === 0) {
    return (
      <div className="table-wrap">
        <h3>Top windows &middot; {meta.short}</h3>
        <p className="muted">No qualifying windows in the current horizon. Try widening the horizon or adding balance.</p>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <h3>Top windows &middot; {meta.short}</h3>
      <div className="table-scroll">
        <table className="windows-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Start</th>
              <th>End</th>
              <th className="num">Days off</th>
              <th className="num">Workdays</th>
              <th className="num">Annual</th>
              <th className="num">Sick</th>
              <th className="num">WFH</th>
              <th className="num">Block</th>
              <th className="num">Efficiency</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((w, i) => {
              const isSel = selectedWin && selectedWin.startIso === w.startIso && selectedWin.endIso === w.endIso;
              return (
                <tr key={`${w.startIso}-${w.endIso}`} className={isSel ? 'sel' : ''} onClick={() => onSelect(w)}>
                  <td>{i + 1}</td>
                  <td>{formatShort(w.startIso)}</td>
                  <td>{formatShort(w.endIso)}</td>
                  <td className="num strong">{w.length}</td>
                  <td className="num">{w.workdaysBridged}</td>
                  <td className="num">{fmtLeaves(w.annualSpent)}</td>
                  <td className="num">{fmtLeaves(w.sickSpent)}</td>
                  <td className="num">{w.wfhDays}</td>
                  <td className="num">{w.blockWeeks || '-'}</td>
                  <td className="num">{fmtEfficiency(w.efficiency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">Efficiency = days off per leave spent. &ldquo;free&rdquo; means zero leaves used. Click a row to preview it on the calendar.</p>
    </div>
  );
}
