import { useEffect, useRef } from 'react'
import uPlot, { type AlignedData, type Options } from 'uplot'
import { useStore as useZustand } from 'zustand'
import { efficiencySeries, rollingMean } from '../../../domain/analysis/efficiency'
import { displayLaps } from '../../../domain/model/laps'
import type { Activity, Exclusions, Sector, Series } from '../../../domain/model/types'
import { CHANNELS, EFFICIENCY } from '../../channels'
import { useThemeStore } from '../../theme'
import type { WorkspaceStore } from './workspace-store'

interface PaneSpec {
  label: string
  colorVar: string
  invert: boolean
  format: (v: number) => string
  series: Series
}

const EF_SMOOTH_S = 30
import {
  applyDrag,
  createSector,
  cursorForTarget,
  hitTest,
  pxToleranceS,
  type DragTarget,
} from './chart-geometry'

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
  const theme = useThemeStore((s) => s.theme)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)

  const rawMetas = CHANNELS.filter((c) => visible.has(c.key) && activity.channels[c.sourceChannel])
  const effMetas = EFFICIENCY.filter(
    (e) => visible.has(e.key) && activity.channels[e.requires] && activity.channels.heartRate,
  )
  const paneKeys = [...rawMetas.map((m) => m.key), ...effMetas.map((e) => e.key)].join(',')

  useEffect(() => {
    if (!canvasAvailable || !containerRef.current) return
    const container = containerRef.current
    // Panes sync their crosshair via the shared cursor.sync.key below; no manual
    // uPlot.sync() handle is needed, and destroy() unsubscribes each pane on cleanup.
    const panes: uPlot[] = []
    const domainMax = activity.durationS

    // Resolve theme tokens once per build; the effect re-runs on theme change so
    // uPlot (which paints to canvas and can't read CSS vars) gets fresh colors.
    const cs = getComputedStyle(document.documentElement)
    const cvar = (name: string) => cs.getPropertyValue(name).trim()
    const resolve = (c: string) => (c.startsWith('var(') ? cvar(c.slice(4, -1).trim()) : c)
    const axisStroke = cvar('--fg-2')
    const gridStroke = cvar('--bd')
    const isLight = theme === 'light'
    const excludeFill = isLight ? 'rgba(120,120,132,0.20)' : 'rgba(8,8,10,0.62)'
    const splitStroke = isLight ? 'rgba(25,25,32,0.35)' : 'rgba(243,243,246,0.35)'

    const overlay = (u: uPlot) => {
      const { sectors, exclusions, selectedSectorId } = store.getState()
      const ctx = u.ctx
      const top = u.bbox.top
      const h = u.bbox.height
      const xpos = (t: number) => u.valToPos(t, 'x', true)
      // A short centered vertical grip signalling a draggable edge.
      const grip = (xEdge: number, color: string) => {
        const gh = h * 0.4
        const gy = top + (h - gh) / 2
        ctx.fillStyle = color
        ctx.fillRect(xEdge - 1.5, gy, 3, gh)
      }
      ctx.save()
      // excluded shading (warmup / cooldown) + trim grips
      ctx.fillStyle = excludeFill
      ctx.fillRect(xpos(0), top, xpos(exclusions.warmupEndS) - xpos(0), h)
      ctx.fillRect(
        xpos(exclusions.cooldownStartS),
        top,
        xpos(domainMax) - xpos(exclusions.cooldownStartS),
        h,
      )
      grip(xpos(exclusions.warmupEndS), 'rgba(240,82,95,0.85)')
      grip(xpos(exclusions.cooldownStartS), 'rgba(240,82,95,0.85)')
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
          ctx.strokeStyle = splitStroke
          ctx.beginPath()
          ctx.moveTo(mid, top)
          ctx.lineTo(mid, top + h)
          ctx.stroke()
          grip(x0, 'rgba(61,214,140,0.9)')
          grip(x1, 'rgba(61,214,140,0.9)')
        } else {
          ctx.fillStyle =
            s.id === selectedSectorId ? 'rgba(91,157,255,0.18)' : 'rgba(91,157,255,0.09)'
          ctx.fillRect(x0, top, x1 - x0, h)
          ctx.strokeStyle = 'rgba(91,157,255,0.5)'
          ctx.strokeRect(x0, top, x1 - x0, h)
          grip(x0, 'rgba(91,157,255,0.9)')
          grip(x1, 'rgba(91,157,255,0.9)')
        }
      }
      // manual lap dividers (button-press boundaries) — display-only, dashed amber
      const laps = displayLaps(activity)
      if (laps.length > 0) {
        const bounds = new Set<number>()
        for (const l of laps) {
          bounds.add(l.range.startS)
          bounds.add(l.range.endS)
        }
        ctx.strokeStyle = 'rgba(245,165,36,0.55)'
        ctx.setLineDash([4, 4])
        for (const b of bounds) {
          const x = xpos(b)
          ctx.beginPath()
          ctx.moveTo(x, top)
          ctx.lineTo(x, top + h)
          ctx.stroke()
        }
        ctx.setLineDash([])
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
        u.over.style.cursor = cursorForTarget(target, true)
        if (target.kind === 'move-sector' || target.kind.startsWith('resize')) {
          const id = 'id' in target ? target.id : null
          if (id) store.getState().select(id)
        }
        u.over.setPointerCapture(e.pointerId)
      })
      u.over.addEventListener('pointermove', (e) => {
        const drag = dragRef.current
        if (!drag) {
          // hover: cursor cue + track the hovered time for the readout
          const t = timeAt(e)
          const { sectors, exclusions } = store.getState()
          const tolS = pxToleranceS(EDGE_TOL_PX, domainMax, u.over.clientWidth)
          u.over.style.cursor = cursorForTarget(hitTest(t, sectors, exclusions, tolS), false)
          store.getState().setHoverT(t)
          return
        }
        if (drag.target.kind === 'create') return
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
      u.over.addEventListener('pointerleave', () => {
        store.getState().setHoverT(null)
        u.over.style.cursor = 'default'
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

    const paneSpecs: PaneSpec[] = [
      ...rawMetas.map((m) => ({
        label: m.label,
        colorVar: m.colorVar,
        invert: m.invert,
        format: m.format,
        series: activity.channels[m.sourceChannel]!,
      })),
      ...effMetas.map((e) => ({
        label: e.label,
        colorVar: e.colorVar,
        invert: false,
        format: e.format,
        series: rollingMean(
          efficiencySeries(activity.channels[e.requires]!, activity.channels.heartRate!, e.scale),
          EF_SMOOTH_S,
        ),
      })),
    ]

    paneSpecs.forEach((spec) => {
      const paneEl = document.createElement('div')
      container.appendChild(paneEl)
      const data: AlignedData = [spec.series.t, spec.series.v]
      const opts: Options = {
        title: spec.label,
        width: container.clientWidth || 900,
        height: 180,
        cursor: { sync: { key: SYNC_KEY }, drag: { x: false, y: false } },
        scales: { x: { time: false, min: 0, max: domainMax }, y: { dir: spec.invert ? -1 : 1 } },
        legend: { show: false },
        axes: [
          { stroke: axisStroke, grid: { stroke: gridStroke }, ticks: { stroke: gridStroke } },
          {
            stroke: axisStroke,
            grid: { stroke: gridStroke },
            ticks: { stroke: gridStroke },
            values: (_u, splits) => splits.map((v) => spec.format(v)),
          },
        ],
        series: [{}, { stroke: resolve(spec.colorVar), width: 1.25, points: { show: false } }],
        plugins: [{ hooks: { draw: overlay } }],
      }
      const u = new uPlot(opts, data, paneEl)
      attachInteractions(u)
      panes.push(u)
    })

    // Redraw only when the overlay's inputs change — not on transient hoverT updates.
    let ls = store.getState().sectors
    let le = store.getState().exclusions
    let lsel = store.getState().selectedSectorId
    const unsub = store.subscribe(() => {
      const s = store.getState()
      if (s.sectors === ls && s.exclusions === le && s.selectedSectorId === lsel) return
      ls = s.sectors
      le = s.exclusions
      lsel = s.selectedSectorId
      redrawAll()
    })
    const onResize = () =>
      panes.forEach((p) => p.setSize({ width: container.clientWidth || 900, height: 180 }))
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      unsub()
      panes.forEach((p) => p.destroy()) // destroy() also unsubscribes from the sync group
      container.replaceChildren()
    }
    // rebuild when the activity, visible-channel set, or theme changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, store, paneKeys, theme])

  if (!canvasAvailable) {
    return (
      <div ref={containerRef} data-testid="chart-stack-placeholder" className="space-y-3">
        {[...rawMetas, ...effMetas].map((m) => (
          <div
            key={m.key}
            className="flex h-[180px] items-center justify-center rounded-xl border border-line bg-panel text-xs text-fg-3"
          >
            {m.label} chart
          </div>
        ))}
      </div>
    )
  }
  return <div ref={containerRef} className="space-y-3" />
}
