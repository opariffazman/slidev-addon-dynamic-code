<script setup lang="ts">
import configs from '#slidev/configs'
import { useClipboard, useDebounceFn } from '@vueuse/core'
import lz from 'lz-string'
import { computed, inject, onMounted, onUnmounted, ref, shallowRef, watch, watchEffect } from 'vue'
import { tryUseSlideContext } from '../composables/use-slidev-context'
import { parseHighlightRange } from '../lib/parse-ranges'
import { syncKey } from './sync-key'

const props = defineProps<{
  id: string
  lang: string
  originHash: string
  codeLz: string
  ranges?: string[]
}>()

const sync = inject(syncKey, null)
const slideCtx = tryUseSlideContext()

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

const displayContent = computed(() => {
  if (sync?.mode === 'presenter')
    return liveContent.value
  return incomingContent.value ?? liveContent.value
})

const clicksCtx: any = slideCtx?.$clicksContext ?? null

// Per-mount unique id for $clicksContext bookkeeping. Crypto-random is fine —
// no persistence across mounts, never reused within a session. Distinct from
// the deck-wide block `id` prop (which IS persistent and used by the sync
// layer).
const componentId = `dyn-${Math.random().toString(36).slice(2, 10)}`
// calculateSince + register both happen in onMounted (matches Slidev's own
// CodeBlockWrapper convention) so we don't depend on undocumented setup-time
// behavior of $clicksContext. Tradeoff: clicksInfo is null on the very first
// render frame, which means inReveal is false then — a single-frame editable
// flash for ranges blocks during the setup→onMounted window. Acceptable: by
// the time a user can interact, onMounted has long since fired.
const clicksInfo = shallowRef<{ start: number, end: number } | null>(null)

// 1-based index into `ranges` for the currently-displayed step. -1 means the
// reveal pipeline is inactive (no ranges, or context unavailable).
const revealIndex = computed(() => {
  if (!props.ranges?.length || !clicksCtx || !clicksInfo.value)
    return -1
  return Math.max(0, clicksCtx.current - clicksInfo.value.start + 1)
})

// True while the user is still walking through reveal steps before the final
// one. Unlocks editing once the final ranges item is displayed.
const inReveal = computed(() => {
  if (!props.ranges?.length || revealIndex.value < 0)
    return false
  return revealIndex.value < props.ranges.length - 1
})

const debouncedBroadcast = useDebounceFn((value: string) => {
  sync?.broadcastEdit(props.id, props.originHash, value)
}, 200)

watch(incomingContent, (val, oldVal) => {
  if (val != null)
    liveContent.value = val
  else if (oldVal != null)
    liveContent.value = fenced
}, { immediate: true })

watch(liveContent, (val) => {
  if (sync?.mode !== 'presenter')
    return
  if (inReveal.value)
    return // suppress edits during reveal phase
  if (val === incomingContent.value)
    return
  debouncedBroadcast(val)
})

const wrapperRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (!clicksCtx || !props.ranges?.length)
    return
  clicksInfo.value = clicksCtx.calculateSince('+1', props.ranges.length - 1)
  clicksCtx.register(componentId, clicksInfo.value)
})

onUnmounted(() => {
  if (clicksCtx && clicksInfo.value)
    clicksCtx.unregister(componentId)
})

// Returns the highlight spec to apply at the current step, handling Slidev's
// "hide" fallthrough convention (hide step uses the NEXT range for highlight
// and asks the wrapper to take on the v-click-hidden class).
const currentRange = computed<{ spec: string, hide: boolean }>(() => {
  if (!props.ranges?.length || revealIndex.value < 0)
    return { spec: 'all', hide: false }
  const clamped = Math.min(revealIndex.value, props.ranges.length - 1)
  let spec = props.ranges[clamped]!
  const hide = spec === 'hide'
  if (hide)
    spec = props.ranges[clamped + 1] ?? props.ranges.at(-1)!
  return { spec, hide }
})

const readonly = computed(() => sync?.mode !== 'presenter' || inReveal.value)

const codeCopyEnabled = (configs as Record<string, unknown>).codeCopy !== false

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

watchEffect(() => {
  if (!highlightedHtml.value)
    return
  const wrapEl = wrapperRef.value
  if (!wrapEl)
    return
  const pre = wrapEl.querySelector<HTMLElement>('.dynamic-code-render pre.shiki')
  if (!pre)
    return

  const { spec, hide } = currentRange.value
  // Class names hardcoded on purpose — class names are user-facing CSS surface
  // and more stable than module-internal exports from @slidev/client.
  // - 'slidev-vclick-hidden' is the v-click hide state.
  // - 'slidev-code-highlighted' / 'slidev-code-dishonored' are the per-line
  //   classes Slidev's own updateCodeHighlightRange toggles; only the
  //   dishonored rule has visible styling (opacity: 0.3), which is what
  //   produces the "dim non-highlighted lines" effect.
  // - 'highlighted' / 'dishonored' are the legacy aliases Slidev still
  //   maintains for back-compat. We mirror them so any consumer theme that
  //   relies on the legacy names also dims correctly.
  wrapEl.classList.toggle('slidev-vclick-hidden', hide)

  const lines = Array.from(pre.querySelectorAll<HTMLElement>('code > .line'))
  const hl = parseHighlightRange(spec, lines.length)
  lines.forEach((el, i) => {
    const isHighlighted = hl.has(i + 1)
    el.classList.toggle('slidev-code-highlighted', isHighlighted)
    el.classList.toggle('slidev-code-dishonored', !isHighlighted)
    el.classList.toggle('highlighted', isHighlighted)
    el.classList.toggle('dishonored', !isHighlighted)
  })
}, { flush: 'post' })
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
      v-if="codeCopyEnabled"
      class="slidev-code-copy dynamic-code-copy"
      :class="{ 'is-copied': copied }"
      :title="copied ? 'Copied' : 'Copy'"
      type="button"
      @click="onCopy"
    >
      <svg v-if="copied" class="dynamic-code-copy-icon" viewBox="0 0 256 256" fill="currentColor">
        <path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z" />
      </svg>
      <svg v-else class="dynamic-code-copy-icon" viewBox="0 0 256 256" fill="currentColor">
        <path d="M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-72,0a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm72,184H56V48H82.75A47.93,47.93,0,0,0,80,64v8a8,8,0,0,0,8,8h80a8,8,0,0,0,8-8V64a47.93,47.93,0,0,0-2.75-16H200Z" />
      </svg>
    </button>
  </div>
</template>

<style>
.dynamic-code-wrapper {
  position: relative;
  overflow: hidden;
  border-radius: var(--slidev-code-radius);
}
.dynamic-code-render pre.slidev-code {
  margin: 0;
}
/* Force identical glyph metrics on the visible code and the overlaid
   textarea so the caret stays under the character the user is typing.
   Mirrors the pattern slidev's own ShikiEditor.vue uses.
   This <style> block is unscoped on purpose so we can target the
   v-html-rendered shiki output without :deep(). */
.dynamic-code-render pre.slidev-code,
.dynamic-code-render pre.slidev-code code,
.dynamic-code-render pre.slidev-code .line,
.dynamic-code-render pre.slidev-code span,
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
  top: 0;
  right: 0;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms;
  z-index: 2;
  padding: 0.5rem;
}
.dynamic-code-copy-icon {
  width: 1.25rem;
  height: 1.25rem;
  display: block;
}
.dynamic-code-wrapper:hover .dynamic-code-copy { opacity: 0.2; }
.dynamic-code-copy:hover { opacity: 1 !important; }
.dynamic-code-copy.is-copied { color: #10b981; opacity: 1 !important; }
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
