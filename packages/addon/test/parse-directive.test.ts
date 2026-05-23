import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseDynamicDirective } from '../lib/parse-directive'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseDynamicDirective', () => {
  it('returns null when {dynamic} is absent', () => {
    expect(parseDynamicDirective('bash')).toBeNull()
    expect(parseDynamicDirective('ts {monaco}')).toBeNull()
  })

  it('parses {dynamic id=NAME} and returns lang + id', () => {
    expect(parseDynamicDirective('bash {dynamic id=install}')).toEqual({
      lang: 'bash',
      id: 'install',
      ranges: null,
    })
  })

  it('parses a trailing line-highlight group as ranges', () => {
    expect(parseDynamicDirective('bash {dynamic id=install} {2-3|5|all}')).toEqual({
      lang: 'bash',
      id: 'install',
      ranges: ['2-3', '5', 'all'],
    })
  })

  it('warns and drops a trailing modifier-shape extras group', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseDynamicDirective('bash {dynamic id=install} {maxHeight:"200px"}')).toEqual({
      lang: 'bash',
      id: 'install',
      ranges: null,
    })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('[dynamic-code]')
    expect(warn.mock.calls[0]![0]).toContain('install')
    expect(warn.mock.calls[0]![0]).toContain('maxHeight')
  })

  it('returns a "missing id" sentinel when id is absent', () => {
    expect(parseDynamicDirective('bash {dynamic}')).toEqual({
      lang: 'bash',
      id: null,
      ranges: null,
    })
  })

  it('accepts id with letters, digits, _ and -', () => {
    expect(parseDynamicDirective('bash {dynamic id=install_step-2}')!.id).toBe('install_step-2')
  })

  it('treats id with disallowed characters as no id', () => {
    expect(parseDynamicDirective('bash {dynamic id=foo bar}')).toEqual({
      lang: 'bash',
      id: null,
      ranges: null,
    })
  })
})
