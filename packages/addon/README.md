# slidev-addon-dynamic-code

Live-editable code blocks for [Slidev](https://sli.dev) presentations. Edit a snippet on the slide during a talk, and every audience browser updates within a second — no rebuild, no reload.

Static-build friendly: works on Cloudflare Pages, Netlify, GitHub Pages, or any plain HTML host.

## Requirements

- Slidev `>= 52.15.0` (uses the `codeblocks` transformer API)
- A Cloudflare account (free tier is enough) — see the [relay deploy guide](../relay/README.md)

## Install

```bash
pnpm add -D slidev-addon-dynamic-code
```

Add the addon and config to your deck's `slides.md` frontmatter:

```yaml
---
addons:
  - slidev-addon-dynamic-code
dynamicCode:
  relayUrl: https://slidev-dynamic-code-relay.YOUR-SUBDOMAIN.workers.dev
  talkId: my-talk-2026-05
---
```

| Key | Required | Value |
|-----|----------|-------|
| `relayUrl` | yes | URL printed by `wrangler deploy` ([relay deploy guide](../relay/README.md)). `http://` / `https://` are converted to `ws://` / `wss://` at runtime. |
| `talkId` | yes | Any stable string per deck. Edits persist in a Durable Object keyed by this id — change it for a fresh slate. |

## Mark a code block dynamic

````md
```bash {dynamic id=lab15-deploy}
npx wrangler deploy
curl https://api.example.com/health
```
````

Rules:

- `id=` is **required**. Use stable, descriptive names like `lab15-deploy`, `install-deps`, `run-tests`.
- Ids must be unique **across the whole deck** (build error otherwise).
- Allowed characters: `[a-zA-Z0-9_-]`.

The block renders normally for everyone until the presenter starts editing.

### Click-stepped line reveal (since v0.2.0)

Combine `{dynamic}` with Slidev's [line-highlight grammar](https://sli.dev/features/line-highlighting) to walk through a snippet click-by-click, then edit live:

````md
```bash {dynamic id=install-walkthrough} {2-3|5|all}
mkdir my-app
cd my-app
npm init -y
npm install express
npm start
```
````

| Phase | Trigger | Highlight | Textarea |
|-------|---------|-----------|----------|
| Reveal | each click advances to next step | highlighted lines for that step | read-only, edits do not sync |
| Final | last step in `{...\|...\|...}` | last range item (`all` above) | editable for presenter; edits broadcast |

Unlocking is automatic at the last reveal step.

**Caveat — editing then navigating back.** If you edit the block then click backward into the reveal phase, line-highlight ranges are reapplied to the edited content. If your edit changed line count, highlighted lines may mis-align. Switch slides and return to reset.

**Graceful degrade.** Environments without `useSlideContext().$clicksContext` (old Slidev, admin route) fall back to immediate edit mode.

**Not yet supported on dynamic blocks** (warned at build time):

- `{at:N}` — pinned reveal start
- `{lines:true}` / `{startLine:N}` — line numbering
- `{maxHeight:'…'}` — scrollable area
- Magic Move

## Using during a talk

- **Presenter:** `https://your-deck.example.com/?presenter=YOUR_TOKEN`
- **Audience:** `https://your-deck.example.com/`

Click into any `{dynamic}` block — caret appears, blue focus ring — type freely. Audience sees edits in ~1 second (200 ms debounce).

## Connection badge

Presenter-only indicator, top-right of each dynamic block:

| Glyph | Status | Meaning |
|-------|--------|---------|
| `●` | connected | Green. WebSocket open, edits flowing. |
| `◐` | reconnecting | Amber. Lost WS mid-talk; retrying (1 s → 30 s backoff). |
| `○` | offline | Amber. Couldn't connect on first try; retrying. |
| `⚠` | rejected | Red. 401 — presenter token doesn't match. |

## Copy button

Clipboard icon (top-right on hover) copies the currently displayed content. Available to both presenter and audience.

## Admin route

`https://your-deck.example.com/dynamic-code-admin?presenter=YOUR_TOKEN`

Shows every block id in the Durable Object for this `talkId`, with per-row **Reset** buttons and a **Reset all** button. Useful before a fresh run-through.

## Theme integration

The addon reuses Slidev's `slidev-code-wrapper` + `slidev-code` classes, so background, padding, border-radius, font, and margin follow your active theme. Syntax highlighting uses Shiki dual themes and respects Slidev's dark mode toggle. Caret colour tracks `--shiki-light` / `--shiki-dark`.

## Persistence

- Edits persist in the Durable Object's SQLite, keyed by `(talkId, blockId)`.
- Survives Worker redeploys, DO hibernation, audience refreshes.
- Reset via admin route (per-block or reset-all).
- Changed fenced source → origin hash changes → DO entry auto-invalidated on next presenter edit.
- To wipe state: change `talkId` and redeploy. Old DO storage stays orphaned but doesn't bill while hibernated.

## Multiple decks

One relay serves any number of decks. Each deck sets a unique `talkId` and points at the same `relayUrl`. The Durable Object instance is keyed by `talkId`.

Single `PRESENTER_TOKEN` works across all talks. For per-talk tokens, extend the Worker — see `packages/relay/src/index.ts`.

## Pre-talk runbook

Five minutes before going live:

1. **Deploy the deck** (`slidev build` + your static host's deploy).
2. **Visit the audience URL** on a second device / incognito. Confirm dynamic blocks render like normal code blocks.
3. **Visit the presenter URL** with `?presenter=YOUR_TOKEN`. Confirm the `●` badge appears.
4. **Type into a dynamic block.** Audience window reflects the change within ~1 second.
5. **Visit `/dynamic-code-admin?presenter=YOUR_TOKEN`.** Confirm "Reset all" works.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Build error `missing required id=NAME on slide N` | Forgot `id=` | Add `id=stable-name` |
| Build error `duplicate id "X" on slides N and M` | Same id on two slides | Rename one |
| Build error `dynamicCode.relayUrl is required` | Missing frontmatter config | Add `dynamicCode: { relayUrl, talkId }` |
| No `●` badge in presenter mode | `?presenter=…` not in URL, or transformer didn't fire | Check URL query; inspect for `<DynamicCode>` in DevTools |
| Badge shows `⚠` (red) | Wrong presenter token | Re-check `wrangler secret put PRESENTER_TOKEN` |
| Badge shows `○` and never advances | Relay URL typo, Worker not deployed | `curl -i https://YOUR-RELAY.workers.dev/sub?talk=test` should return 426 |
| Edits not propagating, badge is `●` | Audience on stale cache or different `talkId` | Hard-reload audience |
| Edit appears then disappears on refresh | Origin hash mismatch — fenced source changed between builds | Confirm same deployment |
| Block looks like plain text | Slidev < 52.15.0 | Bump `@slidev/cli` to `^52.15.2` |

## Limitations

- One presenter at a time — no conflict resolution.
- Display only — the slide does not execute code.
- 32 KiB per block content (server enforced).
- 200 block ids per `talkId` (server enforced).
- Free-tier Worker handles a few hundred audience devices per talk.

## License

MIT © opariffazman
