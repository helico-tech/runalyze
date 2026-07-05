import { useRef, useState, type ReactNode } from 'react'
import type { ImageRenderer } from '../../domain/ports/image-renderer'
import { Button } from '@/components/ui/button'
import { downloadBlob } from './download'
import { EXPORT_H, EXPORT_W } from './export-card'

const SCALE = 0.45

export function ExportPreview({
  children,
  filename,
  renderer,
  onClose,
}: {
  children: ReactNode
  filename: string
  renderer: ImageRenderer
  onClose: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const download = async () => {
    const node = cardRef.current?.firstElementChild as HTMLElement | undefined
    if (!node) return
    setBusy(true)
    try {
      // The card lays out at its intrinsic 1200×630; the ancestor scale is display-only,
      // so the rasterized PNG is full-size.
      downloadBlob(await renderer.toPngBlob(node), filename)
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg/90 p-6">
      <div
        className="overflow-hidden rounded-lg border border-line"
        style={{ width: EXPORT_W * SCALE, height: EXPORT_H * SCALE }}
      >
        <div style={{ transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>
          <div ref={cardRef}>{children}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void download()}>
          Download PNG
        </Button>
        {saved && <span className="font-mono text-xs text-ok">saved</span>}
      </div>
    </div>
  )
}
