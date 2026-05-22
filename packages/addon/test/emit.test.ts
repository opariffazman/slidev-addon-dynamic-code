import lz from 'lz-string'
import { describe, expect, it } from 'vitest'
import { emitDynamicCode } from '../lib/emit'

describe('emitDynamicCode', () => {
  it('emits a DynamicCode tag with required attrs', async () => {
    const html = await emitDynamicCode({
      id: 'install',
      lang: 'bash',
      code: 'npm install foo',
      extraMeta: null,
    })
    expect(html).toContain('<DynamicCode')
    expect(html).toContain('id="install"')
    expect(html).toContain('lang="bash"')
    expect(html).toMatch(/origin-hash="[0-9a-f]{12}"/)
    const codeLzMatch = html.match(/code-lz="([^"]+)"/)
    expect(codeLzMatch).toBeTruthy()
    expect(lz.decompressFromBase64(codeLzMatch![1]!)).toBe('npm install foo')
  })

  it('forwards extraMeta as v-bind', async () => {
    const html = await emitDynamicCode({
      id: 'install',
      lang: 'bash',
      code: 'echo',
      extraMeta: '{maxHeight: "200px"}',
    })
    expect(html).toContain('v-bind="{maxHeight: \\"200px\\"}"')
  })

  it('escapes the id attribute', async () => {
    const html = await emitDynamicCode({
      id: 'foo"bar',
      lang: 'bash',
      code: 'echo',
      extraMeta: null,
    })
    expect(html).not.toContain('foo"bar"')
    expect(html).toContain('id="foo&quot;bar"')
  })
})
