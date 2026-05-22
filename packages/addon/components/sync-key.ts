import type { InjectionKey, Ref } from 'vue'
import type { ConnectionStatus } from '../composables/sync-client'
import type { SyncMode } from '../composables/useSync'

export interface SyncInjection {
  mode: SyncMode
  state: Ref<Record<string, { hash: string, content: string }>>
  status: Ref<ConnectionStatus>
  broadcastEdit: (id: string, hash: string, content: string) => void
  broadcastReset: (id: string) => void
  broadcastResetAll: () => void
}

export const syncKey: InjectionKey<SyncInjection> = Symbol('slidev-addon-dynamic-code:sync')
