import { Box, Button, Card, CardContent, Chip, Typography } from '@mui/material';
import { MdArrowRightAlt } from 'react-icons/md';
import { OBJECTIVE_META, fmtLeaves, fmtEfficiency, TONE_COLORS, ROLE_COLORS } from '../uiMeta.js';
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
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Save-up strategy · {meta.short}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Target window {formatShort(target.range.start)} → {formatShort(target.range.end)}. Bank your leaves until the
          window opens, then spend them as below.
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 2 }}>
          <Typography variant="body2">By {formatShort(target.range.start)} you will have</Typography>
          <Typography component="span" fontWeight={700} sx={{ color: TONE_COLORS['tone-sick'] }}>
            {fmtLeaves(budget.sick)} sick
          </Typography>
          <Typography variant="body2">+</Typography>
          <Typography component="span" fontWeight={700} sx={{ color: TONE_COLORS['tone-annual'] }}>
            {fmtLeaves(budget.annual)} planned
          </Typography>
          <Typography variant="body2">= {fmtLeaves(budget.spendable)} spendable days.</Typography>
        </Box>

        {!plan ? (
          <Typography variant="body2" color="warning.main">
            No feasible stretch fits inside this window with the available balance. Widen the window or accrue more leave.
          </Typography>
        ) : (
          <>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => onSelect(focusKey, plan)}
              sx={{
                justifyContent: 'space-between',
                textAlign: 'left',
                py: 1.5,
                px: 2,
                mb: 1.5,
                textTransform: 'none',
              }}
            >
              <Box>
                <Typography variant="body1">
                  <Box component="span" fontWeight={700}>
                    {plan.length}
                  </Box>{' '}
                  continuous days out of office
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {formatHuman(plan.startIso)} <MdArrowRightAlt /> {formatHuman(plan.endIso)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                <Chip
                  label={`${fmtLeaves(plan.leaves)} leaves`}
                  size="small"
                  sx={{ bgcolor: ROLE_COLORS['role-leave'], color: '#fff' }}
                />
                <Chip label={fmtEfficiency(plan.efficiency)} size="small" variant="outlined" />
              </Box>
            </Button>

            {plan.leaves === 0 ? (
              <Typography variant="caption" color="success.main" sx={{ display: 'block', mb: 1 }}>
                This window needs no leave at all — it is fully covered by WFH, holidays and weekends.
              </Typography>
            ) : (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                  Apply leave on:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {leaveDays.map((d) => (
                    <Chip
                      key={d.iso}
                      size="small"
                      label={
                        <>
                          {formatShort(d.iso)}{' '}
                          <Box component="span" sx={{ fontStyle: 'italic', opacity: 0.9 }}>
                            {d.leaveType === 'SICK' ? 'sick' : 'planned'}
                          </Box>
                        </>
                      }
                      sx={{
                        bgcolor: d.leaveType === 'SICK' ? TONE_COLORS['tone-sick'] : TONE_COLORS['tone-annual'],
                        color: '#fff',
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {usesSick && crossesYear ? (
              <Typography variant="caption" color="warning.main">
                Heads up: sick leave does not carry into the next year. The sick days above must fall before Dec 31 of{' '}
                {year(plan.startIso)}.
              </Typography>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
