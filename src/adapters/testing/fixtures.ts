import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export function fixtureBytes(name: string): Uint8Array {
  const path = fileURLToPath(new URL(`../../../tests/fixtures/${name}`, import.meta.url))
  return new Uint8Array(readFileSync(path))
}
