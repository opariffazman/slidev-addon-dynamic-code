# slidev-addon-dynamic-code

Live-editable code blocks for [Slidev](https://sli.dev) presentations. Presenter edits code on a slide mid-talk, every audience browser updates in real time.

## Packages

| Package | Purpose | Docs |
|---------|---------|------|
| [`packages/addon`](packages/addon) | Slidev addon — install into your deck | [Usage & setup](packages/addon/README.md) |
| [`packages/relay`](packages/relay) | Cloudflare Worker relay — deploy once | [Deploy guide](packages/relay/README.md) |

## How it works

See [Architecture](docs/architecture.md) for the full build-time → runtime → WebSocket flow.

## License

MIT © opariffazman
