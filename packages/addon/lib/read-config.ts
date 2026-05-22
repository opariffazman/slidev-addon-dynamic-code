export interface AddonConfig {
  relayUrl: string
  talkId: string
}

export function resolveAddonConfig(configs: Record<string, unknown>): AddonConfig {
  const block = configs.dynamicCode
  if (!block || typeof block !== 'object')
    throw new Error('[dynamic-code] missing `dynamicCode` block in slides frontmatter (need `relayUrl` and `talkId`)')

  const b = block as Record<string, unknown>

  if (typeof b.relayUrl !== 'string' || !b.relayUrl)
    throw new Error('[dynamic-code] dynamicCode.relayUrl is required')

  if (typeof b.talkId !== 'string' || !b.talkId)
    throw new Error('[dynamic-code] dynamicCode.talkId is required')

  let relayUrl: string = b.relayUrl
  if (relayUrl.startsWith('https://'))
    relayUrl = `wss://${relayUrl.slice('https://'.length)}`
  else if (relayUrl.startsWith('http://'))
    relayUrl = `ws://${relayUrl.slice('http://'.length)}`

  return { relayUrl, talkId: b.talkId }
}
