import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { DEFAULT_HOLIDAYS } from "./domain/holidays.js";
import { computeBalances } from "./domain/accrual.js";
import { OBJ, validateStreaks } from "./domain/optimizer.js";
import { todayISO, onOrBefore } from "./domain/dates.js";
import { usePlanner } from "./usePlanner.js";
import {
  OBJECTIVE_ORDER,
  OBJECTIVE_META,
  ROLE_META,
  ROLE_COLORS,
} from "./uiMeta.js";
import pkg from "../package.json";
import InputsPanel from "./components/InputsPanel.jsx";
import BalanceSummary from "./components/BalanceSummary.jsx";
import RecommendationCards from "./components/RecommendationCards.jsx";
import WindowsTable from "./components/WindowsTable.jsx";
import CalendarTimeline from "./components/CalendarTimeline.jsx";
import SequencePlanner from "./components/SequencePlanner.jsx";

const STORAGE_KEY = "leave-planner-v2";

const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

function defaultSettings() {
  return {
    joiningDate: "2024-07-01",
    overrideSick: "",
    overrideAnnual: "",
    horizonStart: todayISO(),
    horizonEnd: "2026-12-31",
    focus: OBJ.ANY,
    viewMode: "sequence",
    officeMin: 3,
    blockLen: 2,
    sickPerMonth: 1,
    annualPerQuarter: 4.5,
    annualAccrualPeriod: "quarterly",
    annualCarryCap: 45,
    streaks: [],
    holidays: DEFAULT_HOLIDAYS,
  };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw);
    return {
      ...defaultSettings(),
      ...parsed,
      streaks: Array.isArray(parsed.streaks) ? parsed.streaks : [],
      holidays: parsed.holidays?.length ? parsed.holidays : DEFAULT_HOLIDAYS,
    };
  } catch {
    return defaultSettings();
  }
}

// Serialize exactly the fields that feed the planner input, so view-only state
// (focus tab, viewMode, selection) never marks the config dirty.
function configKey(s, todayIso) {
  return JSON.stringify({
    joiningDate: s.joiningDate,
    overrideSick: s.overrideSick,
    overrideAnnual: s.overrideAnnual,
    horizonStart: s.horizonStart,
    horizonEnd: s.horizonEnd,
    officeMin: s.officeMin,
    blockLen: s.blockLen,
    sickPerMonth: s.sickPerMonth,
    annualPerQuarter: s.annualPerQuarter,
    annualAccrualPeriod: s.annualAccrualPeriod,
    annualCarryCap: s.annualCarryCap,
    streaks: s.streaks,
    holidays: s.holidays,
    today: todayIso,
  });
}

// Build the planner input from a settings snapshot. Returns null on an invalid
// horizon (Apply is gated so this should not happen, but stays defensive).
function deriveInput(s, todayIso) {
  if (!onOrBefore(s.horizonStart, s.horizonEnd)) return null;
  const sickPerMonth = Number.isFinite(Number(s.sickPerMonth))
    ? Number(s.sickPerMonth)
    : 1;
  const annualPerQuarter = Number.isFinite(Number(s.annualPerQuarter))
    ? Number(s.annualPerQuarter)
    : 4.5;
  const annualAccrualPeriod =
    s.annualAccrualPeriod === "monthly" ? "monthly" : "quarterly";
  const annualCarryCap = Number.isFinite(Number(s.annualCarryCap))
    ? Number(s.annualCarryCap)
    : 45;
  const officeMin = Number.isFinite(Number(s.officeMin))
    ? Number(s.officeMin)
    : 3;
  const blockLenRaw = Number(s.blockLen);
  const blockLen = blockLenRaw === 0 || blockLenRaw === 4 ? blockLenRaw : 2;
  return {
    startIso: s.horizonStart,
    endIso: s.horizonEnd,
    todayIso,
    joiningIso: s.joiningDate,
    holidays: s.holidays,
    overrides: { sick: s.overrideSick, annual: s.overrideAnnual },
    config: { officeMin, blockLen },
    rates: {
      sickPerMonth,
      annualPerQuarter,
      annualAccrualPeriod,
      annualCarryCap,
    },
    sequence:
      Array.isArray(s.streaks) && s.streaks.length
        ? { streaks: s.streaks }
        : null,
  };
}

