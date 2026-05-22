import { describe, expect, it } from 'vitest'
import { decodeServerMessage, encodeClientMessage } from '../lib/protocol'

describe('protocol encoders', () => {
  it('encodes an edit message', () => {
    const s = encodeClientMessage({ t: 'edit', id: 'a', hash: 'h', content: 'c' })
    expect(JSON.parse(s)).toEqual({ t: 'edit', id: 'a', hash: 'h', content: 'c' })
  })

  it('encodes a reset message', () => {
    const s = encodeClientMessage({ t: 'reset', id: 'a' })
    expect(JSON.parse(s)).toEqual({ t: 'reset', id: 'a' })
  })

  it('encodes a reset_all message', () => {
    const s = encodeClientMessage({ t: 'reset_all' })
    expect(JSON.parse(s)).toEqual({ t: 'reset_all' })
  })

  it('decodes a snapshot message', () => {
    const m = decodeServerMessage('{"t":"snapshot","blocks":{"a":{"hash":"h","content":"c"}}}')
    expect(m).toEqual({ t: 'snapshot', blocks: { a: { hash: 'h', content: 'c' } } })
  })

  it('decodes an update message', () => {
    const m = decodeServerMessage('{"t":"update","id":"a","hash":"h","content":"c"}')
    expect(m).toEqual({ t: 'update', id: 'a', hash: 'h', content: 'c' })
  })

  it('returns null for malformed JSON', () => {
    expect(decodeServerMessage('not json')).toBeNull()
  })

  it('returns null for unknown t', () => {
    expect(decodeServerMessage('{"t":"weird"}')).toBeNull()
  })
})
