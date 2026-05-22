export type ClientMessage
  = | { t: 'edit', id: string, hash: string, content: string }
    | { t: 'reset', id: string }
    | { t: 'reset_all' }

export type ServerMessage
  = | { t: 'snapshot', blocks: Record<string, { hash: string, content: string }> }
    | { t: 'update', id: string, hash: string | null, content: string | null }
    | { t: 'error', code: string, message: string }

export function encodeClientMessage(m: ClientMessage): string {
  return JSON.stringify(m)
}

export function decodeServerMessage(raw: string): ServerMessage | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object')
    return null
  const obj = parsed as Record<string, unknown>
  switch (obj.t) {
    case 'snapshot':
      if (obj.blocks && typeof obj.blocks === 'object')
        return obj as ServerMessage
      return null
    case 'update':
      if (typeof obj.id === 'string')
        return obj as ServerMessage
      return null
    case 'error':
      if (typeof obj.code === 'string' && typeof obj.message === 'string')
        return obj as ServerMessage
      return null
    default:
      return null
  }
}
