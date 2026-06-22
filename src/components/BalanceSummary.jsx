import { Box, Card, CardContent, Typography } from '@mui/material';
import { fmtLeaves, TONE_COLORS } from '../uiMeta.js';
import { formatShort } from '../domain/dates.js';

function Stat({ value, label, sub, tone }) {
  const color = TONE_COLORS[tone];
  return (
    <Card variant="outlined" sx={{ flex: '1 1 100px', minWidth: 0 }}>
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="h5" fontWeight={700} sx={{ color, lineHeight: 1.2 }}>
          {value}
        </Typography>
        <Typography variant="caption" fontWeight={600} display="block">
          {label}
        </Typography>
        {sub ? (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
            {sub}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function BalanceSummary({ balances, asOfIso }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, minWidth: 0 }}>
      <Stat
        value={fmtLeaves(balances.sick)}
        label="Sick leave"
        sub={balances.sickOverridden ? 'manual override' : `accrued by ${formatShort(asOfIso)}`}
        tone="tone-sick"
      />
      <Stat
        value={fmtLeaves(balances.annual)}
        label="Annual leave"
        sub={balances.annualOverridden ? 'manual override' : `accrued by ${formatShort(asOfIso)}`}
        tone="tone-annual"
      />
      <Stat
        value={fmtLeaves(balances.spendable)}
        label="Spendable days"
        sub="whole sick + whole annual days"
        tone="tone-total"
      />
    </Box>
  );
}
