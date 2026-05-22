export type SyncMode = 'presenter' | 'audience'

export interface ModeDetection {
  mode: SyncMode
  token: string | null
}

export function detectModeFromLocation(search: string): ModeDetection {
  const params = new URLSearchParams(search)
  const token = params.get('presenter')
  if (token && token.length > 0)
    return { mode: 'presenter', token }
  return { mode: 'audience', token: null }
}
