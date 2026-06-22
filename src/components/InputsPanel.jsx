import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { MdAdd, MdClose } from 'react-icons/md';
import { fmtLeaves } from '../uiMeta.js';

function Field({ label, hint, children }) {
  return (
    <FormControl fullWidth size="small" sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      {children}
      {hint ? <FormHelperText sx={{ mx: 0 }}>{hint}</FormHelperText> : null}
    </FormControl>
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
    const holidays = [...settings.holidays, { ...newHoliday, name: newHoliday.name || 'Holiday' }].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    patch({ holidays });
    setNewHoliday({ date: '', name: '' });
  };

  const fieldRowSx = {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
    gap: 1.5,
  };

  return (
    <Box component="aside" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Your profile
          </Typography>
          <Stack spacing={1.5}>
            <Field label="Joining date" hint="Used to derive accrued sick & annual leave.">
              <TextField
                type="date"
                size="small"
                fullWidth
                value={settings.joiningDate}
                onChange={(e) => patch({ joiningDate: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Field>
            <Box sx={fieldRowSx}>
              <Field label="Sick balance" hint={`Derived: ${fmtLeaves(balances.derivedSick)}`}>
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
              <Field label="Annual balance" hint={`Derived: ${fmtLeaves(balances.derivedAnnual)}`}>
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
              Leave the balance fields empty to use the derived values. Type a number to override.
            </Typography>
            <Box sx={fieldRowSx}>
              <Field label="Sick / month" hint="Accrual rate (default 1).">
                <TextField
                  type="number"
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                  value={settings.sickPerMonth}
                  onChange={(e) => patch({ sickPerMonth: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </Field>
              <Field label="Annual / quarter" hint="Accrual rate (default 4.5).">
                <TextField
                  type="number"
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                  value={settings.annualPerQuarter}
                  onChange={(e) => patch({ annualPerQuarter: e.target.value === '' ? '' : Number(e.target.value) })}
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
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Over what period am I willing to plan?
          </Typography>
          <Box sx={fieldRowSx}>
            <Field label="From">
              <TextField
                type="date"
                size="small"
                fullWidth
                value={settings.horizonStart}
                onChange={(e) => patch({ horizonStart: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Field>
            <Field label="To">
              <TextField
                type="date"
                size="small"
                fullWidth
                value={settings.horizonEnd}
                onChange={(e) => patch({ horizonEnd: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Field>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Target window
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={settings.targetEnabled}
                  onChange={(e) => patch({ targetEnabled: e.target.checked })}
                />
              }
              label={<Typography variant="caption">Plan a specific window</Typography>}
              sx={{ mr: 0 }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            I already know when I want time off — what&apos;s the best way to use my leaves in that slot?
          </Typography>
          <Box sx={{ ...fieldRowSx, opacity: settings.targetEnabled ? 1 : 0.5, pointerEvents: settings.targetEnabled ? 'auto' : 'none' }}>
            <Field label="Window from">
              <TextField
                type="date"
                size="small"
                fullWidth
                disabled={!settings.targetEnabled}
                value={settings.targetStart}
                onChange={(e) => patch({ targetStart: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Field>
            <Field label="Window to">
              <TextField
                type="date"
                size="small"
                fullWidth
                disabled={!settings.targetEnabled}
                value={settings.targetEnd}
                onChange={(e) => patch({ targetEnd: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Field>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Rules
          </Typography>
          <Box sx={fieldRowSx}>
            <Field label="Min office days/week" hint="Full week, no leave. 3 = standard 50% rule.">
              <TextField
                type="number"
                size="small"
                fullWidth
                slotProps={{ htmlInput: { min: 0, max: 5, step: 1 } }}
                value={settings.officeMin}
                onChange={(e) => patch({ officeMin: e.target.value === '' ? '' : Number(e.target.value) })}
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
              <FormHelperText>One continuous block per half-year (None disables it).</FormHelperText>
            </FormControl>
          </Box>
          <Box component="ul" sx={{ m: '12px 0 0', pl: 2.5, color: 'text.secondary' }}>
            <Typography component="li" variant="caption" sx={{ mb: 0.5 }}>
              Office {settings.officeMin === '' ? 3 : settings.officeMin} days/week, minus 1 per holiday/leave (never below
              the 50% rule)
            </Typography>
            <Typography component="li" variant="caption" sx={{ mb: 0.5 }}>
              WFH capped at 2 days/week (unless inside a WFH block)
            </Typography>
            <Typography component="li" variant="caption" sx={{ mb: 0.5 }}>
              {Number(settings.blockLen) === 0
                ? 'No half-yearly WFH block'
                : `One ${Number(settings.blockLen) === 4 ? 4 : 2}-week WFH block per half-year, back-to-back across Jun/Jul allowed`}
            </Typography>
            <Typography component="li" variant="caption">
              {settings.sickPerMonth === '' ? 1 : settings.sickPerMonth} sick/month (no carry-forward) ·{' '}
              {settings.annualPerQuarter === '' ? 4.5 : settings.annualPerQuarter} annual/quarter (carries forward)
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Public holidays
          </Typography>
          <Stack spacing={1}>
            {settings.holidays.map((h, idx) => (
              <Box
                key={`${h.date}-${idx}`}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 40px',
                  gap: 0.75,
                  alignItems: 'center',
                }}
              >
                <TextField
                  type="date"
                  size="small"
                  value={h.date}
                  onChange={(e) => updateHoliday(idx, 'date', e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  size="small"
                  value={h.name}
                  onChange={(e) => updateHoliday(idx, 'name', e.target.value)}
                  placeholder="Name"
                />
                <IconButton size="small" onClick={() => removeHoliday(idx)} aria-label="Remove holiday" sx={{ minWidth: 40, minHeight: 40 }}>
                  <MdClose />
                </IconButton>
              </Box>
            ))}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 40px',
                gap: 0.75,
                alignItems: 'center',
              }}
            >
              <TextField
                type="date"
                size="small"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday((s) => ({ ...s, date: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                size="small"
                value={newHoliday.name}
                onChange={(e) => setNewHoliday((s) => ({ ...s, name: e.target.value }))}
                placeholder="New holiday"
              />
              <IconButton size="small" onClick={addHoliday} aria-label="Add holiday" color="primary" sx={{ minWidth: 40, minHeight: 40 }}>
                <MdAdd />
              </IconButton>
            </Box>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            Add 2027 holidays here if your horizon extends into next year.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
