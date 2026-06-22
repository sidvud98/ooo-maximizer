import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { DEFAULT_HOLIDAYS } from './domain/holidays.js';
import { computeBalances } from './domain/accrual.js';
import { OBJ } from './domain/optimizer.js';
import { todayISO, onOrBefore } from './domain/dates.js';
import { usePlanner } from './usePlanner.js';
import { OBJECTIVE_ORDER, OBJECTIVE_META, ROLE_META, ROLE_COLORS } from './uiMeta.js';
import InputsPanel from './components/InputsPanel.jsx';
import BalanceSummary from './components/BalanceSummary.jsx';
import RecommendationCards from './components/RecommendationCards.jsx';
import WindowsTable from './components/WindowsTable.jsx';
import SaveUpStrategy from './components/SaveUpStrategy.jsx';
import CalendarTimeline from './components/CalendarTimeline.jsx';

const STORAGE_KEY = 'leave-planner-v2';

const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

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
    annualAccrualPeriod: 'quarterly',
    annualCarryCap: 45,
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
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {Object.values(ROLE_META).map((m) => (
        <Chip
          key={m.cls}
          size="small"
          label={m.label}
          sx={{
            bgcolor: ROLE_COLORS[m.cls],
            color: '#fff',
            fontWeight: 500,
            '& .MuiChip-label': { px: 1 },
          }}
        />
      ))}
    </Box>
  );
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [focus, setFocus] = useState(settings.focus || OBJ.ANY);
  const [selKey, setSelKey] = useState(null);

  const onChange = (patch) => setSettings((s) => ({ ...s, ...patch }));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, focus }));
  }, [settings, focus]);

  const today = todayISO();

  const sickPerMonth = Number.isFinite(Number(settings.sickPerMonth)) ? Number(settings.sickPerMonth) : 1;
  const annualPerQuarter = Number.isFinite(Number(settings.annualPerQuarter)) ? Number(settings.annualPerQuarter) : 4.5;
  const annualAccrualPeriod = settings.annualAccrualPeriod === 'monthly' ? 'monthly' : 'quarterly';
  const annualCarryCap = Number.isFinite(Number(settings.annualCarryCap)) ? Number(settings.annualCarryCap) : 45;

  const balances = useMemo(
    () =>
      computeBalances(
        settings.joiningDate,
        today,
        { sick: settings.overrideSick, annual: settings.overrideAnnual },
        { sickPerMonth, annualPerQuarter, annualAccrualPeriod, annualCarryCap },
      ),
    [
      settings.joiningDate,
      settings.overrideSick,
      settings.overrideAnnual,
      today,
      sickPerMonth,
      annualPerQuarter,
      annualAccrualPeriod,
      annualCarryCap,
    ],
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
      rates: { sickPerMonth, annualPerQuarter, annualAccrualPeriod, annualCarryCap },
      targetWindow: settings.targetEnabled ? { start: settings.targetStart, end: settings.targetEnd } : null,
    };
  }, [settings, today, validHorizon, officeMin, blockLen, sickPerMonth, annualPerQuarter, annualAccrualPeriod, annualCarryCap]);

  const { plan, pending } = usePlanner(input);

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
    <Box sx={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', py: { xs: 2, md: 3 } }}>
      <Container maxWidth="lg" sx={{ flex: 1 }}>
        <Box
          component="header"
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'center', md: 'flex-start' },
            justifyContent: 'space-between',
            gap: 2,
            mb: 3,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'center', sm: 'flex-start' },
              gap: { xs: 1.5, sm: 2 },
              minWidth: 0,
              textAlign: { xs: 'center', sm: 'left' },
            }}
          >
            <Box
              component="img"
              src={LOGO_SRC}
              alt=""
              aria-hidden
              sx={{
                width: { xs: 96, sm: 112, md: 128 },
                height: { xs: 96, sm: 112, md: 128 },
                minWidth: { xs: 96, sm: 112, md: 128 },
                minHeight: { xs: 96, sm: 112, md: 128 },
                flexShrink: 0,
                objectFit: 'contain',
                display: 'block',
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h4" component="h1" gutterBottom sx={{ mb: { xs: 0.5, sm: 1 } }}>
                OOO Maximizer
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sit Still? Id Rather Not. Plan the longest stretches out of the office — vacations, WFH runs, or a hybrid of
                both.
              </Typography>
            </Box>
          </Box>
          <BalanceSummary balances={balances} asOfIso={today} />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '340px minmax(0, 1fr)' },
            gap: 3,
            alignItems: 'start',
          }}
        >
          <InputsPanel settings={settings} balances={balances} onChange={onChange} />

          <Box component="main" sx={{ minWidth: 0 }}>
            {!validHorizon ? (
              <Paper sx={{ p: 2, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                <Typography>The horizon start date must be on or before the end date.</Typography>
              </Paper>
            ) : !plan ? (
              <Paper
                sx={{
                  p: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <CircularProgress size={32} />
                <Typography color="text.secondary">Calculating your best windows…</Typography>
              </Paper>
            ) : (
              <Box sx={{ position: 'relative' }}>
                {pending ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 2,
                      bgcolor: 'action.disabledBackground',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      pt: 2,
                      borderRadius: 1,
                    }}
                  >
                    <Chip
                      icon={<CircularProgress size={14} color="inherit" />}
                      label="Calculating…"
                      size="small"
                      sx={{ bgcolor: 'background.paper' }}
                    />
                  </Box>
                ) : null}

                <Box sx={{ opacity: pending ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                  <RecommendationCards
                    result={plan.result}
                    selectedKey={focus}
                    onSelect={(key, win) => selectWindow(key, win, 'result')}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, mb: 2 }}>
                    Click a card to preview it on the calendar. A window may spend leave you will have accrued by its start
                    date (i.e. save up until then), so its leave count can exceed today&apos;s balance.
                  </Typography>

                  {plan.target ? (
                    <SaveUpStrategy
                      target={plan.target}
                      focusKey={focus}
                      onSelect={(key, win) => selectWindow(key, win, 'target')}
                    />
                  ) : null}

                  <Tabs
                    value={focus}
                    onChange={(_, key) => changeFocus(key)}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                  >
                    {OBJECTIVE_ORDER.map((key) => (
                      <Tab key={key} value={key} label={OBJECTIVE_META[key].short} />
                    ))}
                  </Tabs>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                      gap: 2,
                      alignItems: 'start',
                    }}
                  >
                    <Paper sx={{ p: 2, minWidth: 0 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: { xs: 'column', sm: 'row' },
                          alignItems: { sm: 'center' },
                          justifyContent: 'space-between',
                          gap: 1,
                          mb: 2,
                        }}
                      >
                        <Typography variant="h6" component="h2">
                          {OBJECTIVE_META[focus].title}
                        </Typography>
                        <Legend />
                      </Box>
                      <CalendarTimeline days={plan.days} selectedWin={selected} />
                    </Paper>

                    <Paper sx={{ p: 2, minWidth: 0 }}>
                      <WindowsTable
                        objectiveKey={focus}
                        candidates={candidates}
                        selectedWin={selected}
                        onSelect={(win) =>
                          setSelKey({ scope: 'result', objective: focus, startIso: win.startIso, endIso: win.endIso })
                        }
                      />
                    </Paper>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Container>

      <Box component="footer" sx={{ mt: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Typography variant="caption" color="text.secondary">
            Office rule: {officeMin} days/week, reduced 1 per holiday/leave, floored by the 50% attendance rule · WFH max
            2/week ·{' '}
            {blockLen === 0
              ? 'no half-yearly WFH block'
              : `one ${blockLen}-week WFH block per half-year (back-to-back across Jun/Jul allowed)`}
            . Results assume HR approves any plan within these constraints.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
