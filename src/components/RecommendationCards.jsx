import { Box, Card, CardActionArea, CardContent, Chip, Typography } from '@mui/material';
import { OBJECTIVE_ORDER, OBJECTIVE_META, fmtLeaves, fmtEfficiency, ROLE_COLORS } from '../uiMeta.js';
import { formatShort } from '../domain/dates.js';

function Composition({ win }) {
  const parts = [
    { n: win.weekends, cls: 'role-weekend' },
    { n: win.holidays, cls: 'role-holiday' },
    { n: win.wfhDays, cls: 'role-wfh' },
    { n: win.sickSpent + win.annualSpent, cls: 'role-leave' },
  ].filter((p) => p.n > 0);
  const total = parts.reduce((a, p) => a + p.n, 0) || 1;

  return (
    <Box
      title="Make-up of the stretch"
      sx={{
        display: 'flex',
        height: 6,
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'action.hover',
        my: 1,
      }}
    >
      {parts.map((p, i) => (
        <Box
          key={i}
          sx={{
            flexGrow: p.n / total,
            bgcolor: ROLE_COLORS[p.cls],
            minWidth: p.n > 0 ? 4 : 0,
          }}
        />
      ))}
    </Box>
  );
}

function RecoCard({ meta, data, selected, onSelect }) {
  const win = data?.best;

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderColor: selected ? 'primary.main' : 'divider',
        borderWidth: selected ? 2 : 1,
      }}
    >
      <CardActionArea
        disabled={!win}
        onClick={() => win && onSelect(meta.key, win)}
        sx={{ height: '100%', alignItems: 'stretch' }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              {meta.short}
            </Typography>
            {win ? (
              <Chip label={fmtEfficiency(win.efficiency)} size="small" color="primary" variant="outlined" />
            ) : null}
          </Box>
          {win ? (
            <>
              <Typography variant="h5" component="div" sx={{ lineHeight: 1.2 }}>
                <Box component="span" fontWeight={700}>
                  {win.length}
                </Box>{' '}
                days off
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                {formatShort(win.startIso)} → {formatShort(win.endIso)}
              </Typography>
              <Composition win={win} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                {win.leaves > 0 ? (
                  <Chip
                    label={`${fmtLeaves(win.leaves)} leave${win.leaves === 1 ? '' : 's'}`}
                    size="small"
                    sx={{ bgcolor: ROLE_COLORS['role-leave'], color: '#fff' }}
                  />
                ) : (
                  <Chip label="0 leaves" size="small" variant="outlined" />
                )}
                {win.wfhDays > 0 ? (
                  <Chip
                    label={`${win.wfhDays} WFH`}
                    size="small"
                    sx={{ bgcolor: ROLE_COLORS['role-wfh'], color: '#fff' }}
                  />
                ) : null}
                {win.blockWeeks > 0 ? (
                  <Chip label={`${win.blockWeeks}-wk block`} size="small" variant="outlined" />
                ) : null}
              </Box>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No feasible window in range.
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {meta.desc}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function RecommendationCards({ result, selectedKey, onSelect }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        gap: 1.5,
      }}
    >
      {OBJECTIVE_ORDER.map((key) => (
        <RecoCard
          key={key}
          meta={OBJECTIVE_META[key]}
          data={result[key]}
          selected={selectedKey === key}
          onSelect={onSelect}
        />
      ))}
    </Box>
  );
}
