---
theme: default
title: dynamic-code demo
addons:
  - slidev-addon-dynamic-code
dynamicCode:
  relayUrl: http://localhost:8787
  talkId: demo-talk
---

# Dynamic Code Blocks

A live-editable command:

```bash {dynamic id=install-deps}
npm install some-package
```

---

# Another block

```bash {dynamic id=run-server}
pnpm dev --port 3000
```
