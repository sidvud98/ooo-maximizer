import { DatePicker } from 'antd';
import dayjs from 'dayjs';

const ISO_FORMAT = 'YYYY-MM-DD';

function toDayjs(iso) {
  return iso ? dayjs(iso) : null;
}

function fromDayjs(d) {
  return d ? d.format(ISO_FORMAT) : '';
}

// Single date picker that reads/writes plain ISO strings ('YYYY-MM-DD'), so the
// rest of the app (and src/domain/*) keeps using ISO strings unchanged.
export function DateField({ value, onChange, disabled = false, placeholder, allowClear = true }) {
  return (
    <div className="mui-datefield">
      <DatePicker
        value={toDayjs(value)}
        onChange={(d) => onChange(fromDayjs(d))}
        disabled={disabled}
        placeholder={placeholder}
        allowClear={allowClear}
        format={ISO_FORMAT}
        inputReadOnly={false}
      />
    </div>
  );
}

// Range picker over two ISO strings. onChange(startIso, endIso) with '' for an
// empty end of the range.
export function DateRangeField({ startValue, endValue, onChange, disabled = false, allowClear = true }) {
  return (
    <div className="mui-datefield">
      <DatePicker.RangePicker
        value={[toDayjs(startValue), toDayjs(endValue)]}
        onChange={(dates) => {
          const [s, e] = dates || [null, null];
          onChange(fromDayjs(s), fromDayjs(e));
        }}
        disabled={disabled}
        allowClear={allowClear}
        format={ISO_FORMAT}
      />
    </div>
  );
}
