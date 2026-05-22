import { describe, expect, it } from 'vitest'
import { resolveAddonConfig } from '../lib/read-config'

describe('resolveAddonConfig', () => {
  it('returns relayUrl and talkId from configs', () => {
    expect(resolveAddonConfig({
      dynamicCode: { relayUrl: 'wss://x.example', talkId: 'talk-1' },
    })).toEqual({ relayUrl: 'wss://x.example', talkId: 'talk-1' })
  })

  it('throws on missing relayUrl', () => {
    expect(() => resolveAddonConfig({ dynamicCode: { talkId: 't' } })).toThrow(/dynamicCode.relayUrl/)
  })

  it('throws on missing talkId', () => {
    expect(() => resolveAddonConfig({ dynamicCode: { relayUrl: 'wss://x' } })).toThrow(/dynamicCode.talkId/)
  })

  it('throws on missing dynamicCode block', () => {
    expect(() => resolveAddonConfig({})).toThrow(/dynamicCode/)
  })

  it('converts https://... relayUrl to wss://', () => {
    expect(resolveAddonConfig({ dynamicCode: { relayUrl: 'https://x.example', talkId: 't' } })).toEqual({
      relayUrl: 'wss://x.example',
      talkId: 't',
    })
  })

  it('keeps wss://... as-is', () => {
    expect(resolveAddonConfig({ dynamicCode: { relayUrl: 'wss://x.example', talkId: 't' } })).toEqual({
      relayUrl: 'wss://x.example',
      talkId: 't',
    })
  })
})
