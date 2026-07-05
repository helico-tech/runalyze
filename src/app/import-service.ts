import type { ActivityFileParser } from '../domain/ports/activity-file-parser'
import type { LibraryRepository } from '../domain/ports/library-repository'

export type ImportResult =
  | { status: 'imported' | 'duplicate'; filename: string; activityId: string }
  | { status: 'error'; filename: string; reason: string }

export async function importFiles(
  files: Array<{ name: string; bytes: Uint8Array }>,
  parser: ActivityFileParser,
  repo: LibraryRepository,
): Promise<ImportResult[]> {
  const results: ImportResult[] = []
  for (const file of files) {
    const outcomes = await parser.parse(file.bytes, file.name)
    for (const outcome of outcomes) {
      if (!outcome.ok) {
        results.push({ status: 'error', filename: outcome.filename, reason: outcome.reason })
        continue
      }
      if (await repo.hasActivity(outcome.activity.id)) {
        results.push({
          status: 'duplicate',
          filename: outcome.filename,
          activityId: outcome.activity.id,
        })
        continue
      }
      try {
        await repo.saveActivity(outcome.activity, outcome.rawBytes)
        results.push({
          status: 'imported',
          filename: outcome.filename,
          activityId: outcome.activity.id,
        })
      } catch (e) {
        results.push({
          status: 'error',
          filename: outcome.filename,
          reason: `could not save: ${e instanceof Error ? e.message : String(e)}`,
        })
      }
    }
  }
  return results
}
