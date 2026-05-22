<script setup lang="ts">
import { computed, inject } from 'vue'
import { syncKey } from './sync-key'

const sync = inject(syncKey, null)

const isPresenter = computed(() => {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  return Boolean(params.get('presenter'))
})

const entries = computed(() => {
  if (!sync)
    return [] as Array<{ id: string, hash: string, content: string }>
  return Object.entries(sync.state.value).map(([id, v]) => ({ id, ...v }))
})

function resetOne(id: string): void {
  sync?.broadcastReset(id)
}
function resetAll(): void {
  // eslint-disable-next-line no-alert
  if (confirm('Reset every dynamic block for this talk?'))
    sync?.broadcastResetAll()
}
</script>

<template>
  <div v-if="!isPresenter" class="dynamic-code-admin-denied">
    <p>Forbidden. Append <code>?presenter=YOUR_TOKEN</code> to the URL to manage dynamic blocks.</p>
  </div>
  <div v-else class="dynamic-code-admin">
    <h1>Dynamic code admin</h1>
    <p>Status: <strong>{{ sync?.status.value ?? 'no sync' }}</strong></p>
    <button class="reset-all" type="button" @click="resetAll">
      Reset all
    </button>
    <table v-if="entries.length">
      <thead>
        <tr><th>id</th><th>hash</th><th>content (truncated)</th><th /></tr>
      </thead>
      <tbody>
        <tr v-for="row in entries" :key="row.id">
          <td><code>{{ row.id }}</code></td>
          <td><code>{{ row.hash }}</code></td>
          <td><pre>{{ row.content.length > 120 ? `${row.content.slice(0, 120)}…` : row.content }}</pre></td>
          <td>
            <button type="button" @click="resetOne(row.id)">
              Reset
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>
      <em>No persisted edits.</em>
    </p>
  </div>
</template>

<style>
.dynamic-code-admin { padding: 2rem; font-family: var(--slidev-code-font-family, sans-serif); }
.dynamic-code-admin table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
.dynamic-code-admin th, .dynamic-code-admin td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; vertical-align: top; }
.dynamic-code-admin .reset-all { margin: 1rem 0; padding: 0.5rem 1rem; background: #ef4444; color: white; border: 0; border-radius: 4px; cursor: pointer; }
.dynamic-code-admin-denied { padding: 2rem; }
</style>
