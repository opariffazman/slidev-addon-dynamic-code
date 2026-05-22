import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:3030' },
  webServer: [
    {
      command: 'pnpm -F @opariffazman/slidev-dynamic-code-relay wrangler dev --port 8787',
      port: 8787,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'pnpm -F slidev-addon-dynamic-code-example dev',
      port: 3030,
      reuseExistingServer: true,
      timeout: 90_000,
    },
  ],
})
