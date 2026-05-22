import type { ClientMessage } from '../lib/protocol'
import { decodeServerMessage, encodeClientMessage } from '../lib/protocol'

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'rejected'

export interface SyncClientOptions {
  relayUrl: string
  talkId: string
  mode: 'presenter' | 'audience'
  token: string | null
  onStateChange: (state: Record<string, { hash: string, content: string }>) => void
  onStatusChange?: (status: ConnectionStatus) => void
}

const BACKOFF_SCHEDULE = [1000, 2000, 4000, 8000, 16000, 30000] as const

export class SyncClient {
  private ws: WebSocket | null = null
  private state: Record<string, { hash: string, content: string }> = {}
  private status: ConnectionStatus = 'connecting'
  private backoffIdx = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private disposed = false
  private outboundQueue: ClientMessage[] = []

  constructor(private readonly options: SyncClientOptions) {}

  connect(): void {
    if (this.disposed)
      return
    const url = this.url()
    this.setStatus('connecting')
    try {
      this.ws = new WebSocket(url)
    }
    catch {
      this.scheduleReconnect()
      return
    }
    this.ws.addEventListener('open', () => this.onOpen())
    this.ws.addEventListener('message', e => this.onMessage(String((e as MessageEvent).data)))
    this.ws.addEventListener('close', e => this.onClose(e as CloseEvent))
    this.ws.addEventListener('error', () => {
      // Defer status change to close handler so we know if rejected vs offline.
    })
  }

  broadcastEdit(id: string, hash: string, content: string): void {
    this.send({ t: 'edit', id, hash, content })
  }

  broadcastReset(id: string): void {
    this.send({ t: 'reset', id })
  }

  broadcastResetAll(): void {
    this.send({ t: 'reset_all' })
  }

  dispose(): void {
    this.disposed = true
    if (this.reconnectTimer)
      clearTimeout(this.reconnectTimer)
    if (this.ws && this.ws.readyState <= 1)
      this.ws.close()
    this.ws = null
  }

  private url(): string {
    const path = this.options.mode === 'presenter' ? '/pub' : '/sub'
    const params = new URLSearchParams({ talk: this.options.talkId })
    if (this.options.mode === 'presenter' && this.options.token)
      params.set('token', this.options.token)
    return `${this.options.relayUrl}${path}?${params.toString()}`
  }

  private send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN)
      this.ws.send(encodeClientMessage(msg))
    else
      this.outboundQueue.push(msg)
  }

  private flushQueue(): void {
    while (this.outboundQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const msg = this.outboundQueue.shift()!
      this.ws.send(encodeClientMessage(msg))
    }
  }

  private onOpen(): void {
    this.backoffIdx = 0
    this.setStatus('connected')
    this.flushQueue()
  }

  private onMessage(raw: string): void {
    const msg = decodeServerMessage(raw)
    if (!msg)
      return
    if (msg.t === 'snapshot') {
      this.state = { ...msg.blocks }
      this.options.onStateChange(this.state)
    }
    else if (msg.t === 'update') {
      if (msg.content === null) {
        delete this.state[msg.id]
      }
      else if (typeof msg.hash === 'string') {
        this.state[msg.id] = { hash: msg.hash, content: msg.content }
      }
      this.options.onStateChange({ ...this.state })
    }
    else if (msg.t === 'error' && msg.code === 'unauthorized') {
      this.setStatus('rejected')
    }
  }

  private onClose(e: CloseEvent): void {
    if (this.disposed)
      return
    if (e.code === 4001 || this.status === 'rejected') {
      this.setStatus('rejected')
      return
    }
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    this.setStatus(this.backoffIdx === 0 ? 'offline' : 'reconnecting')
    const delay = BACKOFF_SCHEDULE[Math.min(this.backoffIdx, BACKOFF_SCHEDULE.length - 1)]!
    this.backoffIdx++
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status)
      return
    this.status = status
    this.options.onStatusChange?.(status)
  }
}
