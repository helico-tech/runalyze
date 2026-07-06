import { useEffect, useState } from 'react'
import { computeZones, resolveThresholds } from '../../../domain/analysis/zones'
import type { Activity, TestResult, Thresholds } from '../../../domain/model/types'
import { formatDuration } from '../../format'

const ZONE_COLORS = { below: 'var(--ch-pace)', mid: 'var(--ch-cadence)', above: 'var(--ch-hr)' }

export function ZonesPanel({
  activity,
  thresholds,
  tests,
  onSave,
}: {
  activity: Activity
  thresholds: Thresholds | null
  tests: TestResult[]
  onSave: (aetHr: number | null, antHr: number | null) => void | Promise<void>
}) {
  const resolved = resolveThresholds(activity.id, thresholds, tests)
  const zones = computeZones(activity, resolved)

  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-3">
        Zones
      </h3>
      <div className="rounded-xl border border-line bg-panel p-4">
        {zones.ok ? (
          <ZoneBar zones={zones} />
        ) : (
          <p className="mb-2 text-xs text-fg-3">
            {zones.reason === 'no-hr'
              ? 'No heart-rate data on this run.'
              : zones.reason === 'invalid-order'
                ? 'AeT must be below AnT.'
                : 'Set your thresholds to see time-in-zone.'}
          </p>
        )}
        {(zones.ok || zones.reason !== 'no-hr') && (
          <ThresholdEditor aet={resolved.aetHr} ant={resolved.antHr} onSave={onSave} />
        )}
      </div>
    </section>
  )
}

function ZoneBar({ zones }: { zones: Extract<ReturnType<typeof computeZones>, { ok: true }> }) {
  const total = zones.totalS || 1
  const rows = [
    { label: 'Below AeT', s: zones.belowAetS, color: ZONE_COLORS.below },
    { label: `AeT–AnT`, s: zones.aetToAntS, color: ZONE_COLORS.mid },
    { label: 'Above AnT', s: zones.aboveAntS, color: ZONE_COLORS.above },
  ]
  return (
    <div className="mb-3">
      <div className="mb-2 flex h-3 overflow-hidden rounded">
        {rows.map((r) => (
          <div key={r.label} style={{ width: `${(r.s / total) * 100}%`, background: r.color }} />
        ))}
      </div>
      <table className="w-full font-mono text-sm tabular-nums">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="py-0.5 pr-3">
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-sm align-middle"
                  style={{ background: r.color }}
                />
                {r.label}
              </td>
              <td className="py-0.5 pr-3 text-right">{formatDuration(r.s)}</td>
              <td className="py-0.5 text-right text-fg-3">{Math.round((r.s / total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ThresholdEditor({
  aet,
  ant,
  onSave,
}: {
  aet: number | null
  ant: number | null
  onSave: (aetHr: number | null, antHr: number | null) => void | Promise<void>
}) {
  const [aetStr, setAetStr] = useState(aet === null ? '' : String(aet))
  const [antStr, setAntStr] = useState(ant === null ? '' : String(ant))
  useEffect(() => {
    setAetStr(aet === null ? '' : String(aet))
    setAntStr(ant === null ? '' : String(ant))
  }, [aet, ant])
  const parse = (s: string): number | null => {
    const n = Number.parseInt(s, 10)
    return Number.isFinite(n) ? n : null
  }
  return (
    <div className="flex items-end gap-2 font-mono text-xs">
      <label className="flex flex-col gap-1 text-fg-3">
        AeT
        <input
          data-testid="aet-input"
          className="w-16 rounded-lg border border-line bg-sunk px-2 py-1.5 tabular-nums text-fg"
          value={aetStr}
          onChange={(e) => setAetStr(e.target.value)}
          inputMode="numeric"
        />
      </label>
      <label className="flex flex-col gap-1 text-fg-3">
        AnT
        <input
          data-testid="ant-input"
          className="w-16 rounded-lg border border-line bg-sunk px-2 py-1.5 tabular-nums text-fg"
          value={antStr}
          onChange={(e) => setAntStr(e.target.value)}
          inputMode="numeric"
        />
      </label>
      <button
        type="button"
        className="rounded-lg border border-line bg-panel-2 px-3 py-1.5 font-medium text-fg transition-colors hover:bg-sunk"
        onClick={() => void onSave(parse(aetStr), parse(antStr))}
      >
        Save
      </button>
    </div>
  )
}
