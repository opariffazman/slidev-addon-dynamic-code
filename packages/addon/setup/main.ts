import configs from '#slidev/configs'
import { defineAppSetup } from '@slidev/types'
import DynamicCode from '../components/DynamicCode.vue'
import { syncKey } from '../components/sync-key'
import { detectModeFromLocation, provideSync } from '../composables/useSync'
import { resolveAddonConfig } from '../lib/read-config'

export default defineAppSetup(({ app }) => {
  app.component('DynamicCode', DynamicCode)

  const cfg = resolveAddonConfig(configs as unknown as Record<string, unknown>)
  const { mode, token } = detectModeFromLocation(typeof window !== 'undefined' ? window.location.search : '')

  const ctx = provideSync({ relayUrl: cfg.relayUrl, talkId: cfg.talkId, mode, token })

  // Provide on the root app so all routes see the same sync context.
  app.provide(syncKey, {
    mode: ctx.mode,
    state: ctx.state,
    status: ctx.status,
    broadcastEdit: (id: string, hash: string, content: string) => ctx.client.broadcastEdit(id, hash, content),
    broadcastReset: (id: string) => ctx.client.broadcastReset(id),
    broadcastResetAll: () => ctx.client.broadcastResetAll(),
  })
})
