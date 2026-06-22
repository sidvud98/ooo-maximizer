import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { OBJECTIVE_META, fmtLeaves, fmtEfficiency } from '../uiMeta.js';
import { formatShort } from '../domain/dates.js';

export default function WindowsTable({ objectiveKey, candidates, selectedWin, onSelect }) {
  const meta = OBJECTIVE_META[objectiveKey];

  if (!candidates || candidates.length === 0) {
    return (
      <Box>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Top windows · {meta.short}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No qualifying windows in the current horizon. Try widening the horizon or adding balance.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Top windows · {meta.short}
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: '100%', overflowX: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Start</TableCell>
              <TableCell>End</TableCell>
              <TableCell align="right">Days off</TableCell>
              <TableCell align="right">Workdays</TableCell>
              <TableCell align="right">Planned</TableCell>
              <TableCell align="right">Sick</TableCell>
              <TableCell align="right">WFH</TableCell>
              <TableCell align="right">Block</TableCell>
              <TableCell align="right">Efficiency</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {candidates.map((w, i) => {
              const isSel = selectedWin && selectedWin.startIso === w.startIso && selectedWin.endIso === w.endIso;
              return (
                <TableRow
                  key={`${w.startIso}-${w.endIso}`}
                  hover
                  selected={isSel}
                  onClick={() => onSelect(w)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{formatShort(w.startIso)}</TableCell>
                  <TableCell>{formatShort(w.endIso)}</TableCell>
                  <TableCell align="right">
                    <Typography component="span" fontWeight={700}>
                      {w.length}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{w.workdaysBridged}</TableCell>
                  <TableCell align="right">{fmtLeaves(w.annualSpent)}</TableCell>
                  <TableCell align="right">{fmtLeaves(w.sickSpent)}</TableCell>
                  <TableCell align="right">{w.wfhDays}</TableCell>
                  <TableCell align="right">{w.blockWeeks || '–'}</TableCell>
                  <TableCell align="right">{fmtEfficiency(w.efficiency)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Efficiency = days off per leave spent. &ldquo;free&rdquo; means zero leaves used. Click a row to preview it on the
        calendar.
      </Typography>
    </Box>
  );
}
