import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('relay routing', () => {
  it('returns 400 when talk param missing on /sub', async () => {
    const res = await SELF.fetch('https://relay/sub')
    expect(res.status).toBe(400)
  })

  it('returns 400 when talk param missing on /pub', async () => {
    const res = await SELF.fetch('https://relay/pub')
    expect(res.status).toBe(400)
  })

  it('returns 401 on /pub with wrong token', async () => {
    const res = await SELF.fetch('https://relay/pub?talk=t&token=wrong', {
      headers: { Upgrade: 'websocket', Connection: 'Upgrade' },
    })
    expect(res.status).toBe(401)
  })

  it('returns 404 for unknown paths', async () => {
    const res = await SELF.fetch('https://relay/whatever')
    expect(res.status).toBe(404)
  })
})
