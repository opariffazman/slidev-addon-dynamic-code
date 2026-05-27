import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '#slidev/configs': new URL('./test/__mocks__/slidev-configs.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    setupFiles: ['./test/setup-mock-socket.ts'],
  },
})
