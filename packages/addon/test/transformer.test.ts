import { describe, expect, it } from 'vitest'
import { resetRegistryForTesting } from '../lib/registry'
import { createDynamicCodeTransformer } from '../setup/transformers'

function makeOptions(extra: Partial<Record<string, unknown>> = {}) {
  return {
    data: {
      config: {},
      slides: [{ index: 0, source: { filepath: 'slides.md', start: 0, end: 0 } }],
    },
    mode: 'dev',
    ...extra,
  } as any
}

function makeCtx({
  info,
  code = 'echo hi',
  slideNo = 1,
  options = makeOptions(),
}: { info: string, code?: string, slideNo?: number, options?: any }) {
  return {
    info,
    code,
    fence: 3,
    slide: { index: slideNo - 1 } as any,
    options,
    renderHighlighted: async () => '<pre>fallback</pre>',
  }
}

describe('dynamic-code transformer', () => {
  it('returns null when directive absent', async () => {
    resetRegistryForTesting()
    const t = createDynamicCodeTransformer()
    const result = await t(makeCtx({ info: 'bash' }))
    expect(result).toBeNull()
  })

  it('returns <DynamicCode> for a valid directive', async () => {
    resetRegistryForTesting()
    const t = createDynamicCodeTransformer()
    const result = await t(makeCtx({ info: 'bash {dynamic id=install}', code: 'npm i foo' }))
    expect(result).toContain('<DynamicCode')
    expect(result).toContain('id="install"')
  })

  it('throws when id is missing', async () => {
    resetRegistryForTesting()
    const t = createDynamicCodeTransformer()
    await expect(t(makeCtx({ info: 'bash {dynamic}', slideNo: 3 })))
      .rejects
      .toThrow(/missing required id=.*slide 3/i)
  })

  it('throws on duplicate id across slides in the same build', async () => {
    resetRegistryForTesting()
    const t = createDynamicCodeTransformer()
    const options = makeOptions()
    await t(makeCtx({ info: 'bash {dynamic id=install}', slideNo: 2, options }))
    await expect(t(makeCtx({ info: 'bash {dynamic id=install}', slideNo: 5, options })))
      .rejects
      .toThrow(/duplicate id "install".*slides 2 and 5/i)
  })

  it('does not consider the same id a duplicate across different builds', async () => {
    resetRegistryForTesting()
    const t = createDynamicCodeTransformer()
    const options1 = makeOptions()
    const options2 = makeOptions()
    await t(makeCtx({ info: 'bash {dynamic id=install}', slideNo: 1, options: options1 }))
    await expect(t(makeCtx({ info: 'bash {dynamic id=install}', slideNo: 1, options: options2 })))
      .resolves
      .toContain('<DynamicCode')
  })
})
