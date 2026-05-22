import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

async function openWS(url: string): Promise<WebSocket> {
  const res = await SELF.fetch(url, { headers: { Upgrade: 'websocket', Connection: 'Upgrade' } })
  if (!res.webSocket)
    throw new Error('no ws')
  res.webSocket.accept()
  return res.webSocket
}

function waitMessage(ws: WebSocket, predicate: (m: any) => boolean): Promise<any> {
  return new Promise((resolve, reject) => {
    const handler = (e: any) => {
      const msg = JSON.parse(String(e.data))
      if (predicate(msg)) {
        ws.removeEventListener('message', handler)
        resolve(msg)
      }
    }
    ws.addEventListener('message', handler)
    setTimeout(() => reject(new Error('timeout')), 2000)
  })
}

describe('talkDO edit propagation', () => {
  it('audience receives presenter edits', async () => {
    const sub = await openWS('https://relay/sub?talk=edit1')
    await waitMessage(sub, m => m.t === 'snapshot')

    const pub = await openWS('https://relay/pub?talk=edit1&token=test-secret')
    await waitMessage(pub, m => m.t === 'snapshot')

    pub.send(JSON.stringify({ t: 'edit', id: 'install', hash: 'h1', content: 'pnpm i' }))

    const update = await waitMessage(sub, m => m.t === 'update')
    expect(update).toEqual({ t: 'update', id: 'install', hash: 'h1', content: 'pnpm i' })

    sub.close()
    pub.close()
  })

  it('rejects edits from audience-tagged sockets (silently)', async () => {
    const a = await openWS('https://relay/sub?talk=edit2')
    await waitMessage(a, m => m.t === 'snapshot')

    // Send an edit from a sub socket — should be ignored.
    a.send(JSON.stringify({ t: 'edit', id: 'x', hash: 'h', content: 'malicious' }))

    // Verify the DO did not persist by opening a fresh subscriber.
    const b = await openWS('https://relay/sub?talk=edit2')
    const snap = await waitMessage(b, m => m.t === 'snapshot')
    expect(snap.blocks).toEqual({})

    a.close()
    b.close()
  })

  it('rejects oversized edits', async () => {
    const pub = await openWS('https://relay/pub?talk=oversize&token=test-secret')
    await waitMessage(pub, m => m.t === 'snapshot')

    const big = 'x'.repeat(32 * 1024 + 1)
    pub.send(JSON.stringify({ t: 'edit', id: 'a', hash: 'h', content: big }))
    const err = await waitMessage(pub, m => m.t === 'error')
    expect(err.code).toBe('content_too_large')

    pub.close()
  })
})
