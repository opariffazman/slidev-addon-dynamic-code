# slidev-addon-dynamic-code

Live-editable code blocks for [Slidev](https://sli.dev) presentations. Edit a snippet on the slide during a talk, and every audience browser viewing the same deck updates within a second — no rebuild, no reload.

Static-build friendly: works on Cloudflare Pages, Netlify, GitHub Pages, or any plain HTML host. The sync layer is a 50-line Cloudflare Worker you deploy once.

## Why this exists

Live technical talks — CLI demos, build scripts, code walkthroughs — constantly run into "this command needs one small change". Today the choices are: rebuild and reload, switch to a separate terminal as the source of truth, or ask the audience to mentally edit the snippet. None preserve flow.

This addon adds a `{dynamic id=NAME}` directive that turns marked blocks into an editable textarea overlaid on the slidev-rendered code. Presenter edits broadcast over WebSocket to all viewers of the same deck.

## Requirements

- Slidev `>= 52.15.0` (uses the `codeblocks` transformer API added in `52.15.x`).
- pnpm / npm / yarn — any.
- A Cloudflare account (free tier is enough). Account ID + an API token with Workers + Durable Objects permissions.

## Install

```bash
pnpm add -D slidev-addon-dynamic-code
```

Add the addon and its config to the slidev frontmatter of your deck's `slides.md`:

```yaml
---
addons:
  - slidev-addon-dynamic-code
dynamicCode:
  relayUrl: https://slidev-dynamic-code-relay.YOUR-SUBDOMAIN.workers.dev
  talkId: my-talk-2026-05
---
```

Where:

| Key         | Required | Value                                                                                                                                     |
|-------------|----------|-------------------------------------------------------------------------------------------------------------------------------------------|
| `relayUrl`  | yes      | URL printed by `wrangler deploy` (see [Deploy the relay](#deploy-the-relay-once)). `http://` and `https://` are converted to `ws://` / `wss://` at runtime. |
| `talkId`    | yes      | Any stable string per deck. Persisted edits live in a Durable Object keyed by this id — change it for a fresh slate.                       |

## Mark a code block dynamic

In any slide / page markdown:

````md
```bash {dynamic id=lab15-deploy}
npx wrangler deploy
curl https://api.YOUR_SUBDOMAIN.workers.dev/health
```
````

Rules:

- `id=` is **required**. Use stable, descriptive names like `lab15-deploy`, `install-deps`, `run-tests`.
- Ids must be unique **across the whole deck** (the addon throws a build error otherwise).
- Allowed id characters: `[a-zA-Z0-9_-]`.

The block renders normally for everyone until the presenter starts editing.

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

## Deploy the relay (once)

The Worker + Durable Object that brokers edits between presenter and audience.

### From an npm clone (recommended for now)

```bash
git clone https://github.com/opariffazman/slidev-addon-dynamic-code.git
cd slidev-addon-dynamic-code/packages/relay
pnpm install
```

If you have an interactive browser available:

```bash
pnpm wrangler login
```

If you're on a headless server (no localhost callback), use a Cloudflare API token instead:

```bash
export CLOUDFLARE_API_TOKEN="…"      # from https://dash.cloudflare.com/profile/api-tokens (template: Edit Cloudflare Workers)
export CLOUDFLARE_ACCOUNT_ID="…"     # right sidebar of any zone on https://dash.cloudflare.com
```

Then:

```bash
pnpm wrangler deploy
```

Copy the printed URL (something like `https://slidev-dynamic-code-relay.YOUR-SUBDOMAIN.workers.dev`) into the `dynamicCode.relayUrl` field of your deck.

### Set the presenter token

```bash
openssl rand -hex 16 | pnpm wrangler secret put PRESENTER_TOKEN
```

(Or paste a strong random string interactively at the prompt.)

You'll use this token as `?presenter=…` in URLs (see below). **Save it.** It's a write-only secret; you can't view it later, only rotate.

### Verify

```bash
curl -i "https://slidev-dynamic-code-relay.YOUR-SUBDOMAIN.workers.dev/sub?talk=ping"
# Expect HTTP/2 426 (expected websocket upgrade) — proves the Worker + DO routing are live.
```

## Use it during a talk

- **Presenter (you):** open `https://your-deck.example.com/?presenter=YOUR_TOKEN`
- **Audience:** open `https://your-deck.example.com/` on their own devices

Then:

- Click into any `{dynamic}` block → caret appears + blue focus ring → type freely. The audience sees your edits in ~1 second (debounced 200 ms).
- A **`●` green badge** top-right of each dynamic block confirms the WebSocket is live (presenter-only — audience never sees it).
- **Copy button** (clipboard icon top-right on hover) — copies the **currently displayed** content. Available to both presenter and audience.
- **Reset** is available only via the [admin route](#admin-route) — per-block or reset-all.

## Admin route

`https://your-deck.example.com/dynamic-code-admin?presenter=YOUR_TOKEN`

Shows every block id currently in the Durable Object for this `talkId`, with per-row **Reset** buttons and a **Reset all** button. Useful before a fresh run-through.

## Connection badge

The presenter-only badge top-right of each dynamic block:

| Glyph | Status        | Meaning                                                                                |
|-------|---------------|----------------------------------------------------------------------------------------|
| `●`   | connected     | Green. WebSocket open, edits flowing.                                                  |
| `◐`   | reconnecting  | Amber. Lost the WS mid-talk; retrying with exponential backoff (1s → 30s cap).         |
| `○`   | offline       | Amber. Couldn't connect on first try; will keep retrying.                              |
| `⚠`   | rejected      | Red. The relay returned 401 — your `?presenter=…` token doesn't match the Worker secret. |

## Theme integration

The addon reuses Slidev's own `slidev-code-wrapper` + `slidev-code` classes for the container, so background, padding, border-radius, font, and margin all follow your active Slidev theme without further configuration.

Syntax highlighting uses Shiki dual themes (`vitesse-light` / `vitesse-dark`) and respects Slidev's existing `html.dark .shiki` toggle, so the block flips when you press `D` (dark mode toggle).

The caret colour uses Slidev's `--shiki-light` / `--shiki-dark` vars so it stays readable in both themes.

## Persistence semantics

- Edits are persisted forever in the Durable Object's SQLite, keyed by `(talkId, blockId)`.
- They survive Worker code redeploys, DO hibernation, and audience refreshes.
- Reset paths: per-block (admin route → Reset) or whole-talk (admin route → Reset all).
- If you redeploy the deck with a different fenced source for an existing block id, the **origin hash** baked at build time changes. The DO entry is automatically invalidated on the next presenter edit, so audience browsers see the new fenced content instead of stale persisted edits.
- To wipe state for the next cohort without using the admin UI, change `dynamicCode.talkId` to a new value and redeploy. (The old DO storage stays orphaned but does not bill while hibernated.)

## Multiple decks / multiple projects

One relay deploy can serve any number of decks. Each deck just sets a unique `dynamicCode.talkId` in its frontmatter and points at the same `relayUrl`. The Durable Object instance is keyed by `talkId`, so deck A's edits are invisible to deck B's audience.

Single `PRESENTER_TOKEN` works across all talks on the relay. If you need per-talk tokens (e.g. delegating presenter rights to someone for one deck only), extend the Worker — see `packages/relay/src/index.ts`.

## Pre-talk runbook

A 5-minute check before going live.

1. **Deploy the deck** as usual (`slidev build` then your static host's deploy command).
2. **Visit the audience URL** on a second device / incognito window. Confirm dynamic blocks render exactly like regular code blocks.
3. **Visit the presenter URL** with `?presenter=YOUR_TOKEN`. Confirm the `●` badge appears top-right of each dynamic block.
4. **Type into a dynamic block.** The audience window reflects the change within ~1 second.
5. **Visit `/dynamic-code-admin?presenter=YOUR_TOKEN`.** Confirm "Reset all" works and the table is empty after.

If anything fails, see [Troubleshooting](#troubleshooting).

## Troubleshooting

| Symptom                                                          | Likely cause                                                                                            | Fix                                                                                                       |
|------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| Build error `missing required id=NAME on slide N`                | Forgot `id=` in a `{dynamic}` block                                                                     | Add `id=stable-name`                                                                                       |
| Build error `duplicate id "X" on slides N and M`                 | Same id on two slides                                                                                   | Rename one. Ids must be unique across the entire deck.                                                    |
| Build error `dynamicCode.relayUrl is required`                   | Missing or malformed config block in slides frontmatter                                                 | Add the `dynamicCode: { relayUrl, talkId }` block                                                          |
| Block renders but no `●` badge in presenter mode                 | `?presenter=…` token not in URL, or transformer didn't fire                                             | Check the URL query; verify the block is rendered as `<DynamicCode>` in DevTools                          |
| Badge shows `⚠` (red)                                            | Wrong presenter token                                                                                   | Re-check `wrangler secret put PRESENTER_TOKEN`; copy fresh URL                                            |
| Badge shows `○` and never advances                               | Relay URL typo, Worker not deployed, or CORS issue                                                      | `curl -i https://YOUR-RELAY.workers.dev/sub?talk=test` should return HTTP 426                              |
| Edits not propagating, badge is `●`                              | Audience window on stale cache, or different `talkId`                                                   | Hard-reload audience; verify both windows show identical block content on first load                      |
| Edit appears on audience then disappears on refresh              | Origin hash mismatch — fenced source changed between presenter and audience builds                      | Confirm both presenter and audience are on the same deployment of the deck                                |
| Block looks like plain text (no background/padding)              | Using slidev `< 52.15.0` — codeblocks transformer not supported                                         | Bump `@slidev/cli` to `^52.15.2`                                                                            |
| Build error from slidev: `Import "/path" resolves outside fs.allow` | Unrelated — slidev 52.15's `slide-import-guard` flags absolute-path `<img src>` in markdown            | Switch to a runtime binding: `<img :src="`\${$slidev.configs.base ?? '/'}path\``" />`                       |

## Architecture

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

- **Build time:** the addon's codeblock transformer matches `{dynamic id=…}` in the markdown info string, hashes the fenced source (first 12 hex of SHA-256), and emits a `<DynamicCode>` Vue component with the id, lang, origin-hash, and lz-string-compressed content as props.
- **Runtime:** `setup/main.ts` registers the component globally, reads the `dynamicCode` block from slides frontmatter, detects mode from `?presenter=` URL param, opens one WebSocket per page (multiplexes all blocks), and provides a sync context via Vue's inject/provide.
- **Component:** renders a shiki-highlighted `<pre>` (theme-aware) with a transparent textarea overlaid; broadcasts presenter edits debounced at 200 ms; falls back to fenced content if the WS message's hash doesn't match the compiled origin-hash (stale-state safety).

## Limitations

- One presenter at a time. The Worker treats every `/pub` socket as authoritative; no conflict resolution.
- Display only. The slide does not execute code. Run commands in your real terminal alongside the projector.
- 32 KiB per block content (server enforced).
- 200 distinct block ids per `talkId` (server enforced).
- One Worker free-tier deploy comfortably handles a few hundred audience devices per talk.

## License

MIT © opariffazman
