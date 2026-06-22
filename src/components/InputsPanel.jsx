import { useState } from 'react';
import { fmtLeaves } from '../uiMeta.js';

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export default function InputsPanel({ settings, balances, onChange }) {
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });

  const patch = (p) => onChange(p);

  const updateHoliday = (idx, key, value) => {
    const holidays = settings.holidays.map((h, i) => (i === idx ? { ...h, [key]: value } : h));
    patch({ holidays });
  };
  const removeHoliday = (idx) => patch({ holidays: settings.holidays.filter((_, i) => i !== idx) });
  const addHoliday = () => {
    if (!newHoliday.date) return;
    const holidays = [...settings.holidays, { ...newHoliday, name: newHoliday.name || 'Holiday' }]
      .sort((a, b) => a.date.localeCompare(b.date));
    patch({ holidays });
    setNewHoliday({ date: '', name: '' });
  };

  return (
    <aside className="inputs">
      <section className="panel">
        <h2>Your profile</h2>
        <Field label="Joining date" hint="Used to derive accrued sick & annual leave.">
          <input
            type="date"
            value={settings.joiningDate}
            onChange={(e) => patch({ joiningDate: e.target.value })}
          />
        </Field>
        <div className="field-row">
          <Field label="Sick balance" hint={`Derived: ${fmtLeaves(balances.derivedSick)}`}>
            <input
              type="number"
              min="0"
              step="1"
              placeholder={fmtLeaves(balances.derivedSick)}
              value={settings.overrideSick}
              onChange={(e) => patch({ overrideSick: e.target.value })}
            />
          </Field>
          <Field label="Annual balance" hint={`Derived: ${fmtLeaves(balances.derivedAnnual)}`}>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder={fmtLeaves(balances.derivedAnnual)}
              value={settings.overrideAnnual}
              onChange={(e) => patch({ overrideAnnual: e.target.value })}
            />
          </Field>
        </div>
        <p className="muted small">Leave the balance fields empty to use the derived values. Type a number to override.</p>
      </section>

      <section className="panel">
        <h2>Planning horizon</h2>
        <p className="muted small" style={{ marginBottom: '16px'}}>Over what period am I willing to plan?</p>
        <div className="field-row">
          <Field label="From">
            <input type="date" value={settings.horizonStart} onChange={(e) => patch({ horizonStart: e.target.value })} />
          </Field>
          <Field label="To">
            <input type="date" value={settings.horizonEnd} onChange={(e) => patch({ horizonEnd: e.target.value })} />
          </Field>
        </div>
      </section>

      <section className="panel">
        <h2>
          Target window
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.targetEnabled}
              onChange={(e) => patch({ targetEnabled: e.target.checked })}
            />
            <span>Plan a specific window</span>
          </label>
        </h2>
        <p className="muted small" style={{ marginBottom: '16px' }}>
          I already know when I want time off — what's the best way to use my leaves in that slot?
        </p>
        <div className="field-row" data-disabled={!settings.targetEnabled}>
          <Field label="Window from">
            <input
              type="date"
              disabled={!settings.targetEnabled}
              value={settings.targetStart}
              onChange={(e) => patch({ targetStart: e.target.value })}
            />
          </Field>
          <Field label="Window to">
            <input
              type="date"
              disabled={!settings.targetEnabled}
              value={settings.targetEnd}
              onChange={(e) => patch({ targetEnd: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="panel">
        <h2>Rules</h2>
        <div className="field-row">
          <Field label="Min office days/week" hint="Full week, no leave. 3 = standard 50% rule.">
            <input
              type="number"
              min="0"
              max="5"
              step="1"
              value={settings.officeMin}
              onChange={(e) => patch({ officeMin: e.target.value === '' ? '' : Number(e.target.value) })}
            />
          </Field>
          <Field label="Half-yearly WFH" hint="One continuous block per half-year.">
            <select value={settings.blockLen} onChange={(e) => patch({ blockLen: Number(e.target.value) })}>
              <option value={2}>2 weeks</option>
              <option value={4}>4 weeks</option>
            </select>
          </Field>
        </div>
        <ul className="rules-list muted small">
          <li>Office min = min({settings.officeMin === '' ? 3 : settings.officeMin}, ceil((5 - holidays - leaves) / 2)) per week</li>
          <li>WFH capped at 2 days/week (unless inside a WFH block)</li>
          <li>One {Number(settings.blockLen) === 4 ? 4 : 2}-week WFH block per half-year, back-to-back across Jun/Jul allowed</li>
          <li>1 sick/month (no carry-forward) · 4.5 annual/quarter (carries forward)</li>
        </ul>
      </section>

      <section className="panel">
        <h2>Public holidays</h2>
        <div className="holiday-editor">
          {settings.holidays.map((h, idx) => (
            <div className="holiday-row" key={`${h.date}-${idx}`}>
              <input type="date" value={h.date} onChange={(e) => updateHoliday(idx, 'date', e.target.value)} />
              <input
                type="text"
                value={h.name}
                onChange={(e) => updateHoliday(idx, 'name', e.target.value)}
                placeholder="Name"
              />
              <button type="button" className="icon-btn" onClick={() => removeHoliday(idx)} aria-label="Remove holiday">
                x
              </button>
            </div>
          ))}
          <div className="holiday-row add">
            <input
              type="date"
              value={newHoliday.date}
              onChange={(e) => setNewHoliday((s) => ({ ...s, date: e.target.value }))}
            />
            <input
              type="text"
              value={newHoliday.name}
              onChange={(e) => setNewHoliday((s) => ({ ...s, name: e.target.value }))}
              placeholder="New holiday"
            />
            <button type="button" className="icon-btn add" onClick={addHoliday} aria-label="Add holiday">
              +
            </button>
          </div>
        </div>
        <p className="muted small">Add 2027 holidays here if your horizon extends into next year.</p>
      </section>
    </aside>
  );
}
