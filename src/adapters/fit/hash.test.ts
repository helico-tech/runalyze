import { describe, expect, it } from 'vitest'
import { sha256Hex } from './hash'

describe('sha256Hex', () => {
  it('computes the well-known hash of "abc"', async () => {
    const bytes = new TextEncoder().encode('abc')
    expect(await sha256Hex(bytes)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('is deterministic and content-sensitive', async () => {
    const a = new Uint8Array([1, 2, 3])
    expect(await sha256Hex(a)).toBe(await sha256Hex(new Uint8Array([1, 2, 3])))
    expect(await sha256Hex(a)).not.toBe(await sha256Hex(new Uint8Array([1, 2, 4])))
  })
})
