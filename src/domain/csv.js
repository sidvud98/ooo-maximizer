// Minimal CSV parsing for holiday import. Expects a header row containing
// `date` (YYYY-MM-DD) and `name` columns. Quoted fields and commas inside
// quotes are supported on a single line; rows with an invalid date are skipped.

function parseLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseHolidaysCsv(text) {
  const lines = String(text)
    .split(/\r\n|\r|\n/)
    .filter((l) => l.trim() !== '');
  if (!lines.length) return { holidays: [], parsed: 0, skipped: 0, error: 'The file is empty.' };

  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  const dateIdx = header.indexOf('date');
  const nameIdx = header.indexOf('name');
  if (dateIdx === -1 || nameIdx === -1) {
    return { holidays: [], parsed: 0, skipped: 0, error: 'CSV needs a header row with "date" and "name" columns.' };
  }

  const holidays = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const date = (cols[dateIdx] || '').trim();
    const name = (cols[nameIdx] || '').trim();
    if (!ISO_RE.test(date)) {
      skipped += 1;
      continue;
    }
    holidays.push({ date, name: name || 'Holiday' });
  }
  return { holidays, parsed: holidays.length, skipped, error: null };
}
