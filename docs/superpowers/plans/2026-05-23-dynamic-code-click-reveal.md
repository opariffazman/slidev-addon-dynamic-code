# Dynamic Code Click-Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add support for the combined info-string `` ```bash {dynamic id=foo} {2-3|5|all} `` so a dynamic code block can do Slidev's native click-stepped line reveal during the talk and become editable once the final reveal step is reached. Resolves [#1](https://github.com/opariffazman/slidev-addon-dynamic-code/issues/1).

**Architecture:** Replace `extraMeta` (forwarded as a doomed `v-bind` expression) with a typed `ranges: string[]` prop parsed at build time. The Vue component soft-imports `useSlideContext` from `@slidev/client`, registers per-mount click counts via the (undocumented but stable) `$clicksContext` API, and on each click toggles the same `.highlighted` / dim CSS classes that Slidev's own `<CodeBlockWrapper>` uses. Edit gating is a single computed `inReveal = revealIndex < ranges.length - 1` — read-only during reveal, editable while the final reveal item is displayed. Falls back silently if Slidev's context is absent.

**Tech Stack:** TypeScript, Vue 3 Composition API, Vitest + @vue/test-utils + happy-dom, Slidev `>= 52.15.0`, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-05-23-dynamic-code-click-reveal-design.md`

---

## File Structure

**New files:**
- `packages/addon/lib/parse-ranges.ts` — pure parser: info-string → `string[]` of step specs; spec string → `Set<number>` of line indices.
- `packages/addon/test/parse-ranges.test.ts` — unit tests for the parser.

**Modified files:**
- `packages/addon/lib/parse-directive.ts` — replace `extraMeta: string | null` with `ranges: string[] | null` on `DynamicDirective`; call `parseRangeSteps()`; warn on modifier-shape extras.
- `packages/addon/test/parse-directive.test.ts` — update tests to new shape.
- `packages/addon/lib/emit.ts` — replace `extraMeta` field on `EmitInput` with `ranges`; drop `v-bind` path; emit `:ranges='[...]'` (JSON inside single-quoted attribute).
- `packages/addon/test/emit.test.ts` — drop the v-bind test, add ranges-emission tests.
- `packages/addon/setup/transformers.ts` — pass `parsed.ranges` to `emitDynamicCode` instead of `parsed.extraMeta`.
- `packages/addon/components/DynamicCode.vue` — add `ranges` prop; soft-import `useSlideContext`; register/unregister click count; add `revealIndex` / `inReveal` / `currentRange` computeds; gate `readonly` and sync writes; add highlight-class watchEffect.
- `packages/addon/test/DynamicCode.test.ts` — new tests for reveal-phase readonly, sync suppression, highlight classes, hide fallthrough, graceful degrade.
- `packages/addon/package.json` — add `@slidev/client` to `peerDependencies`; bump `version` to `0.2.0`.
- `packages/addon/README.md` — add a section documenting the new combined syntax, the state machine, the edit-during-back caveat, and the warned-and-ignored modifier list.

**Untouched:**
- `packages/relay/**` — wire protocol unchanged.
- All other addon files.

---

## Task 1: Parser — `parseRangeSteps` (info-string → string[])

**Files:**
- Create: `packages/addon/lib/parse-ranges.ts`
- Create: `packages/addon/test/parse-ranges.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/addon/test/parse-ranges.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseRangeSteps } from '../lib/parse-ranges'

describe('parseRangeSteps', () => {
  it('returns null for null / empty / whitespace', () => {
    expect(parseRangeSteps(null)).toBeNull()
    expect(parseRangeSteps('')).toBeNull()
    expect(parseRangeSteps('   ')).toBeNull()
  })

  it('parses a single step with one range', () => {
    expect(parseRangeSteps('2-3')).toEqual(['2-3'])
    expect(parseRangeSteps('5')).toEqual(['5'])
  })

  it('parses a single step with a comma set', () => {
    expect(parseRangeSteps('1,3,5')).toEqual(['1,3,5'])
  })

  it('parses pipe-separated steps', () => {
    expect(parseRangeSteps('2-3|5|all')).toEqual(['2-3', '5', 'all'])
  })

  it('accepts * and all as full-block aliases', () => {
    expect(parseRangeSteps('1|*|all')).toEqual(['1', '*', 'all'])
  })

  it('accepts hide as a step keyword', () => {
    expect(parseRangeSteps('hide|2-3|all')).toEqual(['hide', '2-3', 'all'])
  })

  it('accepts mixed comma + range within a step', () => {
    expect(parseRangeSteps('2-3,5|7-9|*')).toEqual(['2-3,5', '7-9', '*'])
  })

  it('trims surrounding whitespace inside steps', () => {
    expect(parseRangeSteps(' 2-3 | 5 | all ')).toEqual(['2-3', '5', 'all'])
  })

  it('returns null for modifier-shape input (key:value)', () => {
    expect(parseRangeSteps('maxHeight:"200px"')).toBeNull()
    expect(parseRangeSteps('at:3,lines:true')).toBeNull()
    expect(parseRangeSteps('startLine:10')).toBeNull()
  })

  it('returns null for non-range tokens', () => {
    expect(parseRangeSteps('a|b|c')).toBeNull()
    expect(parseRangeSteps('1|foo|3')).toBeNull()
  })

  it('returns null when any step is empty', () => {
    expect(parseRangeSteps('1||3')).toBeNull()
    expect(parseRangeSteps('|1|2')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F slidev-addon-dynamic-code test test/parse-ranges.test.ts`
Expected: FAIL with "Cannot find module '../lib/parse-ranges'"

- [ ] **Step 3: Write minimal implementation**

Create `packages/addon/lib/parse-ranges.ts`:

```ts
const TOKEN_RE = /^(?:\*|all|hide|\d+(?:-\d+)?)$/

export function parseRangeSteps(s: string | null): string[] | null {
  if (s == null)
    return null
  const trimmed = s.trim()
  if (!trimmed)
    return null
  const steps = trimmed.split('|').map(seg => seg.trim())
  if (steps.length === 0 || steps.some(seg => seg === ''))
    return null
  for (const step of steps) {
    const tokens = step.split(',').map(t => t.trim())
    if (tokens.length === 0 || tokens.some(t => !TOKEN_RE.test(t)))
      return null
  }
  return steps
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F slidev-addon-dynamic-code test test/parse-ranges.test.ts`
Expected: PASS — all `parseRangeSteps` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/addon/lib/parse-ranges.ts packages/addon/test/parse-ranges.test.ts
git commit -m "feat(addon): add parseRangeSteps for click-step info-string parsing"
```

---

## Task 2: Parser — `parseHighlightRange` (spec string → line index set)

**Files:**
- Modify: `packages/addon/lib/parse-ranges.ts`
- Modify: `packages/addon/test/parse-ranges.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `packages/addon/test/parse-ranges.test.ts`:

```ts
import { parseHighlightRange } from '../lib/parse-ranges'

describe('parseHighlightRange', () => {
  it('returns an empty set for "all"', () => {
    expect([...parseHighlightRange('all', 4)]).toEqual([])
  })

  it('returns an empty set for "*"', () => {
    expect([...parseHighlightRange('*', 4)]).toEqual([])
  })

  it('returns an empty set for "hide"', () => {
    expect([...parseHighlightRange('hide', 4)]).toEqual([])
  })

  it('parses a single line', () => {
    expect([...parseHighlightRange('3', 10).values()].sort((a, b) => a - b)).toEqual([3])
  })

  it('parses a range', () => {
    expect([...parseHighlightRange('2-4', 10).values()].sort((a, b) => a - b)).toEqual([2, 3, 4])
  })

  it('parses a comma set with a range', () => {
    expect([...parseHighlightRange('2-3,5', 10).values()].sort((a, b) => a - b)).toEqual([2, 3, 5])
  })

  it('silently drops out-of-range line numbers', () => {
    expect([...parseHighlightRange('2-3,5', 4).values()].sort((a, b) => a - b)).toEqual([2, 3])
    expect([...parseHighlightRange('99', 4)]).toEqual([])
  })

  it('silently drops line 0 and negatives in degenerate ranges', () => {
    expect([...parseHighlightRange('0', 4)]).toEqual([])
  })

  it('handles reverse ranges by normalizing low..high', () => {
    expect([...parseHighlightRange('4-2', 10).values()].sort((a, b) => a - b)).toEqual([2, 3, 4])
  })

  it('returns an empty set for unrecognized spec', () => {
    expect([...parseHighlightRange('foo', 10)]).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -F slidev-addon-dynamic-code test test/parse-ranges.test.ts`
Expected: FAIL with "parseHighlightRange is not a function" or import error.

- [ ] **Step 3: Implement `parseHighlightRange`**

Append to `packages/addon/lib/parse-ranges.ts`:

```ts
export function parseHighlightRange(spec: string, lineCount: number): Set<number> {
  const out = new Set<number>()
  const trimmed = spec.trim()
  if (trimmed === 'all' || trimmed === '*' || trimmed === 'hide')
    return out
  for (const tok of trimmed.split(',')) {
    const t = tok.trim()
    if (!t)
      continue
    const dash = t.indexOf('-')
    if (dash > 0) {
      const a = Number.parseInt(t.slice(0, dash), 10)
      const b = Number.parseInt(t.slice(dash + 1), 10)
      if (!Number.isFinite(a) || !Number.isFinite(b))
        continue
      const lo = Math.min(a, b)
      const hi = Math.max(a, b)
      for (let i = lo; i <= hi; i++) {
        if (i >= 1 && i <= lineCount)
          out.add(i)
      }
    }
    else {
      const n = Number.parseInt(t, 10)
      if (Number.isFinite(n) && n >= 1 && n <= lineCount)
        out.add(n)
    }
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F slidev-addon-dynamic-code test test/parse-ranges.test.ts`
Expected: PASS — both `parseRangeSteps` and `parseHighlightRange` describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add packages/addon/lib/parse-ranges.ts packages/addon/test/parse-ranges.test.ts
git commit -m "feat(addon): add parseHighlightRange for resolving step spec to line set"
```

---

## Task 3: `parse-directive.ts` — emit `ranges` instead of `extraMeta`

**Files:**
- Modify: `packages/addon/lib/parse-directive.ts`
- Modify: `packages/addon/test/parse-directive.test.ts`

- [ ] **Step 1: Update tests to the new shape**

Replace the entire contents of `packages/addon/test/parse-directive.test.ts` with:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseDynamicDirective } from '../lib/parse-directive'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseDynamicDirective', () => {
  it('returns null when {dynamic} is absent', () => {
    expect(parseDynamicDirective('bash')).toBeNull()
    expect(parseDynamicDirective('ts {monaco}')).toBeNull()
  })

  it('parses {dynamic id=NAME} and returns lang + id', () => {
    expect(parseDynamicDirective('bash {dynamic id=install}')).toEqual({
      lang: 'bash',
      id: 'install',
      ranges: null,
    })
  })

  it('parses a trailing line-highlight group as ranges', () => {
    expect(parseDynamicDirective('bash {dynamic id=install} {2-3|5|all}')).toEqual({
      lang: 'bash',
      id: 'install',
      ranges: ['2-3', '5', 'all'],
    })
  })

  it('warns and drops a trailing modifier-shape extras group', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseDynamicDirective('bash {dynamic id=install} {maxHeight:"200px"}')).toEqual({
      lang: 'bash',
      id: 'install',
      ranges: null,
    })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('[dynamic-code]')
    expect(warn.mock.calls[0]![0]).toContain('install')
    expect(warn.mock.calls[0]![0]).toContain('maxHeight')
  })

  it('returns a "missing id" sentinel when id is absent', () => {
    expect(parseDynamicDirective('bash {dynamic}')).toEqual({
      lang: 'bash',
      id: null,
      ranges: null,
    })
  })

  it('accepts id with letters, digits, _ and -', () => {
    expect(parseDynamicDirective('bash {dynamic id=install_step-2}')!.id).toBe('install_step-2')
  })

  it('treats id with disallowed characters as no id', () => {
    expect(parseDynamicDirective('bash {dynamic id=foo bar}')).toEqual({
      lang: 'bash',
      id: null,
      ranges: null,
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -F slidev-addon-dynamic-code test test/parse-directive.test.ts`
Expected: FAIL — old tests reference `extraMeta` field which now expects `ranges`.

- [ ] **Step 3: Rewrite `parse-directive.ts`**

Replace the entire contents of `packages/addon/lib/parse-directive.ts` with:

```ts
import { parseRangeSteps } from './parse-ranges'

const RE_OUTER = /^([\w'-]+)?\s*\{dynamic([^}]*)\}\s*(?:\{([^}]*)\})?/
const RE_ID = /^\s+id=([\w-]+)\s*$/

export interface DynamicDirective {
  lang: string
  id: string | null
  ranges: string[] | null
}

export function parseDynamicDirective(info: string): DynamicDirective | null {
  const trimmed = info.trim()
  if (!trimmed.includes('{dynamic'))
    return null
  const match = trimmed.match(RE_OUTER)
  if (!match)
    return null
  const [, lang = '', innerContent = '', extrasContent] = match
  const idMatch = innerContent.match(RE_ID)
  const id = idMatch ? idMatch[1]! : null

  let ranges: string[] | null = null
  if (extrasContent != null) {
    ranges = parseRangeSteps(extrasContent)
    if (ranges == null) {
      console.warn(
        `[dynamic-code] id="${id ?? '<missing>'}": ignored unsupported extras "{${extrasContent}}" — only line-highlight syntax {n|m|all} is supported on dynamic blocks in v0.2.0`,
      )
    }
  }

  return { lang, id, ranges }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F slidev-addon-dynamic-code test test/parse-directive.test.ts`
Expected: PASS — all parse-directive tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/addon/lib/parse-directive.ts packages/addon/test/parse-directive.test.ts
git commit -m "feat(addon): parse {n|m|all} as ranges, warn on modifier-shape extras

Replaces the extraMeta field on DynamicDirective with a typed
ranges: string[] | null derived via parseRangeSteps. Anything that
doesn't match the line-highlight grammar (e.g. {maxHeight:'200px'})
is dropped with a build-time warning instead of being forwarded."
```

---

## Task 4: `emit.ts` — drop `v-bind`, emit `:ranges='[...]'`

**Files:**
- Modify: `packages/addon/lib/emit.ts`
- Modify: `packages/addon/test/emit.test.ts`

- [ ] **Step 1: Update tests**

Replace the entire contents of `packages/addon/test/emit.test.ts` with:

```ts
import lz from 'lz-string'
import { describe, expect, it } from 'vitest'
import { emitDynamicCode } from '../lib/emit'

describe('emitDynamicCode', () => {
  it('emits a DynamicCode tag with required attrs', async () => {
    const html = await emitDynamicCode({
      id: 'install',
      lang: 'bash',
      code: 'npm install foo',
      ranges: null,
    })
    expect(html).toContain('<DynamicCode')
    expect(html).toContain('id="install"')
    expect(html).toContain('lang="bash"')
    expect(html).toMatch(/origin-hash="[0-9a-f]{12}"/)
    const codeLzMatch = html.match(/code-lz="([^"]+)"/)
    expect(codeLzMatch).toBeTruthy()
    expect(lz.decompressFromBase64(codeLzMatch![1]!)).toBe('npm install foo')
  })

  it('does NOT emit a :ranges attr when ranges is null', async () => {
    const html = await emitDynamicCode({
      id: 'install',
      lang: 'bash',
      code: 'echo',
      ranges: null,
    })
    expect(html).not.toContain(':ranges')
    expect(html).not.toContain('v-bind')
  })

  it('emits :ranges as a single-quoted JSON array when ranges are present', async () => {
    const html = await emitDynamicCode({
      id: 'install',
      lang: 'bash',
      code: 'echo',
      ranges: ['2-3', '5', 'all'],
    })
    expect(html).toContain(`:ranges='["2-3","5","all"]'`)
    expect(html).not.toContain('v-bind')
  })

  it('escapes the id attribute', async () => {
    const html = await emitDynamicCode({
      id: 'foo"bar',
      lang: 'bash',
      code: 'echo',
      ranges: null,
    })
    expect(html).not.toContain('foo"bar"')
    expect(html).toContain('id="foo&quot;bar"')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -F slidev-addon-dynamic-code test test/emit.test.ts`
Expected: FAIL — old emit signature has `extraMeta`, tests now pass `ranges`.

- [ ] **Step 3: Rewrite `emit.ts`**

Replace the entire contents of `packages/addon/lib/emit.ts` with:

```ts
import lz from 'lz-string'
import { originHash } from './hash'

export interface EmitInput {
  id: string
  lang: string
  code: string
  ranges: string[] | null
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function emitDynamicCode(input: EmitInput): Promise<string> {
  const hash = await originHash(input.code)
  const encoded = lz.compressToBase64(input.code)
  const rangesAttr = input.ranges?.length
    ? ` :ranges='${JSON.stringify(input.ranges)}'`
    : ''
  return `<DynamicCode id="${escapeAttr(input.id)}" lang="${escapeAttr(input.lang)}" origin-hash="${hash}" code-lz="${encoded}"${rangesAttr} />`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F slidev-addon-dynamic-code test test/emit.test.ts`
Expected: PASS — all 4 emit tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/addon/lib/emit.ts packages/addon/test/emit.test.ts
git commit -m "feat(addon): emit :ranges='[...]' instead of v-bind for extras

The v-bind path tried to evaluate Slidev's click-step grammar
(e.g. {all|1|3|5}) as a JS expression, which always failed Vue
compile. Now we accept only parsed ranges and serialize them
as JSON inside a single-quoted Vue attribute binding."
```

---

## Task 5: `transformers.ts` — pass `ranges` through

**Files:**
- Modify: `packages/addon/setup/transformers.ts`

- [ ] **Step 1: Run typecheck — confirm the addon breaks because transformers.ts still references `extraMeta`**

Run: `pnpm -F slidev-addon-dynamic-code typecheck`
Expected: FAIL with a TS error from `packages/addon/setup/transformers.ts` along the lines of `Property 'extraMeta' does not exist on type 'DynamicDirective'`, AND/OR `Object literal may only specify known properties, and 'extraMeta' does not exist in type 'EmitInput'`.

- [ ] **Step 2: Update the transformer**

Replace the entire contents of `packages/addon/setup/transformers.ts` with:

```ts
import type { CodeblockTransformer } from '@slidev/types'
import { defineTransformersSetup } from '@slidev/types'
import { emitDynamicCode } from '../lib/emit'
import { parseDynamicDirective } from '../lib/parse-directive'
import { getIdRegistry } from '../lib/registry'

export function createDynamicCodeTransformer(): CodeblockTransformer {
  return async (ctx) => {
    const parsed = parseDynamicDirective(ctx.info)
    if (!parsed)
      return null

    const slideNo = (ctx.slide?.index ?? -1) + 1

    if (!parsed.id) {
      throw new Error(`[dynamic-code] missing required id=NAME on slide ${slideNo} (use {dynamic id=install-deps})`)
    }

    const registry = getIdRegistry(ctx.options)
    const prior = registry.get(parsed.id)
    if (prior != null && prior !== slideNo) {
      throw new Error(`[dynamic-code] duplicate id "${parsed.id}" on slides ${prior} and ${slideNo}; ids must be unique across the deck`)
    }
    registry.set(parsed.id, slideNo)

    return emitDynamicCode({
      id: parsed.id,
      lang: parsed.lang,
      code: ctx.code,
      ranges: parsed.ranges,
    })
  }
}

export default defineTransformersSetup(() => ({
  codeblocks: [createDynamicCodeTransformer()],
}))
```

- [ ] **Step 3: Re-run typecheck and transformer tests**

The existing `packages/addon/test/transformer.test.ts` does not reference `extraMeta`/`ranges` — it only asserts on emitted HTML strings (`id="install"`, `<DynamicCode`). No edit needed.

Run: `pnpm -F slidev-addon-dynamic-code typecheck && pnpm -F slidev-addon-dynamic-code test test/transformer.test.ts`
Expected: typecheck clean; all 5 transformer tests PASS.

- [ ] **Step 4: Run the full suite to see remaining gaps**

Run: `pnpm -F slidev-addon-dynamic-code test`
Expected: parse-ranges, parse-directive, emit, transformer suites PASS. DynamicCode component tests still PASS (unchanged today) — Tasks 6–10 will add new failing tests then implement.

- [ ] **Step 5: Commit**

```bash
git add packages/addon/setup/transformers.ts
git commit -m "feat(addon): forward parsed ranges through codeblock transformer"
```

---

## Task 6: `DynamicCode.vue` — add `ranges` prop + soft `useSlideContext` helper

**Files:**
- Create: `packages/addon/composables/use-slidev-context.ts`
- Modify: `packages/addon/components/DynamicCode.vue`
- Modify: `packages/addon/test/DynamicCode.test.ts`

**Approach:** Static-import `useSlideContext` from `@slidev/client` inside a tiny helper module. The helper exposes a function that calls the hook inside a try/catch and returns `null` on any failure. This isolates the soft-binding concern, gives us a stable point to mock in tests via `vi.mock` (no module-graph hacks), and avoids top-level `await` in the Vue component (which would force Suspense). `@slidev/client` is in peerDependencies (added in Task 11) and is in devDependencies so it resolves in tests too.

- [ ] **Step 1: Create the helper module**

Create `packages/addon/composables/use-slidev-context.ts`:

```ts
import { useSlideContext } from '@slidev/client'

// Soft accessor for Slidev's slide context. Returns null when the hook
// throws (called outside a slide tree, future API change, etc). The static
// import resolves at bundle time — @slidev/client is a peer dep, so Slidev's
// own Vite bundle satisfies it; in tests, vi.mock replaces this entire helper
// module so the import is never reached.
export function tryUseSlideContext(): { $clicksContext?: any } | null {
  try { return useSlideContext() as any }
  catch { return null }
}
```

- [ ] **Step 2: Add the hoisted-mock infrastructure to the test file**

At the top of `packages/addon/test/DynamicCode.test.ts`, immediately after the existing imports, add:

```ts
// Hoisted mock state for the Slidev context helper. Tests mutate `slidevMock`
// before mounting; vi.mock returns a function that reads the current value.
const slidevMock = vi.hoisted(() => ({
  // Mutable reference the mock factory will read at call time.
  hook: null as null | (() => { $clicksContext?: any } | null),
}))

vi.mock('../composables/use-slidev-context', () => ({
  tryUseSlideContext: () => slidevMock.hook ? slidevMock.hook() : null,
}))

beforeEach(() => {
  // Default to "no Slidev context" — graceful-degrade path.
  slidevMock.hook = null
})
```

Add `beforeEach` to the existing `import { ... } from 'vitest'` line.

- [ ] **Step 3: Add the failing test for the new prop + graceful degrade**

Append to `packages/addon/test/DynamicCode.test.ts`:

```ts
describe('<DynamicCode> ranges prop (graceful degrade)', () => {
  it('renders with a ranges prop even when no Slidev context is available', () => {
    // slidevMock.hook is null from beforeEach → tryUseSlideContext returns null
    const wrapper = mount(DynamicCode, {
      props: {
        id: 'install',
        lang: 'bash',
        originHash: 'h',
        codeLz,
        ranges: ['2-3', '5', 'all'],
      },
      global: { provide: provideStub({ mode: 'presenter' }) },
    })
    // No context → no reveal pipeline → presenter textarea editable immediately
    expect(wrapper.find('textarea').attributes('readonly')).toBeUndefined()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm -F slidev-addon-dynamic-code test test/DynamicCode.test.ts -t "graceful degrade"`
Expected: FAIL — Vue warns about unknown `ranges` prop OR import of `tryUseSlideContext` fails because component doesn't import it yet.

- [ ] **Step 5: Wire prop + helper into `DynamicCode.vue`**

In `packages/addon/components/DynamicCode.vue`, add this import to the existing import block at the top of `<script setup>`:

```ts
import { tryUseSlideContext } from '../composables/use-slidev-context'
```

Replace the existing `defineProps` call with:

```ts
const props = defineProps<{
  id: string
  lang: string
  originHash: string
  codeLz: string
  ranges?: string[]
}>()
```

Immediately after `const sync = inject(syncKey, null)`, add:

```ts
const slideCtx = tryUseSlideContext()
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm -F slidev-addon-dynamic-code test test/DynamicCode.test.ts -t "graceful degrade"`
Expected: PASS. All other existing tests still PASS too (the change is additive and the `ranges` prop is optional).

- [ ] **Step 7: Commit**

```bash
git add packages/addon/composables/use-slidev-context.ts packages/addon/components/DynamicCode.vue packages/addon/test/DynamicCode.test.ts
git commit -m "feat(addon): add ranges prop and soft useSlideContext helper"
```

---

## Task 7: `DynamicCode.vue` — click registration via `$clicksContext`

**Files:**
- Modify: `packages/addon/components/DynamicCode.vue`
- Modify: `packages/addon/test/DynamicCode.test.ts`

- [ ] **Step 1: Add failing tests for register / unregister calls**

Append to `packages/addon/test/DynamicCode.test.ts`:

```ts
describe('<DynamicCode> ranges prop (click registration)', () => {
  it('registers and unregisters click count when ranges + ctx are present', () => {
    const register = vi.fn()
    const unregister = vi.fn()
    const calculateSince = vi.fn().mockReturnValue({ start: 1, end: 3 })

    slidevMock.hook = () => ({
      $clicksContext: { current: 0, register, unregister, calculateSince },
    })

    const wrapper = mount(DynamicCode, {
      props: {
        id: 'install',
        lang: 'bash',
        originHash: 'h',
        codeLz,
        ranges: ['2-3', '5', 'all'],
      },
      global: { provide: provideStub({ mode: 'presenter' }) },
    })

    expect(calculateSince).toHaveBeenCalledWith('+1', 2)
    expect(register).toHaveBeenCalledTimes(1)
    const [regId, regInfo] = register.mock.calls[0]!
    expect(typeof regId).toBe('string')
    expect(regId).toMatch(/^dyn-/)
    expect(regInfo).toEqual({ start: 1, end: 3 })

    wrapper.unmount()
    expect(unregister).toHaveBeenCalledWith(regId)
  })

  it('does not register when ranges is absent', () => {
    const register = vi.fn()
    slidevMock.hook = () => ({
      $clicksContext: {
        current: 0,
        register,
        unregister: vi.fn(),
        calculateSince: () => ({ start: 1, end: 3 }),
      },
    })

    mount(DynamicCode, {
      props: { id: 'install', lang: 'bash', originHash: 'h', codeLz },
      global: { provide: provideStub({ mode: 'presenter' }) },
    })
    expect(register).not.toHaveBeenCalled()
  })

  it('does not register when context is missing (graceful degrade)', () => {
    // slidevMock.hook stays null from beforeEach
    const wrapper = mount(DynamicCode, {
      props: { id: 'install', lang: 'bash', originHash: 'h', codeLz, ranges: ['1', '2'] },
      global: { provide: provideStub({ mode: 'presenter' }) },
    })
    // Just assert no crash and textarea is editable (no reveal active).
    expect(wrapper.find('textarea').attributes('readonly')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -F slidev-addon-dynamic-code test test/DynamicCode.test.ts -t "click registration"`
Expected: FAIL — register / unregister not called yet.

- [ ] **Step 3: Add click registration code**

In `packages/addon/components/DynamicCode.vue`, after the `slideCtx` declaration from Task 6, add:

```ts
const clicksCtx: any = slideCtx?.$clicksContext ?? null

// Per-mount unique id for $clicksContext bookkeeping. Crypto-random is fine —
// no persistence across mounts, never reused within a session. Distinct from
// the deck-wide block `id` prop (which IS persistent and used by the sync
// layer).
const componentId = `dyn-${Math.random().toString(36).slice(2, 10)}`
let clicksInfo: { start: number, end: number } | null = null

onMounted(() => {
  if (!clicksCtx || !props.ranges?.length) return
  clicksInfo = clicksCtx.calculateSince('+1', props.ranges.length - 1)
  clicksCtx.register(componentId, clicksInfo)
})

onUnmounted(() => {
  if (clicksCtx && clicksInfo)
    clicksCtx.unregister(componentId)
})
```

Note: the existing `onMounted` / `onUnmounted` already wires the reset event listener. Append the new logic inside additional `onMounted` / `onUnmounted` calls (Vue supports multiple) — don't restructure the existing handlers.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F slidev-addon-dynamic-code test test/DynamicCode.test.ts -t "click registration"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/addon/components/DynamicCode.vue packages/addon/test/DynamicCode.test.ts
git commit -m "feat(addon): register click steps with Slidev \$clicksContext on mount"
```

---

## Task 8: `DynamicCode.vue` — `revealIndex`, `inReveal`, `currentRange` computeds

**Files:**
- Modify: `packages/addon/components/DynamicCode.vue`
- Modify: `packages/addon/test/DynamicCode.test.ts`

- [ ] **Step 1: Add failing tests for the reactive reveal state**

Append to `packages/addon/test/DynamicCode.test.ts`:

```ts
describe('<DynamicCode> ranges prop (reveal state)', () => {
  function mountWithClicks(cur: { value: number }, ranges: string[]) {
    slidevMock.hook = () => ({
      $clicksContext: {
        get current() { return cur.value },
        register: vi.fn(),
        unregister: vi.fn(),
        calculateSince: () => ({ start: 1, end: 1 + (ranges.length - 1) }),
      },
    })
    return mount(DynamicCode, {
      props: { id: 'install', lang: 'bash', originHash: 'h', codeLz, ranges },
      global: { provide: provideStub({ mode: 'presenter' }) },
    })
  }

  it('textarea is read-only at slide entry (revealIndex 0)', () => {
    const cur = ref(0)
    const wrapper = mountWithClicks(cur, ['2-3', '5', 'all'])
    // current=0 → revealIndex = max(0, 0 - 1 + 1) = 0; ranges.length-1 = 2; inReveal true
    expect(wrapper.find('textarea').attributes('readonly')).toBeDefined()
  })

  it('textarea unlocks once revealIndex reaches the final ranges item', async () => {
    const cur = ref(0)
    const wrapper = mountWithClicks(cur, ['2-3', '5', 'all'])
    cur.value = 2  // revealIndex = max(0, 2-1+1) = 2 = ranges.length-1 → inReveal false
    await wrapper.vm.$nextTick()
    expect(wrapper.find('textarea').attributes('readonly')).toBeUndefined()
  })

  it('unlocks immediately when ranges has a single item', () => {
    const cur = ref(0)
    const wrapper = mountWithClicks(cur, ['1'])
    // ranges.length=1 → end=1+0=1; revealIndex=0; ranges.length-1=0; inReveal = 0 < 0 → false
    expect(wrapper.find('textarea').attributes('readonly')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -F slidev-addon-dynamic-code test test/DynamicCode.test.ts -t "reveal state"`
Expected: FAIL — `readonly` currently flips only on `sync.mode !== 'presenter'`; reveal state not yet wired.

- [ ] **Step 3: Add the computeds and rewire `readonly`**

In `packages/addon/components/DynamicCode.vue`, after the click-registration `onUnmounted` from Task 7, add:

```ts
// 1-based index into `ranges` for the currently-displayed step. -1 means the
// reveal pipeline is inactive (no ranges, or context unavailable).
const revealIndex = computed(() => {
  if (!props.ranges?.length || !clicksCtx || !clicksInfo) return -1
  return Math.max(0, clicksCtx.current - clicksInfo.start + 1)
})

// True while the user is still walking through reveal steps before the final
// one. Unlocks editing once the final ranges item is displayed.
const inReveal = computed(() => {
  if (!props.ranges?.length || revealIndex.value < 0) return false
  return revealIndex.value < props.ranges.length - 1
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
```

Then replace the existing `const readonly = computed(...)` line with:

```ts
const readonly = computed(() => sync?.mode !== 'presenter' || inReveal.value)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F slidev-addon-dynamic-code test test/DynamicCode.test.ts -t "reveal state"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/addon/components/DynamicCode.vue packages/addon/test/DynamicCode.test.ts
git commit -m "feat(addon): compute revealIndex/inReveal/currentRange and gate readonly"
```

---

## Task 9: `DynamicCode.vue` — suppress sync writes during reveal

**Files:**
- Modify: `packages/addon/components/DynamicCode.vue`
- Modify: `packages/addon/test/DynamicCode.test.ts`

- [ ] **Step 1: Add failing test for suppression**

Append to `packages/addon/test/DynamicCode.test.ts`:

```ts
describe('<DynamicCode> ranges prop (sync gating)', () => {
  it('does NOT call broadcastEdit while inReveal is true', async () => {
    vi.useFakeTimers()
    try {
      const cur = ref(0)
      const broadcastEdit = vi.fn()
      slidevMock.hook = () => ({
        $clicksContext: {
          get current() { return cur.value },
          register: vi.fn(),
          unregister: vi.fn(),
          calculateSince: () => ({ start: 1, end: 3 }),
        },
      })

      const wrapper = mount(DynamicCode, {
        props: { id: 'install', lang: 'bash', originHash: 'h', codeLz, ranges: ['2-3', '5', 'all'] },
        global: {
          provide: {
            [syncKey as symbol]: {
              mode: 'presenter',
              state: ref({}),
              status: ref('connected'),
              broadcastEdit,
              broadcastReset: () => {},
              broadcastResetAll: () => {},
            },
          },
        },
      })

      // Drive a content change via setValue — even though the textarea is
      // [readonly] during reveal, setValue bypasses the DOM check and fires
      // the input event. We're testing the broadcast guard, not the DOM gate.
      await wrapper.find('textarea').setValue('forced change during reveal')
      vi.advanceTimersByTime(500)
      expect(broadcastEdit).not.toHaveBeenCalled()

      // Advance to final reveal item, then change content again
      cur.value = 2
      await wrapper.vm.$nextTick()
      await wrapper.find('textarea').setValue('edit after reveal')
      vi.advanceTimersByTime(500)
      expect(broadcastEdit).toHaveBeenCalledWith('install', 'h', 'edit after reveal')
    }
    finally {
      vi.useRealTimers()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F slidev-addon-dynamic-code test test/DynamicCode.test.ts -t "sync gating"`
Expected: FAIL — the existing watcher on `liveContent` calls `debouncedBroadcast` regardless of reveal state.

- [ ] **Step 3: Guard the broadcast watcher**

In `packages/addon/components/DynamicCode.vue`, replace the existing watcher:

```ts
watch(liveContent, (val) => {
  if (sync?.mode === 'presenter' && val !== incomingContent.value)
    debouncedBroadcast(val)
})
```

with:

```ts
watch(liveContent, (val) => {
  if (sync?.mode !== 'presenter') return
  if (inReveal.value) return                  // suppress edits during reveal phase
  if (val === incomingContent.value) return
  debouncedBroadcast(val)
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F slidev-addon-dynamic-code test test/DynamicCode.test.ts -t "sync gating"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/addon/components/DynamicCode.vue packages/addon/test/DynamicCode.test.ts
git commit -m "feat(addon): suppress broadcastEdit while reveal phase is active"
```

---

## Task 10: `DynamicCode.vue` — apply highlight classes per click step

**Files:**
- Modify: `packages/addon/components/DynamicCode.vue`
- Modify: `packages/addon/test/DynamicCode.test.ts`

- [ ] **Step 1: Add failing test for class application**

Append to `packages/addon/test/DynamicCode.test.ts`:

```ts
describe('<DynamicCode> ranges prop (highlight DOM)', () => {
  async function mountAndWaitForShiki(cur: { value: number }, ranges: string[], code: string) {
    slidevMock.hook = () => ({
      $clicksContext: {
        get current() { return cur.value },
        register: vi.fn(),
        unregister: vi.fn(),
        calculateSince: () => ({ start: 1, end: 1 + (ranges.length - 1) }),
      },
    })
    const wrapper = mount(DynamicCode, {
      props: { id: 'demo', lang: 'bash', originHash: 'h', codeLz: lz.compressToBase64(code), ranges },
      global: { provide: provideStub({ mode: 'presenter' }) },
    })
    // Shiki render is async + debounced 60ms. Drain microtasks + timers.
    await new Promise(r => setTimeout(r, 120))
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it('applies .highlighted to the lines for the current step and .has-highlighted to <pre>', async () => {
    const cur = ref(0)
    const wrapper = await mountAndWaitForShiki(cur, ['2-3', '5', 'all'], 'a\nb\nc\nd\ne')
    const lines = wrapper.findAll('.dynamic-code-render pre.shiki code > .line')
    // revealIndex = 0 → spec "2-3" → lines 2 and 3 highlighted (1-based)
    expect(lines[1]!.classes()).toContain('highlighted')
    expect(lines[2]!.classes()).toContain('highlighted')
    expect(lines[0]!.classes()).not.toContain('highlighted')
    expect(lines[3]!.classes()).not.toContain('highlighted')
    expect(wrapper.find('.dynamic-code-render pre.shiki').classes()).toContain('has-highlighted')

    // Advance to 'all' final state → no .highlighted, no .has-highlighted
    cur.value = 2
    await wrapper.vm.$nextTick()
    const linesFinal = wrapper.findAll('.dynamic-code-render pre.shiki code > .line')
    for (const ln of linesFinal)
      expect(ln.classes()).not.toContain('highlighted')
    expect(wrapper.find('.dynamic-code-render pre.shiki').classes()).not.toContain('has-highlighted')
  })

  it('applies the slidev-vclick-hidden class on hide step and uses the NEXT spec for highlight', async () => {
    const cur = ref(0)
    const wrapper = await mountAndWaitForShiki(cur, ['hide', '2-3', 'all'], 'a\nb\nc\nd')
    // revealIndex 0 = 'hide' → wrapper gets slidev-vclick-hidden; highlight uses '2-3'
    expect(wrapper.find('.dynamic-code-wrapper').classes()).toContain('slidev-vclick-hidden')
    const lines = wrapper.findAll('.dynamic-code-render pre.shiki code > .line')
    expect(lines[1]!.classes()).toContain('highlighted')
    expect(lines[2]!.classes()).toContain('highlighted')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -F slidev-addon-dynamic-code test test/DynamicCode.test.ts -t "highlight DOM"`
Expected: FAIL — no class toggling code yet.

- [ ] **Step 3: Add the watchEffect**

In `packages/addon/components/DynamicCode.vue`, just before the final `</script>` closing tag (after `renderedHtml`), add:

```ts
import { parseHighlightRange } from '../lib/parse-ranges'
// Note: if `import` lines are already top-of-file, move this one up there.

watchEffect(() => {
  if (!highlightedHtml.value) return
  const wrapEl = wrapperRef.value
  if (!wrapEl) return
  const pre = wrapEl.querySelector<HTMLElement>('.dynamic-code-render pre.shiki')
  if (!pre) return

  const { spec, hide } = currentRange.value
  // 'slidev-vclick-hidden' is Slidev's CSS class for v-click hide state
  // (declared in @slidev/client/styles/code.css). Hardcoded on purpose — class
  // names are user-facing API surface and more stable than module-internal
  // exports.
  wrapEl.classList.toggle('slidev-vclick-hidden', hide)

  const lines = Array.from(pre.querySelectorAll<HTMLElement>('code > .line'))
  const hl = parseHighlightRange(spec, lines.length)
  lines.forEach((el, i) => {
    el.classList.toggle('highlighted', hl.has(i + 1))
  })
  pre.classList.toggle('has-highlighted', hl.size > 0 && hl.size < lines.length)
})
```

Add `watchEffect` to the existing `import { ... } from 'vue'` line if not already present.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F slidev-addon-dynamic-code test test/DynamicCode.test.ts -t "highlight DOM"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/addon/components/DynamicCode.vue packages/addon/test/DynamicCode.test.ts
git commit -m "feat(addon): toggle .highlighted/.has-highlighted/.slidev-vclick-hidden per click"
```

---

## Task 11: package.json — add peer dep, bump to 0.2.0

**Files:**
- Modify: `packages/addon/package.json`

- [ ] **Step 1: Edit `package.json`**

In `packages/addon/package.json`:

1. Change `"version": "0.1.3"` to `"version": "0.2.0"`.
2. In the `peerDependencies` block, add `"@slidev/client": "^52.15.0"` so the block reads:

```json
  "peerDependencies": {
    "@slidev/client": "^52.15.0",
    "@slidev/types": "^52.15.0",
    "shiki": "^4.0.0",
    "vue": "^3.5.0"
  },
```

3. In `devDependencies`, add `"@slidev/client": "^52.15.2"` (latest known good per the issue's env block):

```json
    "@slidev/client": "^52.15.2",
    "@slidev/types": "^52.15.0",
```

- [ ] **Step 2: Refresh the lockfile**

Run: `pnpm install`
Expected: lockfile updated, no errors.

- [ ] **Step 3: Run the full suite**

Run: `pnpm -F slidev-addon-dynamic-code typecheck && pnpm -F slidev-addon-dynamic-code test && pnpm lint`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add packages/addon/package.json pnpm-lock.yaml
git commit -m "chore(addon): add @slidev/client peer dep, bump to 0.2.0"
```

---

## Task 12: README — document the new syntax

**Files:**
- Modify: `packages/addon/README.md`

- [ ] **Step 1: Read the existing structure**

Open `packages/addon/README.md`. Locate the existing section `## Mark a code block dynamic` (around line 44).

- [ ] **Step 2: Append a new sub-section AFTER the "Mark a code block dynamic" section and BEFORE "Deploy the relay (once)"**

Insert verbatim:

````markdown
### Click-stepped line reveal (since v0.2.0)

You can combine a `{dynamic}` block with Slidev's native [line-highlight grammar](https://sli.dev/features/line-highlighting) to walk the audience through a snippet click-by-click, then let them watch you edit it live:

````md
```bash {dynamic id=install-walkthrough} {2-3|5|all}
mkdir my-app
cd my-app
npm init -y
npm install express
npm start
```
````

State machine:

| Phase | Trigger | Highlight | Textarea |
| --- | --- | --- | --- |
| Reveal | each click advances to next step | the highlighted lines for that step | read-only, edits do not sync |
| Final | reached at the last step in `{...|...|...}` | the last range item (`all` in the example) | editable for presenter; edits broadcast to audience |

Unlocking is automatic at the LAST reveal step — no extra click needed beyond what the grammar implies.

**Caveat — editing then navigating back.** If you edit the block, then click backward into the reveal phase, the original line-highlight ranges are reapplied to the *edited* content. If your edit inserted or removed lines, the dimmed-vs-highlighted lines may visually mis-align — they reference the original line numbers. This is a deliberate simplification; switch slides and return to reset.

**Graceful degrade.** Old Slidev versions, the `/dynamic-code-admin` route, or anything else that does not expose `useSlideContext().$clicksContext` falls back to "no reveal, immediate edit". The block always renders.

**Not yet supported on dynamic blocks** (warned and ignored at build time — fall back to a non-dynamic block if you need these):

- `{at:N}` — pin reveal start to a specific slide click index
- `{lines:true}` / `{startLine:N}` — line numbering
- `{maxHeight:'…'}` — scrollable area
- Magic Move (` ```md magic-move`)
````

- [ ] **Step 3: Commit**

```bash
git add packages/addon/README.md
git commit -m "docs(addon): document click-reveal syntax, state machine, caveats"
```

---

## Task 13: Final validation + smoke test

**Files:**
- None modified (verification only)

- [ ] **Step 1: Full suite + typecheck + lint**

Run from repo root:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

Expected: all green across both packages.

- [ ] **Step 2: Smoke-pack and install into a test deck**

```bash
cd packages/addon
pnpm pack --pack-destination /tmp/dyn-pack
ls /tmp/dyn-pack/slidev-addon-dynamic-code-0.2.0.tgz
```

Expected: tgz exists.

Optional (manual): install into a real Slidev deck via `pnpm add -D file:/tmp/dyn-pack/slidev-addon-dynamic-code-0.2.0.tgz` and run through the 8-step smoke checklist below.

**Manual smoke checklist (not in CI):**

1. Slide with `\`\`\`bash {dynamic id=demo} {2-3|5|all}` and 5 lines of bash.
2. Slide entry (no clicks yet) → lines 2-3 highlighted, textarea read-only.
3. Click 1 → line 5 highlighted, still read-only.
4. Click 2 → no dimming (`'all'` step), textarea accepts input — unlock with no extra click.
5. Type → audience tab (separate browser, no `?presenter=` query) reflects edit live.
6. Click back → textarea re-locks, highlight returns to previous step.
7. Reset via `Ctrl+Shift+R` → content restored to fenced original, click position unchanged.
8. Add a slide with `\`\`\`bash {dynamic id=plain}` (no second brace group) → textarea editable from slide entry, no highlight, no reveal.

- [ ] **Step 3: Verify git log**

Run: `git log --oneline -15`
Expected: 12 feature/docs commits since the branch base (one per Task 1 through Task 12), all conventional-commit-style, none using `--no-verify`.

- [ ] **Step 4: Open PR (only if user requests)**

Do NOT push or open a PR unless the user explicitly asks. When they do:

```bash
git push -u origin HEAD
gh pr create --title "feat(addon): click-stepped line reveal on {dynamic} blocks (closes #1)" --body "$(cat <<'EOF'
## Summary

Adds support for `\`\`\`bash {dynamic id=foo} {2-3|5|all}\`\`\` — combines dynamic editing with Slidev's native line-highlight grammar. Block walks through reveal steps click-by-click (read-only), then unlocks for live editing at the final step.

Closes #1.

## Test plan

- [x] Unit tests for parser (parse-ranges, parse-directive)
- [x] Unit tests for emit
- [x] Unit tests for DynamicCode reveal state, sync gating, highlight DOM, hide fallthrough, graceful degrade
- [x] pnpm typecheck clean
- [x] pnpm lint clean
- [ ] Manual smoke in a real deck (see PR description checklist)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

Spec coverage verified:
- Behavior contract — Tasks 6, 8, 9, 10.
- Grammar & parser — Tasks 1, 2.
- Component changes — Tasks 6, 7, 8, 9, 10.
- File diff summary — Tasks 1–12 collectively touch exactly the files the spec lists, no more.
- Tests — Tasks 1, 2, 3, 4 update unit tests as specified; Tasks 6–10 cover the DynamicCode test additions.
- Risks — graceful degrade tested in Task 6; hide fallthrough tested in Task 10; per-mount componentId implementation matches spec.
- Versioning — Task 11 single bump 0.2.0, single PR (Task 13 Step 4).

No placeholders. All file paths exact. All steps have runnable commands and expected output.
