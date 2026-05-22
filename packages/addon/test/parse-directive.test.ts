import { describe, expect, it } from 'vitest'
import { parseDynamicDirective } from '../lib/parse-directive'

describe('parseDynamicDirective', () => {
  it('returns null when {dynamic} is absent', () => {
    expect(parseDynamicDirective('bash')).toBeNull()
    expect(parseDynamicDirective('ts {monaco}')).toBeNull()
  })

  it('parses {dynamic id=NAME} and returns lang + id', () => {
    expect(parseDynamicDirective('bash {dynamic id=install}')).toEqual({
      lang: 'bash',
      id: 'install',
      extraMeta: null,
    })
  })

  it('preserves trailing options object as extraMeta', () => {
    expect(parseDynamicDirective('bash {dynamic id=install} {lines: true}')).toEqual({
      lang: 'bash',
      id: 'install',
      extraMeta: '{lines: true}',
    })
  })

  it('returns a "missing id" sentinel when id is absent', () => {
    expect(parseDynamicDirective('bash {dynamic}')).toEqual({
      lang: 'bash',
      id: null,
      extraMeta: null,
    })
  })

  it('accepts id with letters, digits, _ and -', () => {
    expect(parseDynamicDirective('bash {dynamic id=install_step-2}')!.id).toBe('install_step-2')
  })

  it('returns null for id with disallowed characters (treated as no match)', () => {
    expect(parseDynamicDirective('bash {dynamic id=foo bar}')).toEqual({
      lang: 'bash',
      id: null,
      extraMeta: null,
    })
  })
})
