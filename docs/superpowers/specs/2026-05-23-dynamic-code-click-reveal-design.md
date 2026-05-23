# Design — Click-Stepped Line Reveal on `{dynamic}` Blocks

- **Status**: proposed
- **Date**: 2026-05-23
- **Tracking issue**: [#1](https://github.com/opariffazman/slidev-addon-dynamic-code/issues/1)
- **Target version**: `slidev-addon-dynamic-code@0.2.0`
- **Slidev floor**: `^52.15.0` (unchanged)

## Problem

The addon today rejects the combined info-string `{dynamic id=foo} {2-3|5|all}` at build
time. `emit.ts:18-20` forwards any second brace group as a Vue `v-bind` expression — but
Slidev's click-step line-reveal grammar (`{all|1|3|5}`, `{2-3|5|all}`, etc.) is not a JS
expression, so Vue's compiler errors with `Unexpected token, expected ","`.

Today an author must choose: dynamic editing OR click-stepped highlighting. Cannot have
both. Issue #1 documents the diagnosis; the addon's most natural audience (teaching /
lab decks that walk through a script line-by-line) hits this combination constantly.

## Goals

1. Author can write `{dynamic id=foo} {2-3|5|all}` and have it Just Work — line reveal
   happens click-by-click, then the block becomes editable at the final step.
2. Existing dynamic blocks without reveal syntax keep current behavior, unchanged.
3. Non-dynamic blocks untouched — Slidev's native `<CodeBlockWrapper>` mechanism is not
   replaced or interfered with.
4. Graceful degrade: if Slidev's click-context API is unavailable (older version, admin
   route, future API change), the block renders and is immediately editable — no crash.

## Non-goals

- Editing DURING reveal phase. Textarea is read-only until all reveal clicks consumed.
- Re-implementing every Slidev code-block modifier. `{at:N}`, `{lines:true}`,
  `{startLine:N}`, `{maxHeight:'…'}` are warned + ignored in v0.2.0. Easy to add later if
  demand exists.
