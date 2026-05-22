import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

async function openWS(url: string): Promise<WebSocket> {
  const res = await SELF.fetch(url, { headers: { Upgrade: 'websocket', Connection: 'Upgrade' } })
  const ws = res.webSocket
  if (!ws)
    throw new Error('no websocket on response')
  ws.accept()
  return ws
}

async function waitMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    ws.addEventListener('message', (e: any) => resolve(String(e.data)), { once: true })
    ws.addEventListener('error', () => reject(new Error('ws error')), { once: true })
  })
}

describe('talkDO snapshot on subscribe', () => {
  it('sends an empty snapshot to a fresh subscriber', async () => {
    const ws = await openWS('https://relay/sub?talk=fresh')
    const msg = await waitMessage(ws)
    expect(JSON.parse(msg)).toEqual({ t: 'snapshot', blocks: {} })
    ws.close()
  })
})
