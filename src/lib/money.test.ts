import { describe, it, expect } from 'vitest'
import { parseMoney } from './money'

describe('parseMoney', () => {
  it('treats empty string as zero', () => {
    expect(parseMoney('')).toBe(0)
  })

  it('parses a plain integer', () => {
    expect(parseMoney('1234')).toBe(1234)
  })

  it('parses a decimal', () => {
    expect(parseMoney('12.50')).toBe(12.5)
  })

  it('rejects a value with two decimal points', () => {
    expect(parseMoney('1.2.3')).toBeNull()
  })

  it('rejects non-numeric text', () => {
    expect(parseMoney('abc')).toBeNull()
  })

  it('trims surrounding whitespace before parsing', () => {
    expect(parseMoney(' 42 ')).toBe(42)
  })
})
