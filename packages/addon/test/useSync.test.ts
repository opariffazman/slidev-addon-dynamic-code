import type { SyncMode } from '../composables/useSync'
import { Server } from 'mock-socket'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { detectModeFromLocation, provideSync, useSync } from '../composables/useSync'

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

describe('useSync composable', () => {
  let server: Server
  beforeEach(() => {
    server = new Server('ws://localhost:4568/sub?talk=t')
  })
  afterEach(() => {
    server.stop()
  })

  it('exposes a reactive state and connection status', async () => {
    server.on('connection', (s) => {
      s.send(JSON.stringify({ t: 'snapshot', blocks: { a: { hash: 'h', content: 'c' } } }))
    })
    const ctx = provideSync({ relayUrl: 'ws://localhost:4568', talkId: 't', mode: 'audience', token: null })
    const { state, status } = useSync(ctx)
    await vi.waitFor(() => expect(state.value.a).toEqual({ hash: 'h', content: 'c' }))
    expect(status.value).toBe('connected')
    ctx.dispose()
    await nextTick()
  })
})
