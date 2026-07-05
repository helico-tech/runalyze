import { BRAND } from '../brand'
import { ADS_GAP_THRESHOLD_PCT } from '../../domain/analysis/protocol-constants'
import type {
  Activity,
  AetTestResult,
  AetVerdict,
  AntTestResult,
  Series,
  TestResult,
  TimeRange,
} from '../../domain/model/types'
import type { AdsStatus } from '../../domain/analysis/ads-assessment'
import { CHANNELS } from '../channels'
import { formatBpm, formatDate } from '../format'
import { polyline, scalePoints, type Point } from '../screens/trends/trends-geometry'

export const EXPORT_W = 1200
export const EXPORT_H = 630

const BG = '#0b0e14'
const SURFACE = '#131720'
const LINE = '#232b36'
const INK = '#e6ebf0'
const MUTED = '#8a97a5'
const HR = '#ff6b6b'
const PACE = '#4cc9f0'

const AET_LABEL: Record<string, string> = {
  'above-aet': 'Above AeT',
  'at-aet': 'At AeT',
  'below-aet': 'Below AeT',
}

function windowPoints(series: Series, window: TimeRange, maxN = 240): Point[] {
  const pts: Point[] = []
  for (let i = 0; i < series.t.length; i++) {
    const t = series.t[i]!
    if (t < window.startS) continue
    if (t >= window.endS) break
    if (Number.isFinite(series.v[i]!)) pts.push({ t, v: series.v[i]! })
  }
  if (pts.length <= maxN) return pts
  const stride = Math.ceil(pts.length / maxN)
  return pts.filter((_, i) => i % stride === 0)
}

const CW = 1120
const CH = 250
const CPAD = 8

