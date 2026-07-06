import type { Activity, Exclusions, Note, Sector, TestResult, Thresholds } from '../model/types'

export interface LibraryRepository {
  saveActivity(activity: Activity, rawBytes: Uint8Array): Promise<void>
  getActivity(id: string): Promise<Activity | null>
  hasActivity(id: string): Promise<boolean>
  /** sorted by startTime, newest first */
  listActivities(): Promise<Activity[]>
  /** cascades raw bytes, sectors, test results, and notes */
  deleteActivity(id: string): Promise<void>
  getRawFile(id: string): Promise<Uint8Array | null>
  updateExclusions(activityId: string, exclusions: Exclusions): Promise<void>
  saveSector(sector: Sector): Promise<void>
  listSectors(activityId: string): Promise<Sector[]>
  deleteSector(id: string): Promise<void>
  saveTestResult(result: TestResult): Promise<void>
  listTestResults(): Promise<TestResult[]>
  deleteTestResult(id: string): Promise<void>
  saveNote(note: Note): Promise<void>
  getNote(activityId: string): Promise<Note | null>
  /** Global manual thresholds; null when never saved. */
  getThresholds(): Promise<Thresholds | null>
  saveThresholds(t: Thresholds): Promise<void>
}
