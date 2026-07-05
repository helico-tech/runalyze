import Dexie, { type Table } from 'dexie'
import type { Activity, Exclusions, Note, Sector, TestResult } from '../../domain/model/types'
import type { LibraryRepository } from '../../domain/ports/library-repository'

interface RawFileRow {
  id: string
  bytes: Uint8Array
}

export interface DexieRepositoryOptions {
  name?: string
  indexedDB?: IDBFactory
  IDBKeyRange?: typeof IDBKeyRange
}

export class DexieLibraryRepository implements LibraryRepository {
  private readonly db: Dexie
  private readonly activities: Table<Activity, string>
  private readonly rawFiles: Table<RawFileRow, string>
  private readonly sectors: Table<Sector, string>
  private readonly testResults: Table<TestResult, string>
  private readonly notes: Table<Note, string>

  constructor(opts: DexieRepositoryOptions = {}) {
    const name = opts.name ?? 'runalyze'
    this.db = opts.indexedDB
      ? new Dexie(name, { indexedDB: opts.indexedDB, IDBKeyRange: opts.IDBKeyRange })
      : new Dexie(name)
    this.db.version(1).stores({
      activities: 'id, startTime',
      rawFiles: 'id',
      sectors: 'id, activityId',
      testResults: 'id, activityId',
      notes: 'activityId',
    })
    this.activities = this.db.table('activities')
    this.rawFiles = this.db.table('rawFiles')
    this.sectors = this.db.table('sectors')
    this.testResults = this.db.table('testResults')
    this.notes = this.db.table('notes')
  }

  async saveActivity(activity: Activity, rawBytes: Uint8Array): Promise<void> {
    await this.db.transaction('rw', [this.activities, this.rawFiles], async () => {
      await this.activities.put(activity)
      await this.rawFiles.put({ id: activity.id, bytes: rawBytes })
    })
  }

  async getActivity(id: string): Promise<Activity | null> {
    return (await this.activities.get(id)) ?? null
  }

  async hasActivity(id: string): Promise<boolean> {
    return (await this.activities.get(id)) !== undefined
  }

  async listActivities(): Promise<Activity[]> {
    const all = await this.activities.toArray()
    return all.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
  }

  async deleteActivity(id: string): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.activities, this.rawFiles, this.sectors, this.testResults, this.notes],
      async () => {
        await this.activities.delete(id)
        await this.rawFiles.delete(id)
        await this.sectors.where('activityId').equals(id).delete()
        await this.testResults.where('activityId').equals(id).delete()
        await this.notes.delete(id)
      },
    )
  }

  async getRawFile(id: string): Promise<Uint8Array | null> {
    return (await this.rawFiles.get(id))?.bytes ?? null
  }

  async updateExclusions(activityId: string, exclusions: Exclusions): Promise<void> {
    const updated = await this.activities.update(activityId, { exclusions })
    if (updated === 0) throw new Error(`activity not found: ${activityId}`)
  }

  async saveSector(sector: Sector): Promise<void> {
    await this.sectors.put(sector)
  }

  async listSectors(activityId: string): Promise<Sector[]> {
    return this.sectors.where('activityId').equals(activityId).toArray()
  }

  async deleteSector(id: string): Promise<void> {
    await this.sectors.delete(id)
  }

  async saveTestResult(result: TestResult): Promise<void> {
    await this.testResults.put(result)
  }

  async listTestResults(): Promise<TestResult[]> {
    return this.testResults.toArray()
  }

  async deleteTestResult(id: string): Promise<void> {
    await this.testResults.delete(id)
  }

  async saveNote(note: Note): Promise<void> {
    await this.notes.put(note)
  }

  async getNote(activityId: string): Promise<Note | null> {
    return (await this.notes.get(activityId)) ?? null
  }
}
