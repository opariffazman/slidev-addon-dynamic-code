import { describe, expect, it } from 'vitest'
import { parseRangeSteps } from '../lib/parse-ranges'

describe('parseRangeSteps', () => {
  it('returns null for null / empty / whitespace', () => {
    expect(parseRangeSteps(null)).toBeNull()
    expect(parseRangeSteps('')).toBeNull()
    expect(parseRangeSteps('   ')).toBeNull()
  })

  it('parses a single step with one range', () => {
    expect(parseRangeSteps('2-3')).toEqual(['2-3'])
    expect(parseRangeSteps('5')).toEqual(['5'])
  })

  it('parses a single step with a comma set', () => {
    expect(parseRangeSteps('1,3,5')).toEqual(['1,3,5'])
  })

  it('parses pipe-separated steps', () => {
    expect(parseRangeSteps('2-3|5|all')).toEqual(['2-3', '5', 'all'])
  })

  it('accepts * and all as full-block aliases', () => {
    expect(parseRangeSteps('1|*|all')).toEqual(['1', '*', 'all'])
  })

  it('accepts hide as a step keyword', () => {
    expect(parseRangeSteps('hide|2-3|all')).toEqual(['hide', '2-3', 'all'])
  })

  it('accepts mixed comma + range within a step', () => {
    expect(parseRangeSteps('2-3,5|7-9|*')).toEqual(['2-3,5', '7-9', '*'])
  })

  it('trims surrounding whitespace inside steps', () => {
    expect(parseRangeSteps(' 2-3 | 5 | all ')).toEqual(['2-3', '5', 'all'])
  })

  it('returns null for modifier-shape input (key:value)', () => {
    expect(parseRangeSteps('maxHeight:"200px"')).toBeNull()
    expect(parseRangeSteps('at:3,lines:true')).toBeNull()
    expect(parseRangeSteps('startLine:10')).toBeNull()
  })

  it('returns null for non-range tokens', () => {
    expect(parseRangeSteps('a|b|c')).toBeNull()
    expect(parseRangeSteps('1|foo|3')).toBeNull()
  })

  it('returns null when any step is empty', () => {
    expect(parseRangeSteps('1||3')).toBeNull()
    expect(parseRangeSteps('|1|2')).toBeNull()
  })
})
