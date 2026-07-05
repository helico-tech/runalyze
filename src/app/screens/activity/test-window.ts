import { suggestWindow } from '../../../domain/analysis/window-suggestion'
import {
  AET_MIN_WINDOW_S,
  AET_TARGET_WINDOW_S,
  ANT_MIN_WINDOW_S,
} from '../../../domain/analysis/protocol-constants'
import type { Activity, Sector, TimeRange } from '../../../domain/model/types'

export const TEST_WINDOW_ID = '__test-window__'
export type TestKind = 'aet' | 'ant'

export function suggestTestWindow(activity: Activity, kind: TestKind): TimeRange | null {
  const opts =
    kind === 'aet'
      ? { targetLengthS: AET_TARGET_WINDOW_S, minLengthS: AET_MIN_WINDOW_S }
      : { targetLengthS: ANT_MIN_WINDOW_S, minLengthS: ANT_MIN_WINDOW_S }
  return suggestWindow(activity, opts)
}

export function testWindowSector(activityId: string, range: TimeRange): Sector {
  return { id: TEST_WINDOW_ID, activityId, range, label: 'test window', kind: 'test-window' }
}
