import { polyline, scalePoints, type Point } from './trends-geometry'

const W = 300
const H = 140
const PAD = 24

export function TrendChart({
  title,
  unit,
  points,
  color,
  yMin,
  yMax,
  threshold,
}: {
  title: string
  unit: string
  points: Point[]
  /** any CSS color, incl. theme vars like `var(--ch-hr)` */
  color: string
  yMin?: number
  yMax?: number
  threshold?: number
}) {
  // The threshold line must share the data's y-domain, so fold it into the bounds.
  const vs = points.map((p) => p.v)
  const lo = Math.min(yMin ?? (vs.length ? Math.min(...vs) : 0), threshold ?? Infinity)
  const hi = Math.max(yMax ?? (vs.length ? Math.max(...vs) : 1), threshold ?? -Infinity)
  const scaled = scalePoints(points, W, H, PAD, lo, hi)
  const thresholdY =
    threshold !== undefined
      ? scalePoints([{ t: 0, v: threshold }], W, H, PAD, lo, hi)[0]?.y
      : undefined

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-3">
        {title} <span className="text-fg-3/70">{unit}</span>
      </h3>
      {points.length === 0 ? (
        <p className="flex h-[140px] items-center justify-center text-xs text-fg-3">No data yet</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title} trend`}>
          {thresholdY !== undefined && (
            <line
              x1={PAD}
              x2={W - PAD}
              y1={thresholdY}
              y2={thresholdY}
              stroke="var(--danger)"
              strokeDasharray="3 3"
              strokeWidth={1}
              opacity={0.6}
            />
          )}
          {scaled.length > 1 && (
            <polyline points={polyline(scaled)} fill="none" stroke={color} strokeWidth={1.5} />
          )}
          {scaled.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={3} fill={color} />
          ))}
        </svg>
      )}
    </div>
  )
}