function MiniChart({ activity, window }: { activity: Activity; window: TimeRange }) {
  const hr = activity.channels.heartRate
  const speed = activity.channels.speed
  const mid = (window.startS + window.endS) / 2
  const midFrac = (mid - window.startS) / (window.endS - window.startS || 1)
  const line = (series: Series | undefined, color: string) => {
    if (!series) return null
    const pts = windowPoints(series, window)
    if (pts.length < 2) return null
    return (
      <polyline points={polyline(scalePoints(pts, CW, CH, CPAD))} fill="none" stroke={color} strokeWidth={2} />
    )
  }
  return (
    <svg width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`}>
      <rect x={0} y={0} width={CW * midFrac} height={CH} fill="rgba(76,201,240,0.05)" />
      <rect x={CW * midFrac} y={0} width={CW * (1 - midFrac)} height={CH} fill="rgba(76,201,240,0.10)" />
      <line x1={CW * midFrac} y1={0} x2={CW * midFrac} y2={CH} stroke={INK} strokeOpacity={0.3} strokeWidth={1} />
      {line(speed, PACE)}
      {line(hr, HR)}
    </svg>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-export-card
      style={{
        width: EXPORT_W,
        height: EXPORT_H,
        background: BG,
        color: INK,
        fontFamily: "'IBM Plex Mono', monospace",
        padding: 40,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: 6, textTransform: 'uppercase' }}>
          {BRAND}
        </span>
        <span style={{ fontSize: 16, color: MUTED, letterSpacing: 3, textTransform: 'uppercase' }}>
          aerobic base lab
        </span>
      </div>
      {children}
    </div>
  )
}

export function TestExportCard({ activity, result }: { activity: Activity; result: TestResult }) {
  const isAet = result.kind === 'aet'
  const aet = isAet ? (result as AetTestResult) : null
  const primary = aet ? (aet.pace ?? aet.power) : null
  const headline = aet
    ? primary
      ? `${primary.decouplingPct.toFixed(1)}%`
      : '—'
    : formatBpm((result as AntTestResult).antHr)
  const badge = aet ? (primary ? AET_LABEL[primary.verdict] : 'AeT') : 'AnT HR'
  const channelLine = (label: string, ch: { decouplingPct: number; verdict: AetVerdict } | null) =>
    ch ? (
      <span>
        {label} <span style={{ color: INK }}>{ch.decouplingPct.toFixed(1)}%</span> (
        {AET_LABEL[ch.verdict]})
      </span>
    ) : null
  return (
    <Frame>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20 }}>
        <div>
          <div style={{ fontSize: 15, color: MUTED, letterSpacing: 3, textTransform: 'uppercase' }}>
            {isAet ? 'AeT test · decoupling' : 'AnT test'}
          </div>
          <div style={{ fontSize: 96, fontWeight: 600, lineHeight: 1 }}>{headline}</div>
        </div>
        <div
          style={{
            fontSize: 20,
            color: BG,
            background: INK,
            padding: '6px 14px',
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          {badge}
        </div>
      </div>
      {aet && (
        <div style={{ marginTop: 12, fontSize: 20, color: MUTED, display: 'flex', gap: 24 }}>
          {channelLine('Pa:HR', aet.pace)}
          {channelLine('Pw:HR', aet.power)}
        </div>
      )}
      <div style={{ marginTop: 16, fontSize: 20, color: MUTED }}>
        {aet && aet.aetHr !== null && (
          <span>
            AeT HR <span style={{ color: HR }}>{formatBpm(aet.aetHr)}</span> ·{' '}
          </span>
        )}
        <span>
          window avg HR <span style={{ color: HR }}>{formatBpm(result.windowAvgHr)}</span>
        </span>
        <span style={{ float: 'right', color: MUTED }}>{formatDate(result.testDate)}</span>
      </div>
      <div style={{ marginTop: 20, border: `1px solid ${LINE}`, borderRadius: 8, background: SURFACE, padding: 8 }}>
        <MiniChart activity={activity} window={result.window} />
      </div>
    </Frame>
  )
}

function channelSwatch(key: string): string {
  return CHANNELS.find((c) => c.key === key)?.colorHex ?? INK
}

export function AdsExportCard({ status }: { status: AdsStatus }) {
  if (status.state !== 'assessed') {
    return (
      <Frame>
        <div style={{ marginTop: 60, fontSize: 40, color: MUTED }}>ADS assessment unavailable</div>
      </Frame>
    )
  }
  const meterMax = 20
  const gapLeft = `${(Math.min(meterMax, Math.max(0, status.gapPct)) / meterMax) * 100}%`
  const redline = `${(ADS_GAP_THRESHOLD_PCT / meterMax) * 100}%`
  return (
    <Frame>
      <div style={{ marginTop: 20, fontSize: 15, color: MUTED, letterSpacing: 3, textTransform: 'uppercase' }}>
        Aerobic deficiency · AnT − AeT gap
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginTop: 8 }}>
        <div style={{ fontSize: 110, fontWeight: 600, lineHeight: 1 }}>{status.gapPct.toFixed(1)}%</div>
        <div
          style={{
            fontSize: 22,
            color: BG,
            background: status.ads ? '#f0525f' : '#3dd68c',
            padding: '6px 16px',
            borderRadius: 6,
            fontWeight: 600,
            marginBottom: 18,
          }}
        >
          {status.ads ? 'Aerobic deficiency' : 'Balanced'}
        </div>
      </div>
      <div style={{ position: 'relative', height: 14, background: SURFACE, borderRadius: 8, marginTop: 40 }}>
        <div style={{ position: 'absolute', top: -6, left: redline, width: 3, height: 26, background: '#f0525f' }} />
        <div style={{ position: 'absolute', top: -4, left: gapLeft, width: 6, height: 22, background: INK, borderRadius: 3 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 16, color: MUTED }}>
        <span>0</span>
        <span style={{ color: '#f0525f' }}>{ADS_GAP_THRESHOLD_PCT}%</span>
        <span>{meterMax}%</span>
      </div>
      <div style={{ marginTop: 'auto', fontSize: 20, color: MUTED }}>
        AeT <span style={{ color: channelSwatch('heartRate') }}>{formatBpm(status.aet.aetHr)}</span> ·{' '}
        {formatDate(status.aet.testDate)} &nbsp;·&nbsp; AnT{' '}
        <span style={{ color: channelSwatch('heartRate') }}>{formatBpm(status.ant.antHr)}</span> ·{' '}
        {formatDate(status.ant.testDate)}
      </div>
    </Frame>
  )
}
