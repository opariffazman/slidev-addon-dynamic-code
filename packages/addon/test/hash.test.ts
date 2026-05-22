import { describe, expect, it } from 'vitest'
import { originHash } from '../lib/hash'

describe('originHash', () => {
  it('returns a stable 12-char hex digest', async () => {
    const h = await originHash('npm install foo\n')
    expect(h).toMatch(/^[0-9a-f]{12}$/)
  })

  it('is stable for the same input', async () => {
    const a = await originHash('echo hello')
    const b = await originHash('echo hello')
    expect(a).toBe(b)
  })

  it('changes when input changes', async () => {
    const a = await originHash('echo hello')
    const b = await originHash('echo world')
    expect(a).not.toBe(b)
  })

  it('trims leading/trailing whitespace before hashing', async () => {
    const a = await originHash('echo hi')
    const b = await originHash('  echo hi  \n')
    expect(a).toBe(b)
  })
})
