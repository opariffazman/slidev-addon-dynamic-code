import { Server } from 'mock-socket'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SyncClient } from '../composables/sync-client'

const URL_BASE = 'ws://localhost:4567'

describe('syncClient', () => {
  let server: Server

  beforeEach(() => {
    server = new Server(`${URL_BASE}/sub?talk=test`)
  })

  afterEach(() => {
    server.stop()
  })

  it('connects as audience and applies an incoming snapshot', async () => {
    const received: any[] = []
    server.on('connection', (socket) => {
      socket.send(JSON.stringify({ t: 'snapshot', blocks: { install: { hash: 'abc', content: 'echo' } } }))
    })

    const client = new SyncClient({
      relayUrl: URL_BASE,
      talkId: 'test',
      mode: 'audience',
      token: null,
      onStateChange: (state) => { received.push(structuredClone(state)) },
    })

    client.connect()
    await vi.waitFor(() => expect(received.at(-1)?.install).toEqual({ hash: 'abc', content: 'echo' }))
    client.dispose()
  })

  it('sends an edit message in presenter mode', async () => {
    server.stop()
    const presenterServer = new Server(`${URL_BASE}/pub?talk=test&token=secret`)
    const messages: string[] = []
    presenterServer.on('connection', (socket) => {
      socket.on('message', (m) => {
        messages.push(String(m))
      })
    })

    const client = new SyncClient({
      relayUrl: URL_BASE,
      talkId: 'test',
      mode: 'presenter',
      token: 'secret',
      onStateChange: () => {},
    })

    client.connect()
    await vi.waitFor(() => expect(presenterServer.clients()).toHaveLength(1))
    client.broadcastEdit('install', 'abc', 'pnpm i foo')
    await vi.waitFor(() => expect(messages).toContain('{"t":"edit","id":"install","hash":"abc","content":"pnpm i foo"}'))
    client.dispose()
    presenterServer.stop()
  })

  it('reports offline status when connection cannot be established', async () => {
    server.stop()
    const statuses: string[] = []
    const client = new SyncClient({
      relayUrl: 'ws://localhost:1', // no server
      talkId: 'test',
      mode: 'audience',
      token: null,
      onStateChange: () => {},
      onStatusChange: (s) => { statuses.push(s) },
    })
    client.connect()
    await vi.waitFor(() => expect(statuses).toContain('offline'))
    client.dispose()
  })
})
