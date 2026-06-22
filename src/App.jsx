import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { DEFAULT_HOLIDAYS } from './domain/holidays.js';
import { computeBalances } from './domain/accrual.js';
import { OBJ } from './domain/optimizer.js';
import { todayISO, onOrBefore } from './domain/dates.js';
import { usePlanner } from './usePlanner.js';
import { OBJECTIVE_ORDER, OBJECTIVE_META, ROLE_META } from './uiMeta.js';
import InputsPanel from './components/InputsPanel.jsx';
import BalanceSummary from './components/BalanceSummary.jsx';
import RecommendationCards from './components/RecommendationCards.jsx';
import WindowsTable from './components/WindowsTable.jsx';
import SaveUpStrategy from './components/SaveUpStrategy.jsx';
import CalendarTimeline from './components/CalendarTimeline.jsx';

const STORAGE_KEY = 'leave-planner-v2';

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
    officeMin: 3,
    blockLen: 2,
    sickPerMonth: 1,
    annualPerQuarter: 4.5,
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
  // The user's explicit pick, stored by dates+scope so it survives recomputes.
  const [selKey, setSelKey] = useState(null);

  const onChange = (patch) => setSettings((s) => ({ ...s, ...patch }));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, focus }));
  }, [settings, focus]);

  const today = todayISO();

  const sickPerMonth = Number.isFinite(Number(settings.sickPerMonth)) ? Number(settings.sickPerMonth) : 1;
  const annualPerQuarter = Number.isFinite(Number(settings.annualPerQuarter)) ? Number(settings.annualPerQuarter) : 4.5;

  const balances = useMemo(
    () =>
      computeBalances(
        settings.joiningDate,
        today,
        { sick: settings.overrideSick, annual: settings.overrideAnnual },
        { sickPerMonth, annualPerQuarter },
      ),
    [settings.joiningDate, settings.overrideSick, settings.overrideAnnual, today, sickPerMonth, annualPerQuarter],
  );

  const validHorizon = onOrBefore(settings.horizonStart, settings.horizonEnd);

  const officeMin = Number.isFinite(Number(settings.officeMin)) ? Number(settings.officeMin) : 3;
  const blockLenRaw = Number(settings.blockLen);
  const blockLen = blockLenRaw === 0 || blockLenRaw === 4 ? blockLenRaw : 2;

  const input = useMemo(() => {
    if (!validHorizon) return null;
    return {
      startIso: settings.horizonStart,
      endIso: settings.horizonEnd,
      todayIso: today,
      joiningIso: settings.joiningDate,
      holidays: settings.holidays,
      overrides: { sick: settings.overrideSick, annual: settings.overrideAnnual },
      config: { officeMin, blockLen },
      rates: { sickPerMonth, annualPerQuarter },
      targetWindow: settings.targetEnabled ? { start: settings.targetStart, end: settings.targetEnd } : null,
    };
  }, [settings, today, validHorizon, officeMin, blockLen, sickPerMonth, annualPerQuarter]);

  const { plan, pending } = usePlanner(input);

  // Derive the previewed window from the current plan (no effect needed).
  // Falls back to the focused objective's best when there is no matching pick.
  const selected = useMemo(() => {
    if (!plan) return null;
    const pickFrom = (data) => {
      if (!data || !selKey) return null;
      const all = [data.best, ...(data.candidates || [])].filter(Boolean);
      return all.find((w) => w.startIso === selKey.startIso && w.endIso === selKey.endIso) || null;
    };
    if (selKey && selKey.objective === focus) {
      const source = selKey.scope === 'target' && plan.target ? plan.target[focus] : plan.result[focus];
      const hit = pickFrom(source);
      if (hit) return hit;
    }
    return plan.result[focus]?.best || null;
  }, [plan, focus, selKey]);

  const changeFocus = (key) => setFocus(key);
  const selectWindow = (key, win, scope = 'result') => {
    setFocus(key);
    setSelKey({ scope, objective: key, startIso: win.startIso, endIso: win.endIso });
  };

  const candidates = plan ? plan.result[focus].candidates : [];

  return (
    <div className="app">
      <header className="app-bar">
        <div>
          <h1>OOO Maximizer</h1>
          <p className="muted">Sit Still? Id Rather Not. Plan the longest stretches out of the office &mdash; vacations, WFH runs, or a hybrid of both.</p>
        </div>
        <BalanceSummary balances={balances} asOfIso={today} />
      </header>

      <div className="layout">
        <InputsPanel settings={settings} balances={balances} onChange={onChange} />

        <main className="content">
          {!validHorizon ? (
            <div className="panel warn-panel">The horizon start date must be on or before the end date.</div>
          ) : !plan ? (
            <div className="panel loading-panel">
              <span className="spinner" /> Calculating your best windows&hellip;
            </div>
          ) : (
            <div className={`results ${pending ? 'pending' : ''}`}>
              {pending ? (
                <div className="calc-badge">
                  <span className="spinner" /> Calculating&hellip;
                </div>
              ) : null}

              <RecommendationCards
                result={plan.result}
                selectedKey={focus}
                onSelect={(key, win) => selectWindow(key, win, 'result')}
              />
              <p className="muted small reco-note">
                Click a card to preview it on the calendar. A window may spend leave you will have accrued by its start
                date (i.e. save up until then), so its leave count can exceed today&rsquo;s balance.
              </p>

              {plan.target ? (
                <SaveUpStrategy
                  target={plan.target}
                  focusKey={focus}
                  onSelect={(key, win) => selectWindow(key, win, 'target')}
                />
              ) : null}

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
                    onSelect={(win) => setSelKey({ scope: 'result', objective: focus, startIso: win.startIso, endIso: win.endIso })}
                  />
                </section>
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="app-foot muted small">
        Office rule: {officeMin} days/week, reduced 1 per holiday/leave, floored by the 50% attendance rule &middot; WFH max
        2/week &middot;{' '}
        {blockLen === 0
          ? 'no half-yearly WFH block'
          : `one ${blockLen}-week WFH block per half-year (back-to-back across Jun/Jul allowed)`}
        . Results assume HR approves any plan within these constraints.
      </footer>
    </div>
  );
}
