import { describe, expect, it } from 'vitest'
import { parseRangeSteps, parseHighlightRange } from '../lib/parse-ranges'

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

describe('parseHighlightRange', () => {
  it('returns an empty set for "all"', () => {
    expect([...parseHighlightRange('all', 4)]).toEqual([])
  })

  it('returns an empty set for "*"', () => {
    expect([...parseHighlightRange('*', 4)]).toEqual([])
  })

  it('returns an empty set for "hide"', () => {
    expect([...parseHighlightRange('hide', 4)]).toEqual([])
  })

  it('parses a single line', () => {
    expect([...parseHighlightRange('3', 10).values()].sort((a, b) => a - b)).toEqual([3])
  })

  it('parses a range', () => {
    expect([...parseHighlightRange('2-4', 10).values()].sort((a, b) => a - b)).toEqual([2, 3, 4])
  })

  it('parses a comma set with a range', () => {
    expect([...parseHighlightRange('2-3,5', 10).values()].sort((a, b) => a - b)).toEqual([2, 3, 5])
  })

  it('silently drops out-of-range line numbers', () => {
    expect([...parseHighlightRange('2-3,5', 4).values()].sort((a, b) => a - b)).toEqual([2, 3])
    expect([...parseHighlightRange('99', 4)]).toEqual([])
  })

  it('silently drops line 0 and negatives in degenerate ranges', () => {
    expect([...parseHighlightRange('0', 4)]).toEqual([])
  })

  it('handles reverse ranges by normalizing low..high', () => {
    expect([...parseHighlightRange('4-2', 10).values()].sort((a, b) => a - b)).toEqual([2, 3, 4])
  })

  it('returns an empty set for unrecognized spec', () => {
    expect([...parseHighlightRange('foo', 10)]).toEqual([])
  })
})
