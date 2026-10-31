export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color: string;
  /** 占比，由上层用最大余数法算好，保证合计 100 */
  percent: number;
}

interface DonutChartProps {
  slices: DonutSlice[];
  centerValue: string;
  centerLabel: string;
  size?: number;
  thickness?: number;
}

export function DonutChart({
  slices,
  centerValue,
  centerLabel,
  size = 168,
  thickness = 16,
}: DonutChartProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let offset = 0;
  const arcs = slices.map((slice) => {
    const length = total > 0 ? (slice.value / total) * circumference : 0;
    const arc = { ...slice, length, offset };
    offset += length;
    return arc;
  });

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="标签时间占比">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--surface-soft)"
          strokeWidth={thickness}
        />
        {arcs.map((arc) =>
          arc.length > 0 ? (
            <circle
              key={arc.id}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={thickness}
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              strokeDashoffset={-arc.offset}
              transform={`rotate(-90 ${center} ${center})`}
            >
              <title>{`${arc.label} · ${Math.round(arc.value)} 分钟`}</title>
            </circle>
          ) : null,
        )}
      </svg>
      <div className="donut-center">
        <span className="donut-value">{centerValue}</span>
        <span className="donut-label">{centerLabel}</span>
      </div>
    </div>
  );
}