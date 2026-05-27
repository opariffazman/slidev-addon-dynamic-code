# slidev-dynamic-code-relay

Cloudflare Worker + Durable Object that brokers live code edits between presenter and audience browsers. Deployed once, serves any number of [slidev-addon-dynamic-code](../addon/README.md) decks.

## Requirements

- A Cloudflare account (free tier is enough)
- pnpm (or npm/yarn)

## Clone and install

```bash
git clone https://github.com/opariffazman/slidev-addon-dynamic-code.git
cd slidev-addon-dynamic-code/packages/relay
pnpm install
```

## Authenticate

**With a browser** (interactive login):

```bash
pnpm wrangler login
```

**Headless** (no browser — CI, remote server):

```bash
export CLOUDFLARE_API_TOKEN="…"   # https://dash.cloudflare.com/profile/api-tokens (template: Edit Cloudflare Workers)
export CLOUDFLARE_ACCOUNT_ID="…"  # right sidebar on https://dash.cloudflare.com
```

## Deploy

```bash
pnpm wrangler deploy
```

Copy the printed URL (e.g. `https://slidev-dynamic-code-relay.YOUR-SUBDOMAIN.workers.dev`) into your deck's `dynamicCode.relayUrl` frontmatter field.

## Set the presenter token

```bash
openssl rand -hex 16 | pnpm wrangler secret put PRESENTER_TOKEN
```

Or paste a strong random string at the prompt. **Save it** — it's write-only; you can't view it later, only rotate.

This token is used as `?presenter=TOKEN` in URLs to authenticate the presenter.

## Verify

```bash
curl -i "https://slidev-dynamic-code-relay.YOUR-SUBDOMAIN.workers.dev/sub?talk=ping"
# Expect: HTTP/2 426 (expected websocket upgrade) — proves Worker + DO routing are live.
```

## Multiple decks

One relay serves any number of decks. Each deck sets a unique `dynamicCode.talkId` in its frontmatter. The Durable Object instance is keyed by `talkId`, so edits are isolated per deck.

Single `PRESENTER_TOKEN` works across all talks on this relay.

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `PRESENTER_TOKEN` | Worker secret (`wrangler secret put`) | Authenticates presenter WebSocket connections |
| `CLOUDFLARE_API_TOKEN` | Shell env (headless only) | Authenticates wrangler CLI to Cloudflare API |
| `CLOUDFLARE_ACCOUNT_ID` | Shell env (headless only) | Identifies your Cloudflare account |

## License

MIT © opariffazman
