import { DurableObject } from 'cloudflare:workers'

interface BlockRow {
  id: string
  hash: string
  content: string
  updated_at: number
  [key: string]: SqlStorageValue
}

const MAX_CONTENT_BYTES = 32 * 1024
const MAX_BLOCKS = 200

export class TalkDO extends DurableObject {
  constructor(state: DurableObjectState, env: any) {
    super(state, env)
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS blocks (
          id TEXT PRIMARY KEY,
          hash TEXT NOT NULL,
          content TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `)
    })
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    if (req.headers.get('Upgrade') !== 'websocket')
      return new Response('expected websocket upgrade', { status: 426 })

    const role: 'presenter' | 'audience' = url.pathname === '/pub' ? 'presenter' : 'audience'
    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]

    this.ctx.acceptWebSocket(server, [role])
    this.sendSnapshot(server)

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw)
    let parsed: any
    try {
      parsed = JSON.parse(text)
    }
    catch {
      return
    }

    const tags = this.ctx.getTags(ws)
    const isPresenter = tags.includes('presenter')

    if (parsed?.t === 'edit' && isPresenter)
      this.handleEdit(parsed, ws)
    else if (parsed?.t === 'reset' && isPresenter)
      this.handleReset(parsed.id)
    else if (parsed?.t === 'reset_all' && isPresenter)
      this.handleResetAll()
  }

  webSocketClose(): void {}

  private sendSnapshot(ws: WebSocket): void {
    const rows = this.ctx.storage.sql.exec<BlockRow>('SELECT id, hash, content, updated_at FROM blocks').toArray()
    const blocks: Record<string, { hash: string, content: string }> = {}
    for (const r of rows)
      blocks[r.id] = { hash: r.hash, content: r.content }
    ws.send(JSON.stringify({ t: 'snapshot', blocks }))
  }

  private handleEdit(msg: { id: string, hash: string, content: string }, sender: WebSocket): void {
    if (typeof msg.id !== 'string' || typeof msg.hash !== 'string' || typeof msg.content !== 'string')
      return

    const size = new TextEncoder().encode(msg.content).byteLength
    if (size > MAX_CONTENT_BYTES) {
      sender.send(JSON.stringify({ t: 'error', code: 'content_too_large', message: `content exceeds ${MAX_CONTENT_BYTES} bytes` }))
      return
    }

    const countRow = this.ctx.storage.sql.exec<{ c: number }>('SELECT COUNT(*) AS c FROM blocks').one()
    const existing = this.ctx.storage.sql.exec<BlockRow>('SELECT id FROM blocks WHERE id = ?', msg.id).toArray()
    if (existing.length === 0 && countRow.c >= MAX_BLOCKS) {
      sender.send(JSON.stringify({ t: 'error', code: 'too_many_blocks', message: `max ${MAX_BLOCKS} block ids per talk` }))
      return
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO blocks (id, hash, content, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET hash = excluded.hash, content = excluded.content, updated_at = excluded.updated_at`,
      msg.id,
      msg.hash,
      msg.content,
      Date.now(),
    )

    this.broadcast({ t: 'update', id: msg.id, hash: msg.hash, content: msg.content })
  }

  private handleReset(id: string): void {
    if (typeof id !== 'string')
      return
    this.ctx.storage.sql.exec('DELETE FROM blocks WHERE id = ?', id)
    this.broadcast({ t: 'update', id, hash: null, content: null })
  }

  private handleResetAll(): void {
    this.ctx.storage.sql.exec('DELETE FROM blocks')
    this.broadcast({ t: 'reset_all_done' })
  }

  private broadcast(message: Record<string, unknown>): void {
    const data = JSON.stringify(message)
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data)
      }
      catch { /* hibernated peer reconnect handles it */ }
    }
  }
}
