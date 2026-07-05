import { polyline, scalePoints, type Point } from './trends-geometry'

const W = 300
const H = 140
const PAD = 24

export function TrendChart({
  title,
  unit,
  points,
  colorHex,
  yMin,
  yMax,
  threshold,
}: {
  title: string
  unit: string
  points: Point[]
  colorHex: string
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
    <div className="rounded-lg border border-line bg-surface p-3">
      <h3 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
        {title} <span className="text-ink-muted/70">{unit}</span>
      </h3>
      {points.length === 0 ? (
        <p className="flex h-[140px] items-center justify-center text-xs text-ink-muted">
          No data yet
        </p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title} trend`}>
          {thresholdY !== undefined && (
            <line
              x1={PAD}
              x2={W - PAD}
              y1={thresholdY}
              y2={thresholdY}
              stroke="#f0525f"
              strokeDasharray="3 3"
              strokeWidth={1}
              opacity={0.6}
            />
          )}
          {scaled.length > 1 && (
            <polyline points={polyline(scaled)} fill="none" stroke={colorHex} strokeWidth={1.5} />
          )}
          {scaled.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={3} fill={colorHex} />
          ))}
        </svg>
      )}
    </div>
  )
}
