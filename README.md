# slidev-addon-dynamic-code

> Live-editable code blocks for Slidev presentations.

A [Slidev](https://sli.dev) addon that lets the presenter tweak specific code blocks during a talk and broadcasts the changes to every audience browser viewing the same deck. Static build friendly — works on Cloudflare Pages and any other static host.

Pre-talk runbook and full setup live in [`packages/addon/README.md`](packages/addon/README.md).

Two packages live in this monorepo:

- `packages/addon` — the Slidev addon you `pnpm add` into your slides project.
- `packages/relay` — the Cloudflare Worker + Durable Object that brokers edits between presenter and audience.

## License

MIT © opariffazman
