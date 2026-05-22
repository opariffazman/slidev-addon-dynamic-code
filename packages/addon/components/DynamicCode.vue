<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
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
</script>

<template>
  <div class="dynamic-code-wrapper">
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
</style>
