import type { Activity } from '../model/types'

export type ParseOutcome =
  | { ok: true; filename: string; activity: Activity; rawBytes: Uint8Array }
  | { ok: false; filename: string; reason: string }

export interface ActivityFileParser {
  /** One outcome per contained activity: a zip yields one outcome per .fit entry. */
  parse(bytes: Uint8Array, filename: string): Promise<ParseOutcome[]>
}