// Mandatory fields that gate the main Apply button (human-readable labels).
function missingMandatory(s) {
  const missing = [];
  const horizonPresent = Boolean(s.horizonStart && s.horizonEnd);
  const horizonValid =
    horizonPresent && onOrBefore(s.horizonStart, s.horizonEnd);
  if (!horizonPresent) missing.push("planning horizon dates");
  else if (!horizonValid) missing.push("horizon start on or before end");
  if (!s.joiningDate) missing.push("joining date");
  if (Array.isArray(s.streaks) && s.streaks.length) {
    const horizon = horizonValid
      ? { start: s.horizonStart, end: s.horizonEnd }
      : null;
    const validity = validateStreaks(s.streaks, horizon);
    if (validity.some((x) => !x.valid))
      missing.push("valid streak windows and lengths");
  }
  return missing;
}

function Legend() {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
      {Object.values(ROLE_META).map((m) => (
        <Chip
          key={m.cls}
          size="small"
          label={m.label}
          sx={{
            bgcolor: ROLE_COLORS[m.cls],
            color: "#fff",
            fontWeight: 500,
            "& .MuiChip-label": { px: 1 },
          }}
        />
      ))}
    </Box>
  );
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [focus, setFocus] = useState(settings.focus || OBJ.ANY);
  const [viewMode, setViewMode] = useState(
    settings.viewMode || "sequence",
  );
  const [selKey, setSelKey] = useState(null);
  const [applied, setApplied] = useState(null); // { settings, today } | null — blank until first Apply

  const onChange = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const onChangeStreaks = (streaks) => setSettings((s) => ({ ...s, streaks }));

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...settings, focus, viewMode }),
    );
  }, [settings, focus, viewMode]);

  const today = todayISO();

  // Lightweight derived balances stay live (they are part of the inputs UX, not
  // the gated heavy compute).
  const sickPerMonth = Number.isFinite(Number(settings.sickPerMonth))
    ? Number(settings.sickPerMonth)
    : 1;
  const annualPerQuarter = Number.isFinite(Number(settings.annualPerQuarter))
    ? Number(settings.annualPerQuarter)
    : 4.5;
  const annualAccrualPeriod =
    settings.annualAccrualPeriod === "monthly" ? "monthly" : "quarterly";
  const annualCarryCap = Number.isFinite(Number(settings.annualCarryCap))
    ? Number(settings.annualCarryCap)
    : 45;

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

  const officeMin = Number.isFinite(Number(settings.officeMin))
    ? Number(settings.officeMin)
    : 3;
  const blockLenRaw = Number(settings.blockLen);
  const blockLen = blockLenRaw === 0 || blockLenRaw === 4 ? blockLenRaw : 2;

  // The planner only ever sees the applied snapshot — this is the Apply gate.
  const input = useMemo(
    () => (applied ? deriveInput(applied.settings, applied.today) : null),
    [applied],
  );

  const { plan, pending, error } = usePlanner(input);

  const missing = useMemo(() => missingMandatory(settings), [settings]);
  const isDirty =
    !applied ||
    configKey(settings, today) !== configKey(applied.settings, applied.today);
  const canApply = missing.length === 0 && isDirty;

  const apply = () => {
    if (!canApply) return;
    setApplied({ settings, today });
  };

  const applySuggestion = (suggestion) => {
    const adjById = new Map(
      (suggestion.adjustedStreaks || []).map((s) => [s.id, s]),
    );
    const nextStreaks = (settings.streaks || []).map((s) => {
      const a = adjById.get(s.id);
      return a
        ? { ...s, start: a.start, end: a.end, desiredLength: a.desiredLength }
        : s;
    });
    const nextSettings = { ...settings, streaks: nextStreaks };
    setSettings(nextSettings);
    setApplied({ settings: nextSettings, today }); // writes AND recomputes in one click
  };

  const selected = useMemo(() => {
    if (!plan) return null;
    if (viewMode === "sequence") {
      const results = plan.sequence?.results || [];
      if (selKey && selKey.scope === "sequence") {
        const hit = results.find((r) => r.id === selKey.id);
        if (hit?.plan) return hit.plan;
      }
      const firstFound = results.find((r) => r.found && r.plan);
      return firstFound?.plan || null;
    }
    const pickFrom = (data) => {
      if (!data || !selKey) return null;
      const all = [data.best, ...(data.candidates || [])].filter(Boolean);
      return (
        all.find(
          (w) => w.startIso === selKey.startIso && w.endIso === selKey.endIso,
        ) || null
      );
    };
    if (selKey && selKey.objective === focus) {
      const hit = pickFrom(plan.result[focus]);
      if (hit) return hit;
    }
    return plan.result[focus]?.best || null;
  }, [plan, focus, selKey, viewMode]);

  const changeFocus = (key) => setFocus(key);
  const selectWindow = (key, win, scope = "result") => {
    setFocus(key);
    setSelKey({
      scope,
      objective: key,
      startIso: win.startIso,
      endIso: win.endIso,
    });
  };
  const previewStreak = (result) => {
    if (!result?.plan) return;
    setSelKey({
      scope: "sequence",
      id: result.id,
      startIso: result.plan.startIso,
      endIso: result.plan.endIso,
    });
  };

  const candidates = plan && plan.result ? plan.result[focus].candidates : [];
  const selectedStreakId =
    selKey && selKey.scope === "sequence" ? selKey.id : null;

  const blankPrompt = (
    <Paper
      sx={{
        p: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
        textAlign: "center",
      }}
    >
      <Typography variant="h6">Set your options, then click Apply</Typography>
      <Typography variant="body2" color="text.secondary">
        Nothing is computed until you apply. Adjust your profile, rules and
        (optionally) a sequence of streaks on the left, then press Apply to
        calculate.
      </Typography>
    </Paper>
  );

  const pendingOverlay = pending ? (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 2,
        bgcolor: "action.disabledBackground",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        pt: 2,
        borderRadius: 1,
      }}
    >
      <Chip
        icon={<CircularProgress size={14} color="inherit" />}
        label="Calculating…"
        size="small"
        sx={{ bgcolor: "background.paper" }}
      />
    </Box>
  ) : null;

  const recommendationsView = plan ? (
    <Box sx={{ position: "relative" }}>
      {pendingOverlay}
      <Box sx={{ opacity: pending ? 0.5 : 1, transition: "opacity 0.2s" }}>
        <RecommendationCards
          result={plan.result}
          selectedKey={focus}
          onSelect={(key, win) => selectWindow(key, win, "result")}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1, mb: 2 }}
        >
          Click a card to preview it on the calendar. A window may spend leave
          you will have accrued by its start date (i.e. save up until then), so
          its leave count can exceed today&apos;s balance.
        </Typography>

        <Tabs
          value={focus}
          onChange={(_, key) => changeFocus(key)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
        >
          {OBJECTIVE_ORDER.map((key) => (
            <Tab key={key} value={key} label={OBJECTIVE_META[key].short} />
          ))}
        </Tabs>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
            alignItems: "start",
          }}
        >
          <Paper sx={{ p: 2, minWidth: 0 }}>
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                alignItems: { sm: "center" },
                justifyContent: "space-between",
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
                setSelKey({
                  scope: "result",
                  objective: focus,
                  startIso: win.startIso,
                  endIso: win.endIso,
                })
              }
            />
          </Paper>
        </Box>
      </Box>
    </Box>
  ) : null;

  const sequenceView = (
    <Box sx={{ position: "relative" }}>
      {pendingOverlay}
      <Box sx={{ opacity: pending ? 0.5 : 1, transition: "opacity 0.2s" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
            alignItems: "start",
          }}
        >
          <SequencePlanner
            streaks={settings.streaks}
            horizon={{ start: settings.horizonStart, end: settings.horizonEnd }}
            sequence={plan ? plan.sequence : null}
            onChangeStreaks={onChangeStreaks}
            onPreview={previewStreak}
            onApplySuggestion={applySuggestion}
            selectedId={selectedStreakId}
          />
          {plan ? (
            <Paper sx={{ p: 2, minWidth: 0 }}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" },
                  alignItems: { sm: "center" },
                  justifyContent: "space-between",
                  gap: 1,
                  mb: 2,
                }}
              >
                <Typography variant="h6" component="h2">
                  {selected ? "Streak preview" : "Calendar"}
                </Typography>
                <Legend />
              </Box>
              <CalendarTimeline days={plan.days} selectedWin={selected} />
            </Paper>
          ) : null}
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        py: { xs: 2, md: 3 },
      }}
    >
      <Container maxWidth={false} disableGutters sx={{ px: { xs: 2, md: 3 }, flex: 1 }}>
        <Box
          component="header"
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: { xs: "center", md: "flex-start" },
            justifyContent: "space-between",
            gap: 2,
            mb: 3,
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "center", sm: "flex-start" },
              gap: { xs: 1.5, sm: 2 },
              minWidth: 0,
              textAlign: { xs: "center", sm: "left" },
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
                objectFit: "contain",
                display: "block",
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 1,
                  flexWrap: "wrap",
                  mb: { xs: 0.5, sm: 1 },
                }}
              >
                <Typography variant="h4" component="h1" sx={{ mb: 0 }}>
                  O-O-O Maximizer
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="span"
                >
                  v{pkg.version}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Sit Still? I'd Rather Not. Plan the longest stretches
                Out-Of-Office (OOO) — vacations, WFH runs, or a hybrid of both.
              </Typography>
            </Box>
          </Box>
          <BalanceSummary balances={balances} asOfIso={today} />
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "340px minmax(0, 1fr)" },
            gap: 3,
            alignItems: "start",
          }}
        >
          <InputsPanel
            settings={settings}
            balances={balances}
            onChange={onChange}
          />

          <Box component="main" sx={{ minWidth: 0 }}>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                mb: 2,
              }}
            >
              <ToggleButtonGroup
                size="small"
                value={viewMode}
                exclusive
                onChange={(_, v) => {
                  if (v) setViewMode(v);
                }}
              >
                <ToggleButton value="sequence">Sequence planner</ToggleButton>
                <ToggleButton value="recommendations">
                  Longest Streaks
                </ToggleButton>
              </ToggleButtonGroup>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {applied && isDirty ? (
                  <Chip
                    size="small"
                    color="warning"
                    variant="outlined"
                    label="Changes Not Applied"
                  />
                ) : null}
                <Button
                  variant="contained"
                  disabled={!canApply}
                  onClick={apply}
                >
                  Apply
                </Button>
              </Box>
            </Box>

            {missing.length ? (
              <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
                Fill these to apply: {missing.join(", ")}.
              </Alert>
            ) : null}

            {error && applied ? (
              <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
                Couldn&apos;t compute: {error}. Check your inputs and apply
                again.
              </Alert>
            ) : null}

            {viewMode === "sequence" ? (
              sequenceView
            ) : !applied ? (
              blankPrompt
            ) : !plan ? (
              error ? null : (
                <Paper
                  sx={{
                    p: 4,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <CircularProgress size={32} />
                  <Typography color="text.secondary">
                    Calculating your best windows…
                  </Typography>
                </Paper>
              )
            ) : (
              recommendationsView
            )}
          </Box>
        </Box>
      </Container>

      <Box
        component="footer"
        sx={{ mt: 3, py: 2, borderTop: 1, borderColor: "divider" }}
      >
        <Container maxWidth={false} disableGutters sx={{ px: { xs: 2, md: 3 } }}>
          <Typography variant="caption" color="text.secondary">
            Office rule: {officeMin} days/week, reduced 1 per holiday/leave,
            floored by the 50% attendance rule · WFH max 2/week ·{" "}
            {blockLen === 0
              ? "no half-yearly WFH block"
              : `one ${blockLen}-week WFH block per half-year (back-to-back across Jun/Jul allowed)`}
            . Results assume HR approves any plan within these constraints.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
