import { useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { MdAdd, MdClose, MdArrowRightAlt, MdDragIndicator } from 'react-icons/md';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  OBJECTIVE_ORDER,
  OBJECTIVE_META,
  LENGTH_MODE_ORDER,
  LENGTH_MODE_META,
  fmtLeaves,
  ROLE_COLORS,
} from '../uiMeta.js';
import { addDays, formatShort } from '../domain/dates.js';
import { validateStreaks } from '../domain/optimizer.js';
import { DateRangeField } from './DateFields.jsx';

export const MAX_STREAKS = 8;

export function makeStreakId() {
  return `streak-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makeDefaultStreak(streaks, horizon) {
  const last = streaks[streaks.length - 1];
  let start = horizon.start;
  if (last && last.end) {
    const afterLast = addDays(last.end, 1);
    start = afterLast.localeCompare(horizon.start) >= 0 ? afterLast : horizon.start;
  }
  if (start.localeCompare(horizon.end) > 0) start = horizon.end;
  let end = addDays(start, 13);
  if (end.localeCompare(horizon.end) > 0) end = horizon.end;
  return { id: makeStreakId(), objective: 'ANY', lengthMode: 'min', desiredLength: 5, start, end };
}

function Field({ label, children }) {
  return (
    <FormControl fullWidth size="small" sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      {children}
    </FormControl>
  );
}

function StreakResult({ result, selected, onPreview }) {
  if (!result) {
    return (
      <Typography variant="caption" color="text.secondary">
        Click Apply to compute this streak.
      </Typography>
    );
  }
  if (!result.found) {
    return (
      <Alert severity="warning" variant="outlined" sx={{ py: 0, px: 1 }}>
        {result.reason || 'No feasible stretch fits in this window.'}
      </Alert>
    );
  }
  const { plan, achievedLength, shortfall, request } = result;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
      <Chip
        size="small"
        label={`${achievedLength} days off`}
        sx={{ bgcolor: ROLE_COLORS['role-leave'], color: '#fff', fontWeight: 600 }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        {formatShort(plan.startIso)} <MdArrowRightAlt /> {formatShort(plan.endIso)}
      </Typography>
      {plan.leaves > 0 ? (
        <Chip size="small" variant="outlined" label={`${fmtLeaves(plan.leaves)} leave${plan.leaves === 1 ? '' : 's'}`} />
      ) : (
        <Chip size="small" variant="outlined" label="0 leaves" />
      )}
      {shortfall > 0 ? (
        <Chip size="small" color="warning" variant="outlined" label={`${shortfall} short of ${request.desiredLength}`} />
      ) : null}
      <Button size="small" variant={selected ? 'contained' : 'outlined'} onClick={() => onPreview(result)}>
        {selected ? 'Previewing' : 'Preview'}
      </Button>
    </Box>
  );
}

function SortableStreakRow({ streak, index, validity, result, selected, onPatch, onRemove, onPreview }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: streak.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const v = validity || { valid: true, reason: null };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        border: 1,
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: 1,
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: 'text.secondary',
              cursor: 'grab',
              touchAction: 'none',
              '&:active': { cursor: 'grabbing' },
            }}
          >
            <MdDragIndicator />
          </Box>
          <Typography variant="subtitle2" fontWeight={700}>
            Streak {index + 1}
          </Typography>
        </Box>
        <Box
          component="button"
          type="button"
          aria-label="Remove streak"
          onClick={() => onRemove(streak.id)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 0,
            bgcolor: 'transparent',
            cursor: 'pointer',
            color: 'text.secondary',
            p: 0.5,
            borderRadius: 1,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <MdClose />
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <Field label="Type">
          <Select size="small" value={streak.objective} onChange={(e) => onPatch(streak.id, { objective: e.target.value })}>
            {OBJECTIVE_ORDER.map((key) => (
              <MenuItem key={key} value={key}>
                {OBJECTIVE_META[key].short}
              </MenuItem>
            ))}
          </Select>
        </Field>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 88px', gap: 1 }}>
          <Field label="Length">
            <Select
              size="small"
              value={streak.lengthMode}
              onChange={(e) => onPatch(streak.id, { lengthMode: e.target.value })}
            >
              {LENGTH_MODE_ORDER.map((key) => (
                <MenuItem key={key} value={key}>
                  {LENGTH_MODE_META[key].label}
                </MenuItem>
              ))}
            </Select>
          </Field>
          <Field label="Days">
            <TextField
              type="number"
              size="small"
              disabled={streak.lengthMode === 'best'}
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
              value={streak.lengthMode === 'best' ? '' : streak.desiredLength}
              onChange={(e) => onPatch(streak.id, { desiredLength: e.target.value === '' ? '' : Number(e.target.value) })}
            />
          </Field>
        </Box>
      </Box>

      <Field label="Window from / to">
        <DateRangeField
          startValue={streak.start}
          endValue={streak.end}
          onChange={(start, end) => onPatch(streak.id, { start, end })}
        />
      </Field>

      {!v.valid ? (
        <Alert severity="error" variant="outlined" sx={{ py: 0, px: 1 }}>
          {v.reason}
        </Alert>
      ) : (
        <StreakResult result={result} selected={selected} onPreview={onPreview} />
      )}
    </Box>
  );
}

export default function SequencePlanner({
  streaks,
  horizon,
  sequence,
  onChangeStreaks,
  onPreview,
  onApplySuggestion,
  selectedId,
}) {
  const validity = useMemo(() => validateStreaks(streaks, horizon), [streaks, horizon]);
  const validityById = useMemo(() => {
    const map = new Map();
    streaks.forEach((s, i) => map.set(s.id, validity[i]));
    return map;
  }, [streaks, validity]);
  const resultById = useMemo(() => {
    const map = new Map();
    (sequence && sequence.results ? sequence.results : []).forEach((r) => map.set(r.id, r));
    return map;
  }, [sequence]);

  // Windows are the fixed chronological slots (sorted top-to-bottom by start).
  const sorted = useMemo(
    () => [...streaks].sort((a, b) => String(a.start || '').localeCompare(String(b.start || ''))),
    [streaks],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const patchStreak = (id, patch) => onChangeStreaks(streaks.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeStreak = (id) => onChangeStreaks(streaks.filter((s) => s.id !== id));
  const addStreak = () => {
    if (streaks.length >= MAX_STREAKS) return;
    onChangeStreaks([...streaks, makeDefaultStreak(streaks, horizon)]);
  };

  // Insert/shift reorder: the dragged requirement (type/length/days) moves to the
  // new position; the date-windows stay in their chronological slots, so each
  // requirement re-pairs with the window at its new position.
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((s) => s.id === active.id);
    const newIndex = sorted.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const windows = sorted.map((s) => ({ start: s.start, end: s.end }));
    const reqs = sorted.map((s) => ({
      id: s.id,
      objective: s.objective,
      lengthMode: s.lengthMode,
      desiredLength: s.desiredLength,
    }));
    const reqs2 = arrayMove(reqs, oldIndex, newIndex);
    const next = reqs2.map((r, k) => ({ ...r, start: windows[k].start, end: windows[k].end }));
    onChangeStreaks(next);
  };

  const allSatisfied = sequence && sequence.totalShortfall === 0 && sequence.results.every((r) => r.found);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Plan a sequence of streaks
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Define streaks in chronological order. They share one leave pool &mdash; each streak spends from what is left
            after the earlier ones (plus leave accrued in between). Drag the handle to move a requirement to a different
            date-window. Windows must not overlap.
          </Typography>

          {streaks.length === 0 ? (
            <Alert severity="info" variant="outlined" sx={{ mb: 1.5 }}>
              Add a streak to plan a sequence.
            </Alert>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sorted.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <Stack spacing={1.5} sx={{ mb: 1.5 }}>
                  {sorted.map((streak, idx) => (
                    <SortableStreakRow
                      key={streak.id}
                      streak={streak}
                      index={idx}
                      validity={validityById.get(streak.id)}
                      result={resultById.get(streak.id)}
                      selected={selectedId === streak.id}
                      onPatch={patchStreak}
                      onRemove={removeStreak}
                      onPreview={onPreview}
                    />
                  ))}
                </Stack>
              </SortableContext>
            </DndContext>
          )}

          <Button
            startIcon={<MdAdd />}
            variant="outlined"
            onClick={addStreak}
            disabled={streaks.length >= MAX_STREAKS}
            fullWidth
          >
            {streaks.length >= MAX_STREAKS ? `Maximum ${MAX_STREAKS} streaks` : 'Add streak'}
          </Button>
        </CardContent>
      </Card>

      {sequence && allSatisfied ? (
        <Alert severity="success" variant="outlined">
          All streaks satisfied with the current configuration.
        </Alert>
      ) : null}

      {sequence && sequence.suggestion ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Closest match
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Not every streak fit as requested. These small changes to your windows and lengths come closest
              {sequence.suggestion.totalShortfall === 0
                ? ' and satisfy them all'
                : ` (total shortfall ${sequence.suggestion.totalShortfall} day${sequence.suggestion.totalShortfall === 1 ? '' : 's'})`}
              :
            </Typography>
            <Stack spacing={0.75} sx={{ mb: 1.5 }}>
              {sequence.suggestion.changes.map((c, i) => {
                const idx = streaks.findIndex((s) => s.id === c.id);
                const label = idx >= 0 ? `Streak ${idx + 1}` : 'Streak';
                return (
                  <Box key={c.id || i} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {label}:
                    </Typography>
                    {c.startFrom !== c.startTo || c.endFrom !== c.endTo ? (
                      <Typography variant="caption" color="text.secondary">
                        window {formatShort(c.startFrom)}&ndash;{formatShort(c.endFrom)} &rarr; {formatShort(c.startTo)}&ndash;
                        {formatShort(c.endTo)}
                      </Typography>
                    ) : null}
                    {c.lengthFrom !== c.lengthTo ? (
                      <Chip size="small" variant="outlined" label={`length ${c.lengthFrom} → ${c.lengthTo}`} />
                    ) : null}
                  </Box>
                );
              })}
            </Stack>
            <Button variant="contained" onClick={() => onApplySuggestion(sequence.suggestion)}>
              Apply suggestion
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {sequence && !allSatisfied && !sequence.suggestion ? (
        <Alert severity="info" variant="outlined">
          This is already the closest arrangement; relax a window or length to do better.
        </Alert>
      ) : null}
    </Box>
  );
}
