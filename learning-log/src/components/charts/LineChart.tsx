import { useId } from 'react';

export interface LinePoint {
  label: string;
  value: number;
  title?: string;
}

interface LineChartProps {
  data: LinePoint[];
  height?: number;
  unit?: string;
}

const WIDTH = 640;

export function LineChart({ data, height = 200, unit = '分钟' }: LineChartProps) {
  const rawId = useId();
  const gradientId = `line-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const pad = { l: 38, r: 12, t: 14, b: 24 };
  const innerW = WIDTH - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const n = data.length;

  if (n === 0) {
    return <div className="chart-empty">该区间还没有打卡记录</div>;
  }

  const maxValue = Math.max(0, ...data.map((d) => d.value));
  const yMax = maxValue <= 0 ? 30 : Math.ceil(maxValue / 30) * 30;

  const xAt = (i: number) => (n <= 1 ? pad.l + innerW / 2 : pad.l + (i * innerW) / (n - 1));
  const yAt = (v: number) => pad.t + (1 - v / yMax) * innerH;
  const baseY = pad.t + innerH;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(2)},${yAt(d.value).toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L${xAt(n - 1).toFixed(2)},${baseY} L${xAt(0).toFixed(2)},${baseY} Z`;

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((yMax / tickCount) * i));
  const xStep = Math.max(1, Math.ceil(n / 6));
  const xTicks = data
    .map((d, i) => ({ label: d.label, i }))
    .filter(({ i }) => i % xStep === 0 || i === n - 1);

  return (
    <div className="chart-wrap">
      <svg
        className="chart-svg"
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={`时长趋势，共 ${n} 个数据点`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={WIDTH - pad.r} y1={yAt(v)} y2={yAt(v)} className="chart-grid" />
            <text
              x={pad.l - 8}
              y={yAt(v)}
              className="chart-axis"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {v}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} className="chart-line" vectorEffect="non-scaling-stroke" />

        {data.map((d, i) =>
          d.value > 0 ? (
            <circle key={i} cx={xAt(i)} cy={yAt(d.value)} r={3} className="chart-dot">
              <title>{`${d.title ?? d.label} · ${d.value} ${unit}`}</title>
            </circle>
          ) : null,
        )}

        {xTicks.map(({ label, i }) => (
          <text
            key={i}
            x={xAt(i)}
            y={height - 6}
            className="chart-axis"
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}