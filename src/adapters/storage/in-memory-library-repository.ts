import type { Activity, Exclusions, Note, Sector, TestResult } from '../../domain/model/types'
import type { LibraryRepository } from '../../domain/ports/library-repository'

/** Fallback for when IndexedDB is unavailable; also the fast test double. */
export class InMemoryLibraryRepository implements LibraryRepository {
  private readonly activities = new Map<string, Activity>()
  private readonly rawFiles = new Map<string, Uint8Array>()
  private readonly sectors = new Map<string, Sector>()
  private readonly testResults = new Map<string, TestResult>()
  private readonly notes = new Map<string, Note>()

  async saveActivity(activity: Activity, rawBytes: Uint8Array): Promise<void> {
    this.activities.set(activity.id, structuredClone(activity))
    this.rawFiles.set(activity.id, structuredClone(rawBytes))
  }

  async getActivity(id: string): Promise<Activity | null> {
    const a = this.activities.get(id)
    return a ? structuredClone(a) : null
  }

  async hasActivity(id: string): Promise<boolean> {
    return this.activities.has(id)
  }

  async listActivities(): Promise<Activity[]> {
    return [...this.activities.values()]
      .map((a) => structuredClone(a))
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
  }

  async deleteActivity(id: string): Promise<void> {
    this.activities.delete(id)
    this.rawFiles.delete(id)
    for (const [sid, s] of this.sectors) if (s.activityId === id) this.sectors.delete(sid)
    for (const [tid, t] of this.testResults) if (t.activityId === id) this.testResults.delete(tid)
    this.notes.delete(id)
  }

  async getRawFile(id: string): Promise<Uint8Array | null> {
    const bytes = this.rawFiles.get(id)
    return bytes ? structuredClone(bytes) : null
  }

  async updateExclusions(activityId: string, exclusions: Exclusions): Promise<void> {
    const a = this.activities.get(activityId)
    if (!a) throw new Error(`activity not found: ${activityId}`)
    a.exclusions = structuredClone(exclusions)
  }

  async saveSector(sector: Sector): Promise<void> {
    this.sectors.set(sector.id, structuredClone(sector))
  }

  async listSectors(activityId: string): Promise<Sector[]> {
    return [...this.sectors.values()]
      .filter((s) => s.activityId === activityId)
      .map((s) => structuredClone(s))
  }

  async deleteSector(id: string): Promise<void> {
    this.sectors.delete(id)
  }

  async saveTestResult(result: TestResult): Promise<void> {
    this.testResults.set(result.id, structuredClone(result))
  }

  async listTestResults(): Promise<TestResult[]> {
    return [...this.testResults.values()].map((t) => structuredClone(t))
  }

  async deleteTestResult(id: string): Promise<void> {
    this.testResults.delete(id)
  }

  async saveNote(note: Note): Promise<void> {
    this.notes.set(note.activityId, structuredClone(note))
  }

  async getNote(activityId: string): Promise<Note | null> {
    const n = this.notes.get(activityId)
    return n ? structuredClone(n) : null
  }
}
