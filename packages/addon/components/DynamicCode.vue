<script setup lang="ts">
import { useClipboard, useDebounceFn } from '@vueuse/core'
import lz from 'lz-string'
import { computed, inject, ref, watch } from 'vue'
import { syncKey } from './sync-key'

const props = defineProps<{
  id: string
  lang: string
  originHash: string
  codeLz: string
}>()

const sync = inject(syncKey, null)

const fenced = lz.decompressFromBase64(props.codeLz)
const liveContent = ref(fenced)

const incomingContent = computed<string | null>(() => {
  if (!sync)
    return null
  const entry = sync.state.value[props.id]
  if (!entry)
    return null
  if (entry.hash !== props.originHash)
    return null
  return entry.content
})

const displayContent = computed(() => incomingContent.value ?? liveContent.value)

const debouncedBroadcast = useDebounceFn((value: string) => {
  sync?.broadcastEdit(props.id, props.originHash, value)
}, 200)

watch(incomingContent, (val) => {
  if (val != null)
    liveContent.value = val
})

watch(liveContent, (val) => {
  if (sync?.mode === 'presenter' && val !== incomingContent.value)
    debouncedBroadcast(val)
})

const readonly = computed(() => sync?.mode !== 'presenter')

const { copy, copied } = useClipboard({ legacy: true })
function onCopy(): void {
  copy(displayContent.value)
}

const isPresenter = computed(() => sync?.mode === 'presenter')
const statusGlyph = computed(() => {
  switch (sync?.status.value) {
    case 'connected': return '●'
    case 'reconnecting': return '◐'
    case 'rejected': return '⚠'
    case 'connecting':
    case 'offline':
    default: return '○'
  }
})
</script>

<template>
  <div class="dynamic-code-wrapper group">
    <pre class="dynamic-code-pre"><code>{{ displayContent }}</code></pre>
    <textarea
      v-model="liveContent"
      class="dynamic-code-textarea"
      :readonly="readonly"
      spellcheck="false"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
    />
    <span
      v-if="isPresenter"
      class="dynamic-code-badge"
      :data-status="sync?.status.value"
    >{{ statusGlyph }}</span>
    <button
      class="dynamic-code-copy"
      :title="copied ? 'Copied' : 'Copy'"
      type="button"
      @click="onCopy"
    >
      {{ copied ? '✓' : '⧉' }}
    </button>
  </div>
</template>

<style>
.dynamic-code-wrapper {
  position: relative;
  font-family: var(--slidev-code-font-family, monospace);
  background: var(--slidev-code-background, #1e1e1e);
  color: var(--slidev-code-color, #e4e4e7);
  padding: var(--slidev-code-padding, 0.75em);
  border-radius: var(--slidev-code-radius, 4px);
  margin: var(--slidev-code-margin, 0.5em 0);
  line-height: 1.5;
}
.dynamic-code-pre {
  margin: 0;
  white-space: pre;
}
.dynamic-code-textarea {
  position: absolute;
  inset: var(--slidev-code-padding, 0.75em);
  width: calc(100% - 2 * var(--slidev-code-padding, 0.75em));
  height: calc(100% - 2 * var(--slidev-code-padding, 0.75em));
  background: transparent;
  color: transparent;
  caret-color: currentColor;
  border: none;
  outline: none;
  resize: none;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  padding: 0;
  margin: 0;
  white-space: pre;
  overflow: hidden;
}
.dynamic-code-textarea::selection { background: rgba(127, 127, 127, 0.4); }
.dynamic-code-copy {
  position: absolute;
  top: 0.25em;
  right: 0.25em;
  background: transparent;
  border: 0;
  color: inherit;
  font-size: 1.1em;
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms;
}
.dynamic-code-wrapper:hover .dynamic-code-copy { opacity: 0.6; }
.dynamic-code-copy:hover { opacity: 1 !important; }
.dynamic-code-badge {
  position: absolute;
  top: 0.25em;
  right: 2.25em;
  font-size: 0.9em;
  opacity: 0.7;
  user-select: none;
}
.dynamic-code-badge[data-status="rejected"] { color: #ef4444; }
.dynamic-code-badge[data-status="offline"]  { color: #f59e0b; }
.dynamic-code-badge[data-status="reconnecting"] { color: #f59e0b; }
.dynamic-code-badge[data-status="connected"]   { color: #10b981; }
</style>
