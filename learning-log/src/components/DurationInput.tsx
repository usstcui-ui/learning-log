const PRESETS = [15, 30, 45, 60, 90];

interface DurationInputProps {
  value: number | '';
  onChange: (next: number | '') => void;
  invalid?: boolean;
}

export function DurationInput({ value, onChange, invalid }: DurationInputProps) {
  return (
    <div className="duration-input">
      <input
        className={`input${invalid ? ' invalid' : ''}`}
        type="number"
        inputMode="numeric"
        min={1}
        max={1440}
        step={5}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange('');
          const n = Number(raw);
          onChange(Number.isNaN(n) ? '' : n);
        }}
        aria-label="学习时长（分钟）"
      />
      <span style={{ color: 'var(--muted)', fontSize: 13 }}>分钟</span>
      <div className="chip-row">
        {PRESETS.map((preset) => (
          <button
            type="button"
            key={preset}
            className={`chip${value === preset ? ' active' : ''}`}
            onClick={() => onChange(preset)}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}