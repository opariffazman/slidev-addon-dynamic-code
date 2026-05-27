# Architecture

> Caveman style: fragments OK, no fluff. Code/paths normal.

Build-time codeblock transformer emits `<DynamicCode>` Vue component (lz-encoded fenced + origin-hash); runtime component overlays invisible textarea on shiki `<pre>`, syncs via WS to Durable Object keyed by `talkId`; audience subscribes, presenter publishes, DO broadcasts + persists.

## System diagram

```
                    ┌──────────────────────────────────────────┐
                    │  Cloudflare Worker                       │
                    │   slidev-dynamic-code-relay              │
                    │    ─ /pub?talk=X&token=…  (presenter WS) │
                    │    ─ /sub?talk=X          (audience WS)  │
                    │  TalkDO (Durable Object, one per talkId) │
                    │    ─ SQLite: blocks(id, hash, content)   │
                    │    ─ WS hibernation API                  │
                    └─────────────▲────────────────▲───────────┘
                                  │                │
            broadcasts            │                │  snapshot on connect
            updates               │                │  + live updates
                                  │                │
                  ┌───────────────┴──────┐   ┌─────┴──────────────────────┐
                  │ Presenter browser    │   │ Audience browser(s)        │
                  │  ?presenter=TOKEN    │   │  (no query)                │
                  │  <DynamicCode>       │   │  <DynamicCode>             │
                  │   editable textarea  │   │   readonly                 │
                  └──────────────────────┘   └────────────────────────────┘
```

## Build-time pipeline

1. `setup/transformers.ts` defines `codeblocks` transformer (Slidev `CodeblockTransformer` API, requires >= 52.15.0).
2. Transformer matches `{dynamic id=…}` in fenced block info string via `lib/parse-directive.ts`.
3. `lib/registry.ts` enforces unique ids across deck. Build throws on missing id or duplicate.
4. `lib/hash.ts` computes origin hash: `sha256(trim(fenced)).slice(0, 12)` — 12-char hex.
5. `lib/emit.ts` emits `<DynamicCode id="…" lang="…" origin-hash="…" code-lz="…" />`. Content lz-string compressed (base64). Optional `:ranges` prop for click-reveal steps.

## Runtime flow

1. `setup/main.ts` (`defineAppSetup`): registers `DynamicCode` component globally, reads `dynamicCode` config from frontmatter (`lib/read-config.ts`), detects presenter mode from `?presenter=` URL param, creates `SyncClient` instance, provides sync context via Vue inject/provide (`components/sync-key.ts`).
2. One `SyncClient` per page. Connects to relay WS. Multiplexes all blocks on that page.
3. On connect: relay sends `snapshot` with all persisted blocks. Client merges into local state.

## Component internals (`DynamicCode.vue`)

- Renders shiki-highlighted `<pre>` via `codeToHtml()` (dual theme: vitesse-light/dark).
- Transparent `<textarea>` overlaid on `<pre>` — same font metrics (enforced via CSS `!important`).
- Presenter: textarea editable. Edits debounced 200 ms → `SyncClient.broadcastEdit(id, hash, content)`.
- Audience: textarea readonly. Updates from WS applied if origin hash matches compiled hash (stale-state safety).
- Connection badge (presenter-only): `●` connected, `◐` reconnecting, `○` offline, `⚠` rejected.
- Copy button: copies currently displayed content to clipboard.

## WS protocol

JSON over WebSocket. Types defined in `lib/protocol.ts`.

**Client → Server (`ClientMessage`):**

| `t` | Fields | Who sends |
|-----|--------|-----------|
| `edit` | `id`, `hash`, `content` | presenter |
| `reset` | `id` | presenter |
| `reset_all` | — | presenter |

**Server → Client (`ServerMessage`):**

| `t` | Fields | When |
|-----|--------|------|
| `snapshot` | `blocks: Record<string, {hash, content}>` | on WS connect |
| `update` | `id`, `hash` (nullable), `content` (nullable) | after edit or reset |
| `error` | `code`, `message` | content_too_large, too_many_blocks |

## Origin hash mechanism

- Hash = first 12 hex chars of SHA-256 of trimmed fenced content. Embedded at build time as `origin-hash` prop.
- Presenter sends hash with every edit. DO stores it alongside content.
- Audience client compares incoming `update.hash` against compiled `origin-hash`. Mismatch → ignore update (stale build).
- DO: if incoming edit hash differs from stored hash, overwrites (deck was redeployed with new content).

## Persistence (Durable Object)

- `TalkDO` extends `DurableObject`. One instance per `talkId` (keyed via `idFromName`).
- SQLite table: `blocks(id TEXT PK, hash TEXT, content TEXT, updated_at INTEGER)`.
- Limits: 32 KiB per block content, 200 blocks per talk.
- WS hibernation API — DO sleeps between messages, no billing while idle.
- Reset: delete row(s) from SQLite, broadcast `update` with null hash/content (per-block) or `reset_all_done` (all).

## Click-reveal state machine

Combines `{dynamic}` with Slidev line-highlight grammar `{2-3|5|all}`.

| Phase | Highlight | Textarea | Sync |
|-------|-----------|----------|------|
| Reveal (steps 0..n-1) | ranges for current step | read-only | no |
| Final (step n) | last range | editable (presenter) | yes |

- Uses `useSlideContext().$clicksContext` to track current step.
- Graceful degrade: no `$clicksContext` → immediate edit mode.
- Navigating backward after editing reapplies original ranges to edited content — may mis-align if line count changed.

## Security model

- `/pub` route requires `?token=` matching Worker secret `PRESENTER_TOKEN`. 401 on mismatch.
- `/sub` route open — audience is read-only (DO tags WS as `audience`, ignores non-presenter messages).
- No CORS needed — WebSocket upgrade bypasses preflight.
- Token travels in URL query param (not header) — acceptable for WS; logged in Worker but not cached by browsers.
