import { describe, expect, it } from 'vitest'
import { syntheticActivity, syntheticSeries } from '../domain/testing/synthetic'
import { CHANNELS, channelsPresent, efficiencyPresent } from './channels'

describe('efficiencyPresent', () => {
  const s = (v: number) => syntheticSeries({ durationS: 60, value: () => v })
  it('lists both efficiency curves when speed, power and HR are present', () => {
    const a = syntheticActivity({
      durationS: 60,
      channels: { heartRate: s(150), speed: s(3), power: s(200) },
    })
    expect(efficiencyPresent(a).map((e) => e.key)).toEqual(['efPace', 'efPower'])
  })
  it('returns nothing without heart rate', () => {
    const a = syntheticActivity({ durationS: 60, channels: { speed: s(3) } })
    expect(efficiencyPresent(a)).toEqual([])
  })
})

describe('channels', () => {
  it('maps pace to the speed source channel, inverted', () => {
    const pace = CHANNELS.find((c) => c.key === 'pace')!
    expect(pace.sourceChannel).toBe('speed')
    expect(pace.invert).toBe(true)
    expect(pace.format(2.5059)).toBe('6:39')
  })

  it('formats heart rate as integer bpm', () => {
    const hr = CHANNELS.find((c) => c.key === 'heartRate')!
    expect(hr.format(159.4)).toBe('159')
  })

  it('lists only channels whose source is present', () => {
    const a = syntheticActivity({
      durationS: 60,
      channels: { heartRate: syntheticSeries({ durationS: 60, value: () => 150 }) },
    })
    expect(channelsPresent(a).map((c) => c.key)).toEqual(['heartRate'])
  })
})