- Magic Move (` ```md magic-move`) integration. Different feature, different syntax,
  out of scope.
- Multi-presenter / collaborative editing semantics during reveal.
- Re-running shiki transformer pipeline that Slidev itself runs (line numbers, diff
  notation, etc.). DynamicCode renders its own shiki via `shiki.codeToHtml` — that
  stays as-is; only line-highlight classes are applied on top.

## Behavior contract

### Author syntax

```md
```bash {dynamic id=foo-1} {2-3|5|all}
echo a
echo b
echo c
echo d
echo e
```
```

- First brace group: existing `{dynamic id=NAME}` directive (unchanged).
- Second brace group: Slidev-native line-highlight grammar.
  - `|` separates click steps.
  - Each step: comma-separated line numbers / ranges `n-m` / `all` / `*` / `hide`.
  - Examples: `{2-3|5|all}` · `{1,3,5|7-9|*}` · `{hide|2-3|all}`.

### State machine

| Phase | Condition | Highlight | Textarea |
| --- | --- | --- | --- |
| Reveal | `clicksCtx.current < clicksInfo.end` | active per current step | read-only, no sync writes |
| Final | `clicksCtx.current >= clicksInfo.end` | `all` (no dimming) | editable for presenter, edits broadcast |

- Audience: always read-only (existing behavior).
- Presenter without `ranges`: editable immediately (existing behavior).
- Presenter with `ranges`: read-only during reveal, editable at final.

### Backward navigation (edit + click-back)

Edits persist. Navigating backward through clicks re-enters reveal phase (textarea
re-locks read-only) and re-applies highlight ranges to the *edited* content using the
*original* line numbers. If the presenter inserted/removed lines, visual highlight may
mis-align — accepted tradeoff for simplest state machine. Documented in README.

### Graceful degrade

`useSlideContext()` and `$clicksContext` are accessed inside a try/catch. If unavailable
(older Slidev, admin route, unexpected API change), the block behaves as if no
`ranges` were provided: textarea immediately editable for presenter, no highlight, no
crash.

### Sync gating

While `inReveal` is true, `debouncedBroadcast` is short-circuited — no edits propagate.
Defense in depth; the textarea is already read-only. Keeps the relay free of stray
events if a bug ever unlocks the textarea prematurely.

## Grammar & parser

### Input shapes

Accepted (parsed into `ranges: string[]`):

```
{2-3|5|all}
{1,3,5}
{2-3,5|7-9|*}
{hide|2-3|all}
```

Warned + ignored (returns `ranges: null`):

```
{maxHeight:"200px"}
{at:3,lines:true}
{startLine:10}
```

Detection rule: input is treated as ranges if every pipe-separated segment, after
splitting by `,`, contains only tokens matching `^(\*|all|hide|\d+(-\d+)?)$`. Anything
else → not ranges → warn + drop. Conservative: false negatives (a valid range pattern
mis-detected) are unlikely; false positives (a modifier mis-detected as ranges) would
register bogus clicks.

### New module

`packages/addon/lib/parse-ranges.ts`:

```ts
export function parseRangeSteps(s: string | null): string[] | null
//  "2-3|5|all" → ["2-3", "5", "all"]
//  "1,3"       → ["1,3"]
//  null / non-range pattern → null

export function parseHighlightRange(spec: string, lineCount: number, startLine = 1): Set<number>
//  "1,3-5", "all", "*", "hide" → set of 1-based line indices to highlight
//  "hide" / "all" / "*" handled as special cases
```

### Updated `parse-directive.ts`

```ts
export interface DynamicDirective {
  lang: string
  id: string | null
  ranges: string[] | null   // replaces extraMeta
}
```

When the second brace group is present but `parseRangeSteps` returns `null`, emit a
build-time warning naming the slide and block id: `[dynamic-code] id="foo" on slide 4:
ignored unsupported extras "{maxHeight:'200px'}" — only line-highlight syntax
{n|m|all} is supported on dynamic blocks in v0.2.0`.

### Updated `emit.ts`

Drops the `v-bind` path entirely. When `ranges` is present:

```ts
return `<DynamicCode id="..." lang="..." origin-hash="..." code-lz="..." :ranges='${JSON.stringify(input.ranges)}' />`
```

Single-quote attribute delimiter so JSON's double-quotes don't need escaping. `ranges`
content is structured data the addon controls — no user-supplied strings inside JSON
beyond ascii digits / `-` / `,` / `*` / `all` / `hide`, so single-quote-then-JSON is
safe.

When `ranges` is null, no `:ranges` attr emitted (existing behavior preserved exactly).

## Component changes

### `DynamicCode.vue`

New prop:

```ts
const props = defineProps<{
  id: string
  lang: string
  originHash: string
  codeLz: string
  ranges?: string[]   // NEW
}>()
```

Slidev context wiring (soft):

```ts
const slideCtx = (() => {
  try { return useSlideContext() }
  catch { return null }
})()
const clicksCtx = slideCtx?.$clicksContext ?? null
```

Click registration (only if `ranges` present AND `clicksCtx` available):

```ts
const componentId = makeUniqueId()              // per-mount
let clicksInfo: { start: number; end: number } | null = null

onMounted(() => {
  if (!clicksCtx || !props.ranges?.length) return
  clicksInfo = clicksCtx.calculateSince('+1', props.ranges.length - 1)
  clicksCtx.register(componentId, clicksInfo)
})

onUnmounted(() => {
  clicksCtx?.unregister(componentId)
})
```

Reveal computeds:

```ts
const inReveal = computed(() => {
  if (!props.ranges?.length || !clicksCtx || !clicksInfo) return false
  return clicksCtx.current < clicksInfo.end
})

// Returns the range string to apply for the current click step.
// Handles "hide" fallthrough exactly like Slidev's CodeBlockWrapper.vue.
const currentRange = computed<{ spec: string; hide: boolean }>(() => {
  if (!props.ranges?.length || !inReveal.value || !clicksInfo)
    return { spec: 'all', hide: false }
  const idx = Math.max(0, clicksCtx!.current - clicksInfo.start + 1)
  let spec = props.ranges[idx] ?? props.ranges.at(-1)!
  const hide = spec === 'hide'
  if (hide)
    spec = props.ranges[idx + 1] ?? props.ranges.at(-1)!
  return { spec, hide }
})
```

Gating:

```ts
const readonly = computed(() =>
  sync?.mode !== 'presenter' || inReveal.value
)

watch(liveContent, (val) => {
  if (sync?.mode !== 'presenter') return
  if (inReveal.value) return                    // NEW: defense in depth
  if (val === incomingContent.value) return
  debouncedBroadcast(val)
})
```

Highlight DOM apply:

```ts
watchEffect(() => {
  if (!highlightedHtml.value) return
  const pre = wrapperRef.value?.querySelector('.dynamic-code-render pre.shiki')
  if (!pre) return

  const { spec, hide } = currentRange.value
  const lines = Array.from(pre.querySelectorAll('code > .line'))

  // 'slidev-vclick-hidden' is Slidev's CSS class for v-click hide state
  // (declared in @slidev/client/styles/code.css). Hardcoded on purpose — class
  // names are user-facing API surface and more stable than module-internal
  // exports.
  wrapperRef.value?.classList.toggle('slidev-vclick-hidden', hide)

  const hl = parseHighlightRange(spec, lines.length)
  lines.forEach((el, i) => {
    el.classList.toggle('highlighted', hl.has(i + 1))
  })
  pre.classList.toggle('has-highlighted', hl.size > 0 && hl.size < lines.length)
})
```

CSS: existing Slidev styles for `.line.highlighted` and the
`pre:has(.line.highlighted) .line:not(.highlighted)` dim selector are loaded from
`@slidev/client/styles/code.css` via Slidev's normal client bundle. No new CSS rules
added in this addon for highlight/dim — we adopt Slidev's classes verbatim. Verify
during implementation that Slidev's dimming actually uses `:has()` and not a parent
class like `.has-highlighted`; if the latter, the `pre.classList.toggle(...)` above is
needed. If `:has()`, the toggle is harmless extra.

## File diff summary

**New (3)**:
- `packages/addon/lib/parse-ranges.ts`
- `packages/addon/test/parse-ranges.test.ts`
- `docs/superpowers/specs/2026-05-23-dynamic-code-click-reveal-design.md` (this file)

**Modified (5)**:
- `packages/addon/lib/parse-directive.ts` — `extraMeta` → `ranges`, calls
  `parseRangeSteps`, warns on modifier-shape extras.
- `packages/addon/lib/emit.ts` — drops `v-bind`, emits `:ranges='[...]'` JSON-encoded.
- `packages/addon/components/DynamicCode.vue` — adds `ranges` prop,
  `useSlideContext` (soft), click register/unregister, `inReveal` /
  `currentRange` computeds, gates `readonly` + sync writes, adds highlight
  watchEffect.
- `packages/addon/test/{emit,parse-directive,DynamicCode}.test.ts` — updated per
  Tests section below.
- `packages/addon/package.json` — verify `@slidev/client` reachable (likely transitive
  via `@slidev/types`); add to `peerDependencies` if not.

**Untouched**:
- `packages/relay/**` — wire protocol unchanged.
- `hash.ts`, `protocol.ts`, `read-config.ts`, `registry.ts`, `setup/*`,
  `composables/*`, `AdminPage.vue`.

## Tests

`packages/addon/test/parse-ranges.test.ts` (new):
- `null` / empty → `null`
- `"2-3|5|all"` → `["2-3", "5", "all"]`
- `"1,3,5"` → `["1,3,5"]`
- `"hide|2-3|*"` → `["hide", "2-3", "*"]`
- `'maxHeight:"200px"'` → `null`
- `"a|b|c"` → `null`
- `parseHighlightRange("2-3,5", 10)` → `{2,3,5}`
- `parseHighlightRange("all", 4)` → `{1,2,3,4}`
- `parseHighlightRange("hide", 4)` → `{}`

`packages/addon/test/parse-directive.test.ts` (update):
- `{dynamic id=foo} {2-3|5|all}` → `{ id: "foo", ranges: ["2-3","5","all"] }`
- `{dynamic id=foo} {maxHeight:"200px"}` → `{ id: "foo", ranges: null }` + warn captured

`packages/addon/test/emit.test.ts` (update):
- Drop existing `v-bind` test.
- `ranges: ["2-3","5","all"]` → output contains `:ranges='["2-3","5","all"]'`
- `ranges: null` → no `:ranges` attribute emitted (asserts existing snapshot stays
  exactly the same)

`packages/addon/test/DynamicCode.test.ts` (update):
- No `ranges`: presenter textarea editable immediately, `broadcastEdit` called on
  input (existing tests preserved).
- `ranges` provided, `$clicksContext` mock with `current=0`, `register` returns
  `{start:0,end:3}`: presenter textarea read-only, `broadcastEdit` NOT called on
  programmatic input.
- `ranges` provided, mock `current` advanced to `>= end`: presenter textarea
  editable, `broadcastEdit` called.
- `ranges` provided but `useSlideContext` throws: behaves like no-ranges case
  (immediate unlock).
- After shiki render, lines matching current range have `.highlighted` class;
  others do not. Range advances on `current` change.

No relay-side tests added or modified.

**Manual smoke test** (not in CI, documented in PR description):

1. `pnpm pack` into `vendor/`, install in a real deck via `file:./vendor/...`.
2. Slide with `\`\`\`bash {dynamic id=demo} {2-3|5|all}` and 5 lines of bash.
3. Click 1 → lines 2-3 highlighted, textarea read-only, no caret cursor on focus.
4. Click 2 → line 5 highlighted, still read-only.
5. Click 3 → no dimming, textarea now accepts input.
6. Type → audience tab (separate browser) reflects edit live.
7. Click back → textarea re-locks, highlight returns.
8. Reset via Ctrl+Shift+R → content restored to fenced original, click position
   unchanged.

## Risks & mitigations

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| `$clicksContext` API changes shape in future Slidev | medium (undocumented internal) | try/catch + graceful degrade. Block keeps working; only loses reveal. |
| Line-highlight CSS classes (`.highlighted`, dimming selector) change in Slidev | low (stable for years) | reuse Slidev's classes, document the dependency; if they break, re-pin or ship our own CSS. |
| Click count registered per block conflicts with other slide elements' clicks | low | use Slidev's own `register`/`calculateSince` so accounting matches `<CodeBlockWrapper>` exactly. |
| Edit during back-navigation: line numbers point at wrong lines after edit | by design | documented in README; trivial visual issue, not a correctness bug. |
| JSON-in-attribute emission breaks on unexpected chars | low | `ranges` content is constrained to digits / `-` / `,` / `*` / `all` / `hide`; single-quote outer + JSON inner is safe. |
| Per-mount `componentId` collides on hot reload | low | use a counter or `Math.random().toString(36)` — never reused within session. |

## Out of scope (do not add)

- Multi-presenter / collaborative editing during reveal.
- Code execution inside the block.
- Per-keystroke history / undo across reloads.
- VS Code extension integration.
- Themable reveal CSS — adopt Slidev's `.highlighted` look as-is.
- `{at:N}` / `{lines:true}` / `{startLine:N}` / `{maxHeight:'…'}` modifiers — warn +
  ignore in v0.2.0; revisit if demand surfaces.
- Magic Move combination.

## Versioning

Single PR. Single semver bump: `0.1.x` → `0.2.0` (feature, minor).
README addendum in the same PR documenting the new syntax, the state machine, and the
edit-during-back caveat.
