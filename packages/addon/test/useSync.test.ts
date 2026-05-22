import type { SyncMode } from '../composables/useSync'
import { describe, expect, it } from 'vitest'
import { detectModeFromLocation } from '../composables/useSync'

describe('detectModeFromLocation', () => {
  it('returns presenter when ?presenter=token is present', () => {
    const r = detectModeFromLocation('?presenter=mysecret&session=2026-05')
    expect(r.mode).toBe<SyncMode>('presenter')
    expect(r.token).toBe('mysecret')
  })

  it('returns audience when ?presenter is absent', () => {
    const r = detectModeFromLocation('?slide=4')
    expect(r.mode).toBe<SyncMode>('audience')
    expect(r.token).toBeNull()
  })

  it('returns audience when presenter param is empty', () => {
    const r = detectModeFromLocation('?presenter=')
    expect(r.mode).toBe<SyncMode>('audience')
    expect(r.token).toBeNull()
  })
})
