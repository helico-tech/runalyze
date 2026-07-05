import { Decoder, Stream } from '@garmin/fitsdk'
import { defaultExclusions, makeSeries } from '../../domain/model/series'
import type { Activity, ChannelKind, Series } from '../../domain/model/types'

export class FitDecodeError extends Error {}

/** FIT stride sports record cadence in strides/min; spec §2.4 wants steps/min. */
const STRIDE_SPORTS = new Set(['running', 'walking', 'hiking'])

interface FitRecord {
  timestamp?: Date
  heartRate?: number
  speed?: number
  enhancedSpeed?: number
  power?: number
  cadence?: number
  fractionalCadence?: number
  altitude?: number
  enhancedAltitude?: number
  distance?: number
  temperature?: number
  developerFields?: Record<number, unknown>
}

interface FitMessages {
  recordMesgs?: FitRecord[]
  sessionMesgs?: Array<{ startTime?: Date; totalElapsedTime?: number; sport?: string }>
  sportMesgs?: Array<{ sport?: string }>
  fileIdMesgs?: Array<{ garminProduct?: string | number; manufacturer?: string | number }>
  fieldDescriptionMesgs?: Array<{ fieldName?: string; units?: string; key?: number }>
}

export function decodeFitActivity(bytes: Uint8Array, id: string): Activity {
  const decoder = new Decoder(Stream.fromByteArray(bytes))
  if (!decoder.isFIT()) throw new FitDecodeError('not a FIT file')
  if (!decoder.checkIntegrity()) throw new FitDecodeError('FIT file failed integrity check')

  const { messages } = decoder.read() as { messages: FitMessages }
  const records = messages.recordMesgs ?? []
  const session = messages.sessionMesgs?.[0]
  const startTime = session?.startTime ?? records.find((r) => r.timestamp)?.timestamp
  if (!startTime) throw new FitDecodeError('FIT file contains no timestamped records')

  // Developer-field power (e.g. Stryd): descriptions carry the lookup key into
  // record.developerFields — see fixtures-manifest / spike facts.
  const powerKey = messages.fieldDescriptionMesgs?.find(
    (f) => f.fieldName === 'Power' && /watt/i.test(String(f.units ?? '')),
  )?.key
  const devPower = (r: FitRecord): unknown =>
    powerKey === undefined ? undefined : r.developerFields?.[powerKey]

  const sport = session?.sport ?? messages.sportMesgs?.[0]?.sport ?? 'unknown'
  const strideSport = STRIDE_SPORTS.has(sport)

  const extractors: Array<[ChannelKind, (r: FitRecord) => unknown]> = [
    ['heartRate', (r) => r.heartRate],
    ['speed', (r) => r.enhancedSpeed ?? r.speed],
    ['power', (r) => r.power ?? devPower(r)],
    [
      'cadence',
      (r) =>
        strideSport && r.cadence !== undefined
          ? 2 * (r.cadence + (r.fractionalCadence ?? 0))
          : r.cadence,
    ],
    ['altitude', (r) => r.enhancedAltitude ?? r.altitude],
    ['distance', (r) => r.distance],
    ['temperature', (r) => r.temperature],
  ]

  const raw = new Map<ChannelKind, { t: number[]; v: number[] }>(
    extractors.map(([kind]) => [kind, { t: [], v: [] }]),
  )
  let prevT = -Infinity
  let lastT = 0
  for (const rec of records) {
    if (!rec.timestamp) continue
    const t = (rec.timestamp.getTime() - startTime.getTime()) / 1000
    if (t < 0 || t <= prevT) continue
    prevT = t
    lastT = t
    for (const [kind, extract] of extractors) {
      const value = extract(rec)
      if (typeof value === 'number' && Number.isFinite(value)) {
        const target = raw.get(kind)!
        target.t.push(t)
        target.v.push(value)
      }
    }
  }

  const channels: Partial<Record<ChannelKind, Series>> = {}
  for (const [kind, data] of raw) {
    if (data.t.length > 0) channels[kind] = makeSeries(data.t, data.v)
  }
  if (Object.keys(channels).length === 0) {
    throw new FitDecodeError('FIT file contains no usable channel data')
  }

  const durationS = session?.totalElapsedTime ?? lastT
  const fileId = messages.fileIdMesgs?.[0]
  return {
    id,
    startTime,
    durationS,
    sport,
    device:
      fileId?.garminProduct != null
        ? String(fileId.garminProduct)
        : fileId?.manufacturer != null
          ? String(fileId.manufacturer)
          : null,
    channels,
    exclusions: defaultExclusions(durationS),
  }
}
