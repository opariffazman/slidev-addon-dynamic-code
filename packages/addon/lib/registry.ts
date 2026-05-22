const registry = new WeakMap<object, Map<string, number>>()

export function getIdRegistry(optionsKey: object): Map<string, number> {
  let map = registry.get(optionsKey)
  if (!map) {
    map = new Map()
    registry.set(optionsKey, map)
  }
  return map
}

export function resetRegistryForTesting(): void {
  // WeakMap has no .clear(); rely on test using a fresh options object instead.
}
