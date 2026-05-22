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

describe('talkDO reset', () => {
  it('per-block reset removes the row and broadcasts update with null content', async () => {
    const pub = await openWS('https://relay/pub?talk=r1&token=test-secret')
    await waitMessage(pub, m => m.t === 'snapshot')
    pub.send(JSON.stringify({ t: 'edit', id: 'a', hash: 'h', content: 'echo' }))
    await waitMessage(pub, m => m.t === 'update')

    const sub = await openWS('https://relay/sub?talk=r1')
    const snap1 = await waitMessage(sub, m => m.t === 'snapshot')
    expect(snap1.blocks.a).toEqual({ hash: 'h', content: 'echo' })

    pub.send(JSON.stringify({ t: 'reset', id: 'a' }))
    const upd = await waitMessage(sub, m => m.t === 'update' && m.id === 'a')
    expect(upd).toEqual({ t: 'update', id: 'a', hash: null, content: null })

    // Fresh subscriber sees empty snapshot.
    const sub2 = await openWS('https://relay/sub?talk=r1')
    const snap2 = await waitMessage(sub2, m => m.t === 'snapshot')
    expect(snap2.blocks).toEqual({})

    pub.close()
    sub.close()
    sub2.close()
  })

  it('reset_all clears the talk', async () => {
    const pub = await openWS('https://relay/pub?talk=r2&token=test-secret')
    await waitMessage(pub, m => m.t === 'snapshot')
    pub.send(JSON.stringify({ t: 'edit', id: 'a', hash: 'h', content: 'one' }))
    pub.send(JSON.stringify({ t: 'edit', id: 'b', hash: 'h', content: 'two' }))
    await waitMessage(pub, m => m.t === 'update' && m.id === 'b')

    pub.send(JSON.stringify({ t: 'reset_all' }))

    const sub = await openWS('https://relay/sub?talk=r2')
    const snap = await waitMessage(sub, m => m.t === 'snapshot')
    expect(snap.blocks).toEqual({})

    pub.close()
    sub.close()
  })
})
