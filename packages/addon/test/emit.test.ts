import lz from 'lz-string'
import { describe, expect, it } from 'vitest'
import { emitDynamicCode } from '../lib/emit'

describe('emitDynamicCode', () => {
  it('emits a DynamicCode tag with required attrs', async () => {
    const html = await emitDynamicCode({
      id: 'install',
      lang: 'bash',
      code: 'npm install foo',
      ranges: null,
    })
    expect(html).toContain('<DynamicCode')
    expect(html).toContain('id="install"')
    expect(html).toContain('lang="bash"')
    expect(html).toMatch(/origin-hash="[0-9a-f]{12}"/)
    const codeLzMatch = html.match(/code-lz="([^"]+)"/)
    expect(codeLzMatch).toBeTruthy()
    expect(lz.decompressFromBase64(codeLzMatch![1]!)).toBe('npm install foo')
  })

  it('does NOT emit a :ranges attr when ranges is null', async () => {
    const html = await emitDynamicCode({
      id: 'install',
      lang: 'bash',
      code: 'echo',
      ranges: null,
    })
    expect(html).not.toContain(':ranges')
    expect(html).not.toContain('v-bind')
  })

  it('emits :ranges as a single-quoted JSON array when ranges are present', async () => {
    const html = await emitDynamicCode({
      id: 'install',
      lang: 'bash',
      code: 'echo',
      ranges: ['2-3', '5', 'all'],
    })
    expect(html).toContain(`:ranges='["2-3","5","all"]'`)
    expect(html).not.toContain('v-bind')
  })

  it('escapes the id attribute', async () => {
    const html = await emitDynamicCode({
      id: 'foo"bar',
      lang: 'bash',
      code: 'echo',
      ranges: null,
    })
    expect(html).not.toContain('foo"bar"')
    expect(html).toContain('id="foo&quot;bar"')
  })
})
