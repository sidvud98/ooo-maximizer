import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { DEFAULT_HOLIDAYS } from './domain/holidays.js';
import { computeBalances } from './domain/accrual.js';
import { runPlanner, OBJ } from './domain/optimizer.js';
import { todayISO, onOrBefore } from './domain/dates.js';
import { OBJECTIVE_ORDER, OBJECTIVE_META, ROLE_META } from './uiMeta.js';
import InputsPanel from './components/InputsPanel.jsx';
import BalanceSummary from './components/BalanceSummary.jsx';
import RecommendationCards from './components/RecommendationCards.jsx';
import WindowsTable from './components/WindowsTable.jsx';
import SaveUpStrategy from './components/SaveUpStrategy.jsx';
import CalendarTimeline from './components/CalendarTimeline.jsx';

const STORAGE_KEY = 'leave-planner-v1';

function defaultSettings() {
  return {
    joiningDate: '2024-07-01',
    overrideSick: '',
    overrideAnnual: '',
    horizonStart: todayISO(),
    horizonEnd: '2026-12-31',
    targetEnabled: false,
    targetStart: '',
    targetEnd: '',
    focus: OBJ.ANY,
    allowChaining: true,
    holidays: DEFAULT_HOLIDAYS,
  };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw);
    return { ...defaultSettings(), ...parsed, holidays: parsed.holidays?.length ? parsed.holidays : DEFAULT_HOLIDAYS };
  } catch {
    return defaultSettings();
  }
}

function Legend() {
  return (
    <div className="legend">
      {Object.values(ROLE_META).map((m) => (
        <span className="legend-item" key={m.cls}>
          <span className={`legend-swatch ${m.cls}`} />
          {m.label}
        </span>
      ))}
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [focus, setFocus] = useState(settings.focus || OBJ.ANY);
  const [selected, setSelected] = useState(null);

  const onChange = (patch) => setSettings((s) => ({ ...s, ...patch }));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, focus }));
  }, [settings, focus]);

  const today = todayISO();
  const balances = useMemo(
    () => computeBalances(settings.joiningDate, today, { sick: settings.overrideSick, annual: settings.overrideAnnual }),
    [settings.joiningDate, settings.overrideSick, settings.overrideAnnual, today],
  );

  const validHorizon = onOrBefore(settings.horizonStart, settings.horizonEnd);

  const plan = useMemo(() => {
    if (!validHorizon) return null;
    return runPlanner({
      startIso: settings.horizonStart,
      endIso: settings.horizonEnd,
      todayIso: today,
      joiningIso: settings.joiningDate,
      holidays: settings.holidays,
      overrides: { sick: settings.overrideSick, annual: settings.overrideAnnual },
      allowChaining: settings.allowChaining,
      targetWindow: settings.targetEnabled ? { start: settings.targetStart, end: settings.targetEnd } : null,
    });
  }, [settings, today, validHorizon]);

  useEffect(() => {
    if (plan) setSelected(plan.result[focus]?.best || null);
  }, [plan, focus]);

  const changeFocus = (key) => setFocus(key);
  const selectWindow = (key, win) => {
    setFocus(key);
    setSelected(win);
  };

  const candidates = plan ? plan.result[focus].candidates : [];

  return (
    <div className="app">
      <header className="app-bar">
        <div>
          <h1>Leave &amp; WFH Maximizer</h1>
          <p className="muted">Plan the longest stretches out of the office &mdash; vacations, WFH runs, or a hybrid of both.</p>
        </div>
        <BalanceSummary balances={balances} asOfIso={today} />
      </header>

      <div className="layout">
        <InputsPanel settings={settings} balances={balances} onChange={onChange} />

        <main className="content">
          {!validHorizon ? (
            <div className="panel warn-panel">The horizon start date must be on or before the end date.</div>
          ) : (
            <>
              <RecommendationCards result={plan.result} selectedKey={focus} onSelect={selectWindow} />
              <p className="muted small reco-note">
                Click a card to preview it on the calendar. A window may spend leave you will have accrued by its start
                date (i.e. save up until then), so its leave count can exceed today&rsquo;s balance.
              </p>

              {plan.target ? <SaveUpStrategy target={plan.target} focusKey={focus} onSelect={selectWindow} /> : null}

              <div className="tabs">
                {OBJECTIVE_ORDER.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`tab ${focus === key ? 'active' : ''}`}
                    onClick={() => changeFocus(key)}
                  >
                    {OBJECTIVE_META[key].short}
                  </button>
                ))}
              </div>

              <div className="results-grid">
                <section className="panel calendar-panel">
                  <div className="panel-head">
                    <h2>{OBJECTIVE_META[focus].title}</h2>
                    <Legend />
                  </div>
                  <CalendarTimeline days={plan.days} selectedWin={selected} />
                </section>

                <section className="panel">
                  <WindowsTable
                    objectiveKey={focus}
                    candidates={candidates}
                    selectedWin={selected}
                    onSelect={(win) => setSelected(win)}
                  />
                </section>
              </div>
            </>
          )}
        </main>
      </div>

      <footer className="app-foot muted small">
        Office rule: ceil((5 - holidays - leaves) / 2) days/week &middot; WFH max 2/week &middot; two 2-week WFH blocks per
        year (chainable). Results assume HR approves any plan within these constraints.
      </footer>
    </div>
  );
}
