import { useSlideContext } from '@slidev/client'

// Soft accessor for Slidev's slide context. Returns null when the hook
// throws (called outside a slide tree, future API change, etc). The static
// import resolves at bundle time — @slidev/client is a peer dep, so Slidev's
// own Vite bundle satisfies it; in tests, vi.mock replaces this entire helper
// module so the import is never reached.
export function tryUseSlideContext(): { $clicksContext?: any } | null {
  try { return useSlideContext() as any }
  catch { return null }
}
