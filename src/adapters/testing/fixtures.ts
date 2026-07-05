import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function fixtureBytes(name: string): Uint8Array {
  // cwd-based: import.meta.url gets rewritten under vitest's jsdom transform
  return new Uint8Array(readFileSync(join(process.cwd(), 'tests', 'fixtures', name)))
}
