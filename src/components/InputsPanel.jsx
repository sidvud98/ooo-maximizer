import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  MdAdd,
  MdDeleteOutline,
  MdHelpOutline,
  MdUploadFile,
} from "react-icons/md";
import { FaRepeat } from "react-icons/fa6";
import { fmtLeaves } from "../uiMeta.js";
import { DateField, DateRangeField } from "./DateFields.jsx";
import { parseHolidaysCsv } from "../domain/csv.js";

function Field({ label, hint, children }) {
  return (
    <FormControl fullWidth size="small" sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mb: 0.5, display: "block" }}
      >
        {label}
      </Typography>
      {children}
      {hint ? <FormHelperText sx={{ mx: 0 }}>{hint}</FormHelperText> : null}
    </FormControl>
  );
}

function roundRate(n) {
  return Math.round(n * 10) / 10;
}

export default function InputsPanel({ settings, balances, onChange }) {
  const [newHoliday, setNewHoliday] = useState({
    date: "",
    name: "",
    repeatsAnnually: false,
  });

  const patch = (p) => onChange(p);

  const isMonthlyAccrual = settings.annualAccrualPeriod === "monthly";
  const plannedPeriodLabel = isMonthlyAccrual ? "month" : "quarter";

  const toggleAccrualPeriod = (toMonthly) => {
    const currentRate =
      settings.annualPerQuarter === ""
        ? 4.5
        : Number(settings.annualPerQuarter);
    const rate = Number.isFinite(currentRate) ? currentRate : 4.5;
    const converted = toMonthly ? roundRate(rate / 3) : roundRate(rate * 3);
    patch({
      annualAccrualPeriod: toMonthly ? "monthly" : "quarterly",
      annualPerQuarter: converted,
    });
  };

  const updateHoliday = (idx, key, value) => {
    const holidays = settings.holidays.map((h, i) =>
      i === idx ? { ...h, [key]: value } : h,
    );
    patch({ holidays });
  };
  const removeHoliday = (idx) =>
    patch({ holidays: settings.holidays.filter((_, i) => i !== idx) });
  const addHoliday = () => {
    if (!newHoliday.date) return;
    const holidays = [
      ...settings.holidays,
      { ...newHoliday, name: newHoliday.name || "Holiday" },
    ].sort((a, b) => a.date.localeCompare(b.date));
    patch({ holidays });
    setNewHoliday({ date: "", name: "", repeatsAnnually: false });
  };

  const fileInputRef = useRef(null);
  const [helpAnchor, setHelpAnchor] = useState(null);
  const [csvPrompt, setCsvPrompt] = useState(null);
  const [csvError, setCsvError] = useState("");
  const [holidaysOpen, setHolidaysOpen] = useState(false);

  const sortByDate = (list) =>
    [...list].sort((a, b) => a.date.localeCompare(b.date));

  const onCsvFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-uploading the same file
    if (!file) return;
    setCsvError("");
    try {
      const text = await file.text();
      const result = parseHolidaysCsv(text);
      if (result.error) {
        setCsvError(result.error);
        return;
      }
      if (result.parsed === 0) {
        setCsvError("No valid holiday rows were found in the file.");
        return;
      }
      setCsvPrompt(result);
    } catch {
      setCsvError("Could not read the file.");
    }
  };

  const applyCsv = (mode) => {
    if (!csvPrompt) return;
    if (mode === "replace") {
      patch({ holidays: sortByDate(csvPrompt.holidays) });
    } else if (mode === "merge") {
      const map = new Map(settings.holidays.map((h) => [h.date, h]));
      csvPrompt.holidays.forEach((h) => map.set(h.date, h)); // parsed wins on date clash
      patch({ holidays: sortByDate([...map.values()]) });
    }
    setCsvPrompt(null);
  };

  const fieldRowSx = {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
    gap: 1.5,
  };

  const fieldSubsectionSx = {
    bgcolor: "action.hover",
    borderRadius: 1,
    p: 1.5,
    display: "flex",
    flexDirection: "column",
    gap: 1.5,
  };

  const repeatingCount = settings.holidays.filter(
    (h) => h.repeatsAnnually,
  ).length;

  const holidayRowSx = {
    display: { xs: "grid", sm: "flex" },
    alignItems: "center",
    columnGap: { xs: 1, sm: 0.75 },
    rowGap: { xs: 0.5, sm: 0 },
    gridTemplateColumns: { xs: "auto minmax(0, 1fr) auto" },
    gridTemplateAreas: { xs: '"icon name del" "sw date del"' },
    bgcolor: "action.hover",
    borderRadius: 1,
    p: { xs: 1, sm: 0.75 },
    pl: { sm: "18px" },
  };

  return (
    <Box
      component="aside"
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Your profile
          </Typography>
          <Stack spacing={1.5}>
            <Box sx={fieldSubsectionSx}>
              <Field
                label="Company Joining date"
                hint="Used to derive accrued sick & planned leave."
              >
                <DateField
                  value={settings.joiningDate}
                  onChange={(iso) => patch({ joiningDate: iso })}
                />
              </Field>
              <Box sx={fieldRowSx}>
                <Field
                  label="Current Sick leaves remaining"
                  hint={`Derived: ${fmtLeaves(balances.derivedSick)}`}
                >
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    placeholder={fmtLeaves(balances.derivedSick)}
                    value={settings.overrideSick}
                    onChange={(e) => patch({ overrideSick: e.target.value })}
                  />
                </Field>
                <Field
                  label="Current Planned leaves remaining"
                  hint={`Derived: ${fmtLeaves(balances.derivedAnnual)}`}
                >
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                    placeholder={fmtLeaves(balances.derivedAnnual)}
                    value={settings.overrideAnnual}
                    onChange={(e) => patch({ overrideAnnual: e.target.value })}
                  />
                </Field>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Leave the remaining leaves' fields empty to use the derived
                values. Type a number to override.
              </Typography>
            </Box>
            <Box sx={fieldSubsectionSx}>
              <Box sx={fieldRowSx}>
                <Field
                  label="Sick leaves credited per month"
                  hint="Accrual rate (default 1)."
                >
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                    value={settings.sickPerMonth}
                    onChange={(e) =>
                      patch({
                        sickPerMonth:
                          e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field
                  label={`Planned leaves credited per ${plannedPeriodLabel}`}
                  hint={`Accrual rate (default ${isMonthlyAccrual ? "1.5/month" : "4.5/quarter"}).`}
                >
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                    value={settings.annualPerQuarter}
                    onChange={(e) =>
                      patch({
                        annualPerQuarter:
                          e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                  />
                </Field>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Planned leave accrues{" "}
                  {isMonthlyAccrual ? "monthly" : "quarterly"}
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={isMonthlyAccrual}
                      onChange={(e) => toggleAccrualPeriod(e.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="caption">Monthly accrual</Typography>
                  }
                  sx={{ mr: 0 }}
                />
              </Box>
            </Box>
            <Box sx={fieldSubsectionSx}>
              <Field
                label="Planned Leaves annual carryover cap"
                hint="Max planned days that roll into a new year (default 45)."
              >
                <TextField
                  type="number"
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                  value={settings.annualCarryCap}
                  onChange={(e) =>
                    patch({
                      annualCarryCap:
                        e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
              </Field>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Planning horizon
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 1.5 }}
          >
            Over what period am I willing to plan?
          </Typography>
          <Field label="From / To">
            <DateRangeField
              startValue={settings.horizonStart}
              endValue={settings.horizonEnd}
              onChange={(start, end) =>
                patch({ horizonStart: start, horizonEnd: end })
              }
            />
          </Field>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Rules
          </Typography>
          <Box sx={fieldRowSx}>
            <Field hint="Full week, no leave. 3 = standard 50% rule.">
              <TextField
                label="Min office days/week"
                variant="outlined"
                type="number"
                size="small"
                fullWidth
                slotProps={{ htmlInput: { min: 0, max: 5, step: 1 } }}
                value={settings.officeMin}
                onChange={(e) =>
                  patch({
                    officeMin:
                      e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
            </Field>
            <FormControl fullWidth size="small">
              <InputLabel id="block-len-label">Half-yearly WFH</InputLabel>
              <Select
                labelId="block-len-label"
                label="Half-yearly WFH"
                value={settings.blockLen}
                onChange={(e) => patch({ blockLen: Number(e.target.value) })}
              >
                <MenuItem value={0}>None</MenuItem>
                <MenuItem value={2}>2 weeks</MenuItem>
                <MenuItem value={4}>4 weeks</MenuItem>
              </Select>
              <FormHelperText>
                One continuous block per half-year (None disables it).
              </FormHelperText>
            </FormControl>
          </Box>
          <Box
            component="ul"
            sx={{ m: "12px 0 0", pl: 2.5, color: "text.secondary" }}
          >
            <Typography component="li" variant="caption" sx={{ mb: 0.5 }}>
              Office {settings.officeMin === "" ? 3 : settings.officeMin}{" "}
              days/week, minus 1 per holiday/leave (never below the 50% rule)
            </Typography>
            <Typography component="li" variant="caption" sx={{ mb: 0.5 }}>
              WFH capped at 2 days/week (unless inside a WFH block)
            </Typography>
            <Typography component="li" variant="caption" sx={{ mb: 0.5 }}>
              {Number(settings.blockLen) === 0
                ? "No half-yearly WFH block"
                : `One ${Number(settings.blockLen) === 4 ? 4 : 2}-week WFH block per half-year, back-to-back across Jun/Jul allowed`}
            </Typography>
            <Typography component="li" variant="caption" sx={{ mb: 0.5 }}>
              {settings.sickPerMonth === "" ? 1 : settings.sickPerMonth}{" "}
              sick/month (no carry-forward) ·{" "}
              {settings.annualPerQuarter === ""
                ? isMonthlyAccrual
                  ? 1.5
                  : 4.5
                : settings.annualPerQuarter}{" "}
              planned/
              {plannedPeriodLabel} (carries forward)
            </Typography>
            <Typography component="li" variant="caption">
              Planned carryover capped at{" "}
              {settings.annualCarryCap === "" ? 45 : settings.annualCarryCap}{" "}
              days rolled into each new year
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Public holidays
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {settings.holidays.length} holiday
                {settings.holidays.length === 1 ? "" : "s"}
                {repeatingCount ? ` · ${repeatingCount} repeat annually` : ""}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setHolidaysOpen(true)}
            >
              Modify Holiday list
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Dialog
        open={holidaysOpen}
        onClose={() => setHolidaysOpen(false)}
        maxWidth="md"
        fullWidth
        disableEnforceFocus
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <span>Public holidays</span>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <IconButton
              size="small"
              aria-label="CSV format help"
              onClick={(e) => setHelpAnchor(e.currentTarget)}
            >
              <MdHelpOutline />
            </IconButton>
            <Button
              size="small"
              variant="outlined"
              startIcon={<MdUploadFile />}
              onClick={() =>
                fileInputRef.current && fileInputRef.current.click()
              }
            >
              Upload CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={onCsvFile}
            />
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Popover
            open={Boolean(helpAnchor)}
            anchorEl={helpAnchor}
            onClose={() => setHelpAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <Box sx={{ p: 1.5, maxWidth: 280 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Expected CSV format
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                component="div"
              >
                A header row with two columns:
                <Box component="ul" sx={{ pl: 2, my: 0.5 }}>
                  <li>
                    <b>date</b> &mdash; format YYYY-MM-DD
                  </li>
                  <li>
                    <b>name</b> &mdash; holiday name
                  </li>
                </Box>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    mt: 0.5,
                    p: 1,
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    fontSize: "0.7rem",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {"date,name\n2026-01-01,New Year\n2026-12-25,Christmas"}
                </Box>
              </Typography>
            </Box>
          </Popover>
          {csvError ? (
            <Alert
              severity="error"
              variant="outlined"
              sx={{ mb: 1 }}
              onClose={() => setCsvError("")}
            >
              {csvError}
            </Alert>
          ) : null}
          <Stack spacing={1}>
            {settings.holidays.map((h, idx) => (
              <Box key={`${h.date}-${idx}`} sx={holidayRowSx}>
                <Tooltip title="Repeats every year on the same date">
                  <Box
                    component="span"
                    sx={{
                      gridArea: "icon",
                      justifySelf: { xs: "center" },
                      display: "inline-flex",
                      color: "text.secondary",
                      fontSize: 18,
                    }}
                  >
                    <FaRepeat aria-hidden />
                  </Box>
                </Tooltip>
                <Switch
                  size="small"
                  checked={!!h.repeatsAnnually}
                  onChange={(e) =>
                    updateHoliday(idx, "repeatsAnnually", e.target.checked)
                  }
                  inputProps={{ "aria-label": "Repeats annually" }}
                  sx={{ gridArea: "sw", justifySelf: { xs: "center" } }}
                />
                <Box sx={{ gridArea: "date", flex: "0 0 130px", minWidth: 0 }}>
                  <DateField
                    value={h.date}
                    onChange={(iso) => updateHoliday(idx, "date", iso)}
                  />
                </Box>
                <TextField
                  size="small"
                  value={h.name}
                  onChange={(e) => updateHoliday(idx, "name", e.target.value)}
                  placeholder="Name"
                  sx={{ gridArea: "name", flex: "1 1 0", minWidth: 0 }}
                />
                <IconButton
                  size="small"
                  onClick={() => removeHoliday(idx)}
                  aria-label="Remove holiday"
                  sx={{
                    gridArea: "del",
                    alignSelf: "center",
                    justifySelf: "center",
                    minWidth: 40,
                    minHeight: 40,
                  }}
                >
                  <MdDeleteOutline />
                </IconButton>
              </Box>
            ))}
            <Box sx={holidayRowSx}>
              <Tooltip title="Repeats every year on the same date">
                <Box
                  component="span"
                  sx={{
                    gridArea: "icon",
                    justifySelf: { xs: "center" },
                    display: "inline-flex",
                    color: "text.secondary",
                    fontSize: 18,
                  }}
                >
                  <FaRepeat aria-hidden />
                </Box>
              </Tooltip>
              <Switch
                size="small"
                checked={!!newHoliday.repeatsAnnually}
                onChange={(e) =>
                  setNewHoliday((s) => ({
                    ...s,
                    repeatsAnnually: e.target.checked,
                  }))
                }
                inputProps={{ "aria-label": "Repeats annually" }}
                sx={{ gridArea: "sw", justifySelf: { xs: "center" } }}
              />
              <Box sx={{ gridArea: "date", flex: "0 0 130px", minWidth: 0 }}>
                <DateField
                  value={newHoliday.date}
                  onChange={(iso) =>
                    setNewHoliday((s) => ({ ...s, date: iso }))
                  }
                />
              </Box>
              <TextField
                size="small"
                value={newHoliday.name}
                onChange={(e) =>
                  setNewHoliday((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="New holiday"
                sx={{ gridArea: "name", flex: "1 1 0", minWidth: 0 }}
              />
              <IconButton
                size="small"
                onClick={addHoliday}
                aria-label="Add holiday"
                color="primary"
                sx={{
                  gridArea: "del",
                  alignSelf: "center",
                  justifySelf: "center",
                  minWidth: 40,
                  minHeight: 40,
                }}
              >
                <MdAdd />
              </IconButton>
            </Box>
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 1.5 }}
          >
            Use the repeat toggle to recur a holiday every year your horizon
            covers; otherwise add future-year dates manually.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHolidaysOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(csvPrompt)} onClose={() => setCsvPrompt(null)}>
        <DialogTitle>Import holidays</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Found {csvPrompt?.parsed} holiday
            {csvPrompt?.parsed === 1 ? "" : "s"}
            {csvPrompt?.skipped
              ? ` (${csvPrompt.skipped} row${csvPrompt.skipped === 1 ? "" : "s"} skipped)`
              : ""}
            . Replace your current list, or merge into it (de-duplicating by
            date)?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCsvPrompt(null)}>Cancel</Button>
          <Button onClick={() => applyCsv("merge")}>
            Merge &amp; de-duplicate
          </Button>
          <Button variant="contained" onClick={() => applyCsv("replace")}>
            Replace
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
