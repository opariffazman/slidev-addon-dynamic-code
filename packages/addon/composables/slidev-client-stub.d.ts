// Minimal type stub for @slidev/client used during tsc type-checking.
// @slidev/client ships .ts source files that reference Vite-injected globals
// (__DEV__, __SLIDEV_HAS_SERVER__, etc.) which are not available outside the
// Slidev build. This stub satisfies the type-checker. Slidev's own Vite bundle
// provides the real implementation at runtime.
// Only the symbols our addon actually imports are declared here.

export declare function useSlideContext(): {
  $clicksContext?: any
  [key: string]: any
}
