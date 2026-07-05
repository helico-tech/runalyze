import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { assessAds } from '../../../domain/analysis/ads-assessment'
import { useContainer } from '../../container-context'
import { useActivities, useTestResults } from '../../hooks'
import { importFiles } from '../../import-service'
import { AdsCard } from './ads-card'
import { ImportDropzone } from './import-dropzone'
import { RunList } from './run-list'

export function LibraryScreen() {
  const { parser, repo } = useContainer()
  const { activities, refresh } = useActivities()
  const { results } = useTestResults()
  const navigate = useNavigate()

  const adsStatus = useMemo(() => assessAds(results, new Date()), [results])
  const badges = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const r of results) {
      const list = map.get(r.activityId) ?? []
      list.push(r.kind === 'aet' ? 'AeT' : 'AnT')
      map.set(r.activityId, list)
    }
    return map
  }, [results])

  const handleFiles = async (files: File[]) => {
    const payload = await Promise.all(
      files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
    )
    const outcomes = await importFiles(payload, parser, repo)
    // spec §3.3: a lone duplicate import opens the existing activity
    const loneDuplicate = outcomes.length === 1 && outcomes[0]!.status === 'duplicate'
    for (const o of outcomes) {
      if (o.status === 'imported') toast.success(`Imported ${o.filename}`)
      if (o.status === 'duplicate')
        toast.info(
          loneDuplicate
            ? `${o.filename} is already in the library — opening it`
            : `${o.filename} is already in the library`,
        )
      if (o.status === 'error') toast.error(`Couldn't read ${o.filename}: ${o.reason}`)
    }
    refresh()
    if (loneDuplicate && outcomes[0]!.status === 'duplicate') {
      navigate(`/activity/${outcomes[0]!.activityId}`)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <AdsCard status={adsStatus} now={new Date()} />
        <ImportDropzone onFiles={(files) => void handleFiles(files)} />
      </div>
      <section>
        <h2 className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Runs
        </h2>
        <RunList activities={activities} badges={badges} />
      </section>
    </div>
  )
}
