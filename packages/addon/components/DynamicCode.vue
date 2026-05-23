<script setup lang="ts">
import { useClipboard, useDebounceFn } from '@vueuse/core'
import lz from 'lz-string'
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
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

const wrapperRef = ref<HTMLElement | null>(null)
function onReset(): void {
  if (sync?.mode !== 'presenter')
    return
  sync?.broadcastReset(props.id)
  liveContent.value = fenced
}
onMounted(() => wrapperRef.value?.addEventListener('dynamic-code:reset', onReset))
onUnmounted(() => wrapperRef.value?.removeEventListener('dynamic-code:reset', onReset))

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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const highlightedHtml = ref<string>('')

async function refreshHighlight(code: string, lang: string): Promise<void> {
  try {
    const { codeToHtml } = await import('shiki')
    highlightedHtml.value = await codeToHtml(code, {
      lang,
      themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
      defaultColor: false,
      transformers: [{
        pre(node) {
          const existing = (node.properties.class as string | undefined) || ''
          if (!existing.includes('slidev-code'))
            node.properties.class = `${existing} slidev-code`.trim()
        },
      }],
    })
  }
  catch {
    highlightedHtml.value = ''
  }
}

const debouncedHighlight = useDebounceFn(
  (code: string) => refreshHighlight(code, props.lang),
  60,
)

watch(displayContent, (c) => {
  void debouncedHighlight(c)
}, { immediate: true })

const renderedHtml = computed(() => {
  if (highlightedHtml.value)
    return highlightedHtml.value
  return `<pre class="shiki slidev-code"><code>${escapeHtml(displayContent.value)}</code></pre>`
})
</script>

<template>
  <div
    ref="wrapperRef"
    class="dynamic-code-wrapper slidev-code-wrapper relative group"
  >
    <div class="dynamic-code-render" v-html="renderedHtml" />
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
  overflow: hidden;
  border-radius: var(--slidev-code-radius);
}
.dynamic-code-render :deep(pre.slidev-code) {
  margin: 0;
}
/* Force identical glyph metrics on the visible code and the overlaid
   textarea so the caret stays under the character the user is typing.
   Mirrors the pattern slidev's own ShikiEditor.vue uses. */
.dynamic-code-render :deep(pre.slidev-code),
.dynamic-code-render :deep(pre.slidev-code) :deep(code),
.dynamic-code-render :deep(pre.slidev-code) :deep(span),
.dynamic-code-textarea {
  font-family: var(--slidev-code-font-family) !important;
  font-size: var(--slidev-code-font-size) !important;
  line-height: var(--slidev-code-line-height) !important;
  font-feature-settings: normal !important;
  font-variation-settings: normal !important;
  letter-spacing: 0 !important;
  tab-size: 2;
  -moz-tab-size: 2;
}
.dynamic-code-textarea {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  color: transparent;
  caret-color: #000;
  border: none;
  outline: none;
  resize: none;
  padding: var(--slidev-code-padding);
  margin: 0;
  white-space: pre;
  overflow: hidden;
  box-sizing: border-box;
  border-radius: inherit;
  transition: box-shadow 120ms ease, background-color 120ms ease;
}
html.dark .dynamic-code-textarea { caret-color: #fff; }
.dynamic-code-textarea::selection { background: rgb(127 127 127 / 0.4); }
.dynamic-code-textarea:focus:not([readonly]) {
  box-shadow: inset 0 0 0 2px rgb(from var(--slidev-controls-foreground, #60a5fa) r g b / 0.7);
  background-color: rgb(from var(--slidev-controls-foreground, #60a5fa) r g b / 0.06);
}
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
  z-index: 2;
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
  z-index: 2;
  pointer-events: none;
}
.dynamic-code-badge[data-status="rejected"] { color: #ef4444; }
.dynamic-code-badge[data-status="offline"]  { color: #f59e0b; }
.dynamic-code-badge[data-status="reconnecting"] { color: #f59e0b; }
.dynamic-code-badge[data-status="connected"]   { color: #10b981; }
</style>
