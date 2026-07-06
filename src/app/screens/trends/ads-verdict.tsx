import { useState } from 'react'
import type { AdsStatus } from '../../../domain/analysis/ads-assessment'
import { ADS_GAP_THRESHOLD_PCT } from '../../../domain/analysis/protocol-constants'
import type { ImageRenderer } from '../../../domain/ports/image-renderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ExportPreview } from '../../export/export-preview'
import { AdsExportCard } from '../../export/export-card'

// Slim current-status readout for the Trends screen. The gap-over-time chart and
// test log below carry the history, so this stays to the verdict + export only.
export function AdsVerdict({
  status,
  renderer,
}: {
  status: AdsStatus
  renderer?: ImageRenderer
}) {
  const [showExport, setShowExport] = useState(false)

  if (status.state === 'no-tests') return null

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
        <span className="font-mono text-xs font-semibold uppercase tracking-widest text-ink-muted">
          ADS · current
        </span>
        {status.state === 'assessed' ? (
          <>
            <span className="font-mono text-3xl font-semibold tabular-nums">
              {status.gapPct.toFixed(1)}%
            </span>
            {status.ads ? (
              <Badge variant="danger">aerobic deficiency</Badge>
            ) : (
              <Badge variant="ok">balanced</Badge>
            )}
            <p className="min-w-[12rem] flex-1 text-sm text-ink-muted">
              {status.ads
                ? `AeT sits more than ${ADS_GAP_THRESHOLD_PCT}% below AnT. Build base, then retest.`
                : `AeT and AnT are within ${ADS_GAP_THRESHOLD_PCT}%. High-intensity work is productive.`}
            </p>
            {renderer && (
              <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
                Export
              </Button>
            )}
          </>
        ) : (
          <p className="flex-1 text-sm text-ink-muted">
            {status.state === 'missing-aet' && 'AeT test still needed for an assessment.'}
            {status.state === 'missing-ant' && 'AnT test still needed for an assessment.'}
          </p>
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
