# slidev-addon-dynamic-code

Live-editable code blocks for Slidev presentations.

## Why

When presenting a technical talk with shell commands, scripts, or code snippets, you often need to tweak a single flag, fix a missing dep, or correct a path on the fly. Today that means rebuilding the deck or switching to a separate terminal. This addon lets you edit specific code blocks at runtime and broadcasts the change to every audience browser viewing the same deck — no rebuild, no reload.

## Architecture in 60 seconds

- You mark code blocks with `{dynamic id=NAME}` in markdown.
- A pnpm-installed Slidev addon swaps those blocks for an editable component.
- A small Cloudflare Worker (the **relay**) you deploy once brokers edits between presenter and audience.
- Presenter URL: `https://your-slides.example.com/?presenter=SECRET`. Audience URL: same site without the query.

## Install the addon

```bash
pnpm add -D slidev-addon-dynamic-code
```

Add the addon and its config to `slides.md` frontmatter:

```yaml
---
addons: [slidev-addon-dynamic-code]
dynamicCode:
  relayUrl: https://relay.yourname.workers.dev # from `wrangler deploy`
  talkId: my-talk-2026 # any stable string per deck
---
```

## Mark a code block dynamic

````md
```bash {dynamic id=install-deps}
npm install some-package
```
````

Rules:
- `id=` is required. Use stable, descriptive names (`install-deps`, `run-tests`).
- Ids must be unique across the entire deck.
- Allowed id characters: letters, digits, `_`, `-`.

## Deploy the relay (one-time)

The relay lives in [`packages/relay`](../relay) of this monorepo. You can deploy it directly from a clone:

```bash
git clone https://github.com/opariffazman/slidev-addon-dynamic-code.git
cd slidev-addon-dynamic-code/packages/relay
pnpm install
pnpm wrangler login                           # one-time
pnpm wrangler secret put PRESENTER_TOKEN      # type your secret when prompted
pnpm wrangler deploy
```

`wrangler deploy` prints a URL like `https://slidev-dynamic-code-relay.your-subdomain.workers.dev`. Put that in `dynamicCode.relayUrl`.

Treat the presenter token like a password — rotate it after every public talk:

```bash
pnpm wrangler secret put PRESENTER_TOKEN
```

## Pre-talk runbook

A 5-minute check before going live.

1. **Deploy slides** as usual (e.g. `slidev build && wrangler pages deploy dist`).
2. **Visit the audience URL** on a second device or an incognito window. Confirm the dynamic blocks render and the connection badge is hidden.
3. **Visit the presenter URL** with `?presenter=YOUR_TOKEN`. Confirm the badge shows `●` (green).
4. **Type into a dynamic block.** The audience window should reflect the change within ~1 second.
5. **Right-click a dynamic block → "Reset dynamic block".** The audience falls back to the original fenced content.
6. **Visit `/dynamic-code-admin?presenter=YOUR_TOKEN`.** Confirm "Reset all" works and the list is empty after.

If any step fails, see Troubleshooting below.

## Keyboard and UI

- **`Ctrl+Shift+R`** (or `Cmd+Shift+R` on macOS) while focused inside a dynamic block — resets that block to fenced content.
- **Right-click** on a dynamic block in presenter mode — "Reset dynamic block" appears in the context menu.
- **`/dynamic-code-admin`** with `?presenter=TOKEN` — table of all known blocks with per-row and "Reset all" actions.
- **Copy button** (top right on hover) — copies the currently displayed content, available to both presenter and audience.
- **Connection badge** (top right, presenter only):
  - `●` connected
  - `◐` reconnecting
  - `○` offline (initial failure)
  - `⚠` token rejected

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Build error `missing required id=` | Forgot `id=` in a `{dynamic}` block | Add a stable id |
| Build error `duplicate id "X"` | Same id on two slides | Rename one |
| Build error `dynamicCode.relayUrl is required` | Missing or malformed config in frontmatter | Add the `dynamicCode:` block |
| Badge shows `⚠` | Wrong presenter token | Re-check `wrangler secret put PRESENTER_TOKEN`; copy URL again |
| Badge shows `○` and never connects | Relay URL typo or worker not deployed | Verify with `curl https://relay.../sub?talk=test` — should respond with a websocket upgrade error, not 404 |
| Edits not propagating | Audience may be on stale browser cache | Hard-reload audience page |
| Edits propagate but disappear on refresh | Audience cleared localStorage / hash mismatch | Verify presenter token isn't being rotated mid-talk |

## Reset and persistence

- Persistence is forever (in Durable Object SQLite). Edits survive Worker restarts and DO hibernation.
- Reset paths: per-block (context menu, `Ctrl+Shift+R`) or whole-talk (admin route "Reset all").
- The addon hashes the original fenced content at build time and includes it in the broadcast. If you redeploy with different fenced content, audience browsers ignore stale DO content for that block automatically.

## Limitations

- One presenter at a time. The relay treats every `/pub` socket as authoritative; no conflict resolution.
- Display only. The slide does not execute code. Run commands in your real terminal alongside the projector.
- Single talk per relay instance is fine on the free tier; a few hundred audience devices is comfortable.

## License

MIT © opariffazman
