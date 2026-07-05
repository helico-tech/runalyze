import { useEffect, useRef } from 'react'
import uPlot, { type AlignedData, type Options } from 'uplot'
import { useStore as useZustand } from 'zustand'
import type { Activity, Exclusions, Sector } from '../../../domain/model/types'
import { CHANNELS } from '../../channels'
import type { WorkspaceStore } from './workspace-store'
import { applyDrag, createSector, hitTest, pxToleranceS, type DragTarget } from './chart-geometry'

const canvasAvailable = (() => {
  try {
    return document.createElement('canvas').getContext('2d') != null
  } catch {
    return false
  }
})()

const SYNC_KEY = 'workspace-x'
const EDGE_TOL_PX = 6
const MIN_SECTOR_S = 5
let sectorSeq = 0

interface Drag {
  target: DragTarget
  grabTimeS: number
  sectors0: Sector[]
  exclusions0: Exclusions
}

export function ChartStack({ activity, store }: { activity: Activity; store: WorkspaceStore }) {
  const visible = useZustand(store, (s) => s.visible)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)

  const metas = CHANNELS.filter((c) => visible.has(c.key) && activity.channels[c.sourceChannel])
  const metaKeys = metas.map((m) => m.key).join(',')

  useEffect(() => {
    if (!canvasAvailable || !containerRef.current) return
    const container = containerRef.current
    // Panes sync their crosshair via the shared cursor.sync.key below; no manual
    // uPlot.sync() handle is needed, and destroy() unsubscribes each pane on cleanup.
    const panes: uPlot[] = []
    const domainMax = activity.durationS

    const overlay = (u: uPlot) => {
      const { sectors, exclusions, selectedSectorId } = store.getState()
      const ctx = u.ctx
      const top = u.bbox.top
      const h = u.bbox.height
      const xpos = (t: number) => u.valToPos(t, 'x', true)
      ctx.save()
      // excluded shading (warmup / cooldown)
      ctx.fillStyle = 'rgba(11,14,20,0.66)'
      ctx.fillRect(xpos(0), top, xpos(exclusions.warmupEndS) - xpos(0), h)
      ctx.fillRect(
        xpos(exclusions.cooldownStartS),
        top,
        xpos(domainMax) - xpos(exclusions.cooldownStartS),
        h,
      )
      // sector bands (test window gets a distinct green treatment + a midpoint split line)
      for (const s of sectors) {
        const x0 = xpos(s.range.startS)
        const x1 = xpos(s.range.endS)
        const isTest = s.kind === 'test-window'
        if (isTest) {
          ctx.fillStyle = 'rgba(61,214,140,0.14)'
          ctx.fillRect(x0, top, x1 - x0, h)
          ctx.strokeStyle = 'rgba(61,214,140,0.6)'
          ctx.strokeRect(x0, top, x1 - x0, h)
          const mid = xpos((s.range.startS + s.range.endS) / 2)
          ctx.strokeStyle = 'rgba(230,235,240,0.35)'
          ctx.beginPath()
          ctx.moveTo(mid, top)
          ctx.lineTo(mid, top + h)
          ctx.stroke()
        } else {
          ctx.fillStyle =
            s.id === selectedSectorId ? 'rgba(91,157,255,0.18)' : 'rgba(91,157,255,0.09)'
          ctx.fillRect(x0, top, x1 - x0, h)
          ctx.strokeStyle = 'rgba(91,157,255,0.5)'
          ctx.strokeRect(x0, top, x1 - x0, h)
        }
      }
      ctx.restore()
    }

    const redrawAll = () => panes.forEach((p) => p.redraw())

    function attachInteractions(u: uPlot) {
      const timeAt = (e: PointerEvent) => u.posToVal(e.offsetX, 'x')
      u.over.style.touchAction = 'none'
      u.over.addEventListener('pointerdown', (e) => {
        const tolS = pxToleranceS(EDGE_TOL_PX, domainMax, u.over.clientWidth)
        const t = timeAt(e)
        const { sectors, exclusions } = store.getState()
        const target = hitTest(t, sectors, exclusions, tolS)
        dragRef.current = { target, grabTimeS: t, sectors0: sectors, exclusions0: exclusions }
        if (target.kind === 'move-sector' || target.kind.startsWith('resize')) {
          const id = 'id' in target ? target.id : null
          if (id) store.getState().select(id)
        }
        u.over.setPointerCapture(e.pointerId)
      })
      u.over.addEventListener('pointermove', (e) => {
        const drag = dragRef.current
        if (!drag || drag.target.kind === 'create') return
        const r = applyDrag(
          drag.target,
          drag.sectors0,
          drag.exclusions0,
          drag.grabTimeS,
          timeAt(e),
          domainMax,
          MIN_SECTOR_S,
        )
        store.getState().setSectors(r.sectors)
        store.getState().setExclusions(r.exclusions)
      })
      const finish = (e: PointerEvent) => {
        const drag = dragRef.current
        if (!drag) return
        if (drag.target.kind === 'create') {
          const s = createSector(
            `sec-${sectorSeq++}-${Math.round(drag.grabTimeS)}`,
            drag.grabTimeS,
            timeAt(e),
            domainMax,
            MIN_SECTOR_S,
          )
          if (s) {
            const withActivity = { ...s, activityId: activity.id }
            store.getState().setSectors([...store.getState().sectors, withActivity])
            store.getState().select(withActivity.id)
          }
        }
        dragRef.current = null
      }
      u.over.addEventListener('pointerup', finish)
      u.over.addEventListener('pointercancel', () => {
        dragRef.current = null
      })
    }

    metas.forEach((meta) => {
      const paneEl = document.createElement('div')
      container.appendChild(paneEl)
      const series = activity.channels[meta.sourceChannel]!
      const data: AlignedData = [series.t, series.v]
      const opts: Options = {
        title: meta.label,
        width: container.clientWidth || 900,
        height: 140,
        cursor: { sync: { key: SYNC_KEY }, drag: { x: false, y: false } },
        scales: { x: { time: false, min: 0, max: domainMax }, y: { dir: meta.invert ? -1 : 1 } },
        legend: { show: false },
        axes: [
          { stroke: '#8a97a5', grid: { stroke: '#232b36' }, ticks: { stroke: '#232b36' } },
          {
            stroke: '#8a97a5',
            grid: { stroke: '#232b36' },
            ticks: { stroke: '#232b36' },
            values: (_u, splits) => splits.map((v) => meta.format(v)),
          },
        ],
        series: [{}, { stroke: meta.colorHex, width: 1.25, points: { show: false } }],
        plugins: [{ hooks: { draw: overlay } }],
      }
      const u = new uPlot(opts, data, paneEl)
      attachInteractions(u)
      panes.push(u)
    })

    const unsub = store.subscribe(redrawAll)
    const onResize = () =>
      panes.forEach((p) => p.setSize({ width: container.clientWidth || 900, height: 140 }))
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      unsub()
      panes.forEach((p) => p.destroy()) // destroy() also unsubscribes from the sync group
      container.replaceChildren()
    }
    // rebuild when the activity or visible-channel set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, store, metaKeys])

  if (!canvasAvailable) {
    return (
      <div ref={containerRef} data-testid="chart-stack-placeholder" className="space-y-3">
        {metas.map((m) => (
          <div
            key={m.key}
            className="flex h-[140px] items-center justify-center rounded border border-line bg-surface text-xs text-ink-muted"
          >
            {m.label} chart
          </div>
        ))}
      </div>
    )
  }
  return <div ref={containerRef} className="space-y-3" />
}
