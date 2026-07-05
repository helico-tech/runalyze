import { useState } from 'react'
import type { AdsStatus } from '../../../domain/analysis/ads-assessment'
import { ADS_GAP_THRESHOLD_PCT } from '../../../domain/analysis/protocol-constants'
import type { ImageRenderer } from '../../../domain/ports/image-renderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExportPreview } from '../../export/export-preview'
import { AdsExportCard } from '../../export/export-card'
import { formatDate } from '../../format'

const METER_MAX_PCT = 20
const DAY_MS = 86_400_000

function ThresholdMeter({ gapPct }: { gapPct: number | null }) {
  const clamped = gapPct === null ? null : Math.max(0, Math.min(METER_MAX_PCT, gapPct))
  const redlineLeft = `${(ADS_GAP_THRESHOLD_PCT / METER_MAX_PCT) * 100}%`
  return (
    <div aria-hidden className="relative mb-6 mt-3 h-2 rounded-full bg-surface-2">
      <div className="absolute top-[-4px] h-4 w-0.5 bg-danger/70" style={{ left: redlineLeft }} />
      {clamped !== null && (
        <div
          className="absolute top-[-3px] h-3.5 w-1 rounded-sm bg-ink transition-[left]"
          style={{ left: `calc(${(clamped / METER_MAX_PCT) * 100}% - 2px)` }}
        />
      )}
      <div className="absolute inset-x-0 top-3 flex justify-between font-mono text-[10px] text-ink-muted">
        <span>0</span>
        <span className="text-danger/80">{ADS_GAP_THRESHOLD_PCT}</span>
        <span>{METER_MAX_PCT}%</span>
      </div>
    </div>
  )
}

function Provenance({
  status,
  now,
}: {
  status: Extract<AdsStatus, { state: 'assessed' }>
  now: Date
}) {
  const daysAgo = (d: Date) => Math.floor((now.getTime() - d.getTime()) / DAY_MS)
  return (
    <div className="space-y-1 border-t border-line pt-3 font-mono text-xs text-ink-muted">
      <p>
        AeT <span className="text-ch-hr">{status.aet.aetHr} bpm</span> ·{' '}
        {formatDate(status.aet.testDate)} ({daysAgo(status.aet.testDate)} d ago)
        {status.aetStale && (
          <Badge variant="caution" className="ml-2">
            retest suggested
          </Badge>
        )}
      </p>
      <p>
        AnT <span className="text-ch-hr">{status.ant.antHr} bpm</span> ·{' '}
        {formatDate(status.ant.testDate)} ({daysAgo(status.ant.testDate)} d ago)
        {status.antStale && (
          <Badge variant="caution" className="ml-2">
            retest suggested
          </Badge>
        )}
      </p>
    </div>
  )
}

export function AdsCard({
  status,
  now,
  renderer,
}: {
  status: AdsStatus
  now: Date
  renderer?: ImageRenderer
}) {
  const [showExport, setShowExport] = useState(false)
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>ADS readout</CardTitle>
        {status.state === 'assessed' && renderer && (
          <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
            Export
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {status.state === 'assessed' ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-4xl font-semibold tabular-nums">
                {status.gapPct.toFixed(1)}%
              </span>
              {status.ads ? (
                <Badge variant="danger">aerobic deficiency</Badge>
              ) : (
                <Badge variant="ok">balanced</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {status.ads
                ? `AeT sits more than ${ADS_GAP_THRESHOLD_PCT}% below AnT. Build base, then retest.`
                : `AeT and AnT are within ${ADS_GAP_THRESHOLD_PCT}%. High-intensity work is productive.`}
            </p>
            <ThresholdMeter gapPct={status.gapPct} />
            <Provenance status={status} now={now} />
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-4xl font-semibold text-ink-muted">—</span>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {status.state === 'no-tests' && 'Run an AeT test to begin.'}
              {status.state === 'missing-aet' && 'AeT test still needed for an assessment.'}
              {status.state === 'missing-ant' && 'AnT test still needed for an assessment.'}
            </p>
            <ThresholdMeter gapPct={null} />
          </>
        )}
      </CardContent>

      {showExport && renderer && status.state === 'assessed' && (
        <ExportPreview
          filename="runalyze-ads.png"
          renderer={renderer}
          onClose={() => setShowExport(false)}
        >
          <AdsExportCard status={status} />
        </ExportPreview>
      )}
    </Card>
  )
}
