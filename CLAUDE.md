# CLAUDE.md

Project memory for [slidev-addon-dynamic-code](https://github.com/opariffazman/slidev-addon-dynamic-code).

> Written caveman-style: fragments OK, no fluff. Code/commands/paths normal.

## What

Slidev addon. Live-edit code blocks during talk. Edits broadcast to audience browsers via CF Worker + Durable Object relay. Static-build friendly (CF Pages etc.).

Block syntax in markdown:

````md
```bash {dynamic id=NAME}
npx wrangler deploy
```
````

## Repo shape

pnpm monorepo. Two packages:

- `packages/addon/` — npm pkg `slidev-addon-dynamic-code` (Vue 3 + Shiki + WS client)
- `packages/relay/` — CF Worker (private, deploy-only) `slidev-dynamic-code-relay`

Spec + plan live in `~/work/docs/superpowers/{specs,plans}/2026-05-{22,23}-slidev-addon-dynamic-code-*.md` (not in this repo).

## Key files

```
packages/addon/
├── components/DynamicCode.vue       # textarea overlay on shiki <pre> — the main UX
├── components/AdminPage.vue         # /dynamic-code-admin route
├── components/sync-key.ts           # InjectionKey for sync ctx
├── composables/sync-client.ts       # WS client w/ exp backoff + queue
├── composables/useSync.ts           # Vue composable wrapping SyncClient
├── lib/hash.ts                      # sha256→12hex
├── lib/parse-directive.ts           # regex on info string
├── lib/emit.ts                      # <DynamicCode> HTML emission
├── lib/protocol.ts                  # WS wire types
├── lib/read-config.ts               # frontmatter resolver
├── lib/registry.ts                  # build-time dup-id check
├── setup/transformers.ts            # defineTransformersSetup → codeblocks: [...]
├── setup/main.ts                    # defineAppSetup → registers DynamicCode + provides sync
├── setup/routes.ts                  # /dynamic-code-admin
├── setup/shortcuts.ts               # pass-through (no custom shortcuts)
└── setup/context-menu.ts            # pass-through (no custom menu items)

packages/relay/
├── wrangler.jsonc                   # CF config (JSONC not TOML)
├── src/index.ts                     # Worker fetch: routes /pub /sub
├── src/talk-do.ts                   # TalkDO durable object (SQLite + WS hibernation)
└── test/*.test.ts                   # @cloudflare/vitest-pool-workers
```

## Critical conventions

- **Slidev floor: `^52.15.0`**. Older versions only support `preCodeblock` (MarkdownTransformer), not `codeblocks` (CodeblockTransformer). Addon emits `<DynamicCode>` via `codeblocks` → silently no-op on older slidev.
- **`#slidev/configs` is a DEFAULT export.** Not named. `import configs from '#slidev/configs'`. Got bit once.
- **`:deep()` only works in `<style scoped>`.** `DynamicCode.vue` uses unscoped style (to target v-html shiki output) → use plain descendant selectors, no `:deep()`. Got bit once → caused 0.1.2 caret drift regression.
- **Textarea + shiki metrics must match exactly.** Both elements need identical `font-family / font-size / line-height / font-feature-settings / font-variation-settings / letter-spacing / tab-size`. Any drift accumulates per char → caret floats away. Mirror slidev's own `ShikiEditor.vue` approach: one CSS rule with both selectors, `!important` to win specificity over slidev's `.slidev-code`.
- **Hardcoded fallbacks dropped from CSS.** Pull from slidev vars: `--slidev-code-padding`, `--slidev-code-radius`, `--slidev-code-font-family`, `--slidev-code-line-height`, etc. Container styling comes from `.slidev-code-wrapper` + `.slidev-code` classes (slidev's CSS does the heavy lifting). Caret color exception: `#000` light / `#fff` dark — `--shiki-light`/`--shiki-dark` don't cascade into the sibling textarea.
- **Origin hash = `sha256(trim(fenced)).slice(0, 12)`**. Embedded at build, sent w/ each edit. DO compares stored hash vs incoming — mismatch overwrites. Audience ignores incoming `update` if its compiled hash differs from msg hash.
- **Manual id required.** Auto-id (slide-no + nth) breaks on slide reorder. Build throws on missing id OR duplicate id across deck.

## Commands

From repo root:

```bash
pnpm install
pnpm test                                            # all packages
pnpm typecheck                                       # all packages
pnpm lint                                            # eslint . — antfu config
pnpm lint:fix
pnpm -F slidev-addon-dynamic-code test               # addon only
pnpm -F @opariffazman/slidev-dynamic-code-relay test # relay only (uses miniflare)
```

Relay local:

```bash
cd packages/relay
pnpm wrangler deploy --dry-run --outdir /tmp/dryrun  # validate wrangler.jsonc
pnpm wrangler dev                                    # local server on :8787
pnpm wrangler deploy                                 # ship to prod
pnpm wrangler secret put PRESENTER_TOKEN
```

Auth on headless server (no browser):

```bash
export CLOUDFLARE_API_TOKEN=...      # https://dash.cloudflare.com/profile/api-tokens (Edit Cloudflare Workers template)
export CLOUDFLARE_ACCOUNT_ID=...     # right sidebar on dash
```

## Release process

Tag-driven. CI publishes on `v*` tag push.

```bash
# Bump version
sed -i 's/"version": "0.1.X"/"version": "0.1.Y"/' packages/addon/package.json
pnpm install                                         # update lockfile
git commit -am "chore(addon): bump to 0.1.Y"
git tag -a v0.1.Y -m "v0.1.Y — what changed"
git push --follow-tags
gh run watch                                         # confirm green
```

CI file: `.github/workflows/release.yml`. Uses `NPM_TOKEN` secret (granular, "All packages" scope until trusted-publishers gets set up).

## Conventional commits

`feat(addon|relay):` `fix(addon|relay):` `chore:` `docs:` `test:` `ci:` — kept by hand, no enforcement tool. Body wraps at ~78 cols. Co-author trailer optional.

## Test layout

- Addon: vitest + `@vue/test-utils` + `happy-dom` + `mock-socket`. Tests in `packages/addon/test/`.
- Relay: vitest w/ `@cloudflare/vitest-pool-workers`. Tests in `packages/relay/test/`. Isolated DO storage per test.
- No e2e in CI (Playwright lives at `e2e/` but only runs locally — needs `wrangler dev` + `slidev` running).

## CI

`.github/workflows/ci.yml` runs lint + typecheck + addon tests + relay tests on every push / PR. `release.yml` publishes on `v*` tag.

## Gotchas to remember

- pnpm 11 dropped `package.json` `pnpm.onlyBuiltDependencies` — moved to `pnpm-workspace.yaml`. New format: `allowBuilds: { pkg: true }` AND `onlyBuiltDependencies: [pkg]`.
- pnpm 11 added `minimumReleaseAge` policy. Default cooldown blocks fresh-published packages for 24h. Add each new version of this addon to `minimumReleaseAgeExclude` in the consuming repo until 24h passes — or set `minimumReleaseAge: 0` workspace-wide to disable.
- Slidev 52.15.x added `slide-import-guard` plugin. Blocks `<img src="/abs/path">` in slide markdown. Use `:src="\`${$slidev.configs.base ?? '/'}path\`"` instead.
- For local testing into a consuming deck without npm publish: `pnpm pack --pack-destination /tmp/foo`, `cp /tmp/foo/*.tgz <deck>/vendor/`, `pnpm add -D file:./vendor/PKG.tgz`. Bump tarball name on each iteration (pnpm caches by file path).
- npm classic Automation tokens are gone. Only granular tokens. First publish needs "All packages" scope (granular can't target nonexistent packages). After first publish, narrow to selected packages or set up Trusted Publishers (OIDC, no token).
- `wrangler.jsonc` is preferred over `wrangler.toml` since wrangler 4. Both still work.
- Wrangler resets cwd after each command (claude-code shell quirk). Don't chain commands across cwd changes.

## Consumer pattern

```yaml
# slides.md frontmatter
addons:
  - slidev-addon-dynamic-code
dynamicCode:
  relayUrl: https://slidev-dynamic-code-relay.YOUR-SUBDOMAIN.workers.dev
  talkId: deck-name-2026
```

Presenter URL: `?presenter=TOKEN`. Audience: same URL without query. Token validated against Worker secret `PRESENTER_TOKEN`.

Block ids must be unique across deck. Talk ids namespace the DO instance — different decks under same relay can reuse block ids freely.

## Architecture in 1 sentence

Build-time codeblock transformer emits `<DynamicCode>` Vue component (lz-encoded fenced + origin-hash); runtime component overlays an invisible textarea on shiki-rendered `<pre>`, syncs via WS to a Durable Object keyed by `talkId`; audience subscribes, presenter publishes, DO broadcasts + persists.

## Out of scope (do not add without strong reason)

- Multi-presenter / collaborative editing (last-write-wins is intentional).
- Code execution inside slide (display only; users run commands in their real terminal).
- VS Code extension integration.
- Per-keystroke history / undo across reloads.
- Themable connection badge (static glyphs are fine).
