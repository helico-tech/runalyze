import { unzipSync } from 'fflate'
import type { ActivityFileParser, ParseOutcome } from '../../domain/ports/activity-file-parser'
import { decodeFitActivity, FitDecodeError } from './decode-fit'
import { sha256Hex } from './hash'

function isZip(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  )
}

export class GarminFitFileParser implements ActivityFileParser {
  async parse(bytes: Uint8Array, filename: string): Promise<ParseOutcome[]> {
    if (isZip(bytes) || filename.toLowerCase().endsWith('.zip')) {
      return this.parseZip(bytes, filename)
    }
    return [await this.parseSingle(bytes, filename)]
  }

  private async parseZip(bytes: Uint8Array, filename: string): Promise<ParseOutcome[]> {
    let entries: Record<string, Uint8Array>
    try {
      entries = unzipSync(bytes)
    } catch {
      return [{ ok: false, filename, reason: 'could not read zip archive' }]
    }
    const fitEntries = Object.entries(entries).filter(
      ([name]) => name.toLowerCase().endsWith('.fit') && !name.startsWith('__MACOSX'),
    )
    if (fitEntries.length === 0) {
      return [{ ok: false, filename, reason: 'zip contains no .fit files' }]
    }
    return Promise.all(fitEntries.map(([name, data]) => this.parseSingle(data, name)))
  }

  private async parseSingle(bytes: Uint8Array, filename: string): Promise<ParseOutcome> {
    try {
      const id = await sha256Hex(bytes)
      return { ok: true, filename, activity: decodeFitActivity(bytes, id), rawBytes: bytes }
    } catch (e) {
      const reason =
        e instanceof FitDecodeError
          ? e.message
          : `unexpected error: ${e instanceof Error ? e.message : String(e)}`
      return { ok: false, filename, reason }
    }
  }
}
