import type { Ref } from 'vue'
import type { ConnectionStatus, SyncClientOptions } from './sync-client'
import { ref } from 'vue'
import { SyncClient } from './sync-client'

export type SyncMode = 'presenter' | 'audience'

export interface ModeDetection {
  mode: SyncMode
  token: string | null
}

export function detectModeFromLocation(search: string): ModeDetection {
  const params = new URLSearchParams(search)
  const token = params.get('presenter')
  if (token && token.length > 0)
    return { mode: 'presenter', token }
  return { mode: 'audience', token: null }
}

export interface SyncContext {
  state: Ref<Record<string, { hash: string, content: string }>>
  status: Ref<ConnectionStatus>
  mode: SyncMode
  client: SyncClient
  dispose: () => void
}

export function provideSync(opts: Pick<SyncClientOptions, 'relayUrl' | 'talkId' | 'mode' | 'token'>): SyncContext {
  const state = ref<Record<string, { hash: string, content: string }>>({})
  const status = ref<ConnectionStatus>('connecting')

  const client = new SyncClient({
    ...opts,
    onStateChange: (s) => { state.value = s },
    onStatusChange: (s) => { status.value = s },
  })
  client.connect()

  return {
    state,
    status,
    mode: opts.mode,
    client,
    dispose: () => client.dispose(),
  }
}

export function useSync(ctx: SyncContext): {
  state: Ref<Record<string, { hash: string, content: string }>>
  status: Ref<ConnectionStatus>
  mode: SyncMode
  broadcastEdit: (id: string, hash: string, content: string) => void
  broadcastReset: (id: string) => void
  broadcastResetAll: () => void
} {
  return {
    state: ctx.state,
    status: ctx.status,
    mode: ctx.mode,
    broadcastEdit: (id, hash, content) => ctx.client.broadcastEdit(id, hash, content),
    broadcastReset: id => ctx.client.broadcastReset(id),
    broadcastResetAll: () => ctx.client.broadcastResetAll(),
  }
}
