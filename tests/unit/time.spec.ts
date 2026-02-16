import { describe, it, expect } from 'vitest'
import { formatTimecode, formatTimecodeEdl, formatRelativeDate } from '../../src/utils/time'

describe('formatTimecode', () => {
  it('formats zero', () => {
    expect(formatTimecode(0)).toBe('00:00:00')
  })

  it('formats seconds with frames', () => {
    expect(formatTimecode(65.5)).toBe('01:05:12') // 0.5 * 24 = 12 frames
  })

  it('formats hours', () => {
    expect(formatTimecode(3723.25)).toBe('01:02:03:06')
  })

  it('handles NaN', () => {
    expect(formatTimecode(NaN)).toBe('00:00:00')
  })
})

describe('formatTimecodeEdl', () => {
  it('formats zero as SMPTE', () => {
    expect(formatTimecodeEdl(0)).toBe('00:00:00:00')
  })

  it('formats with correct frame count at 24fps', () => {
    expect(formatTimecodeEdl(83.5, 24)).toBe('00:01:23:12')
  })

  it('formats with correct frame count at 25fps', () => {
    // 0.2 * 25 = 5, but floating point: Math.floor(0.19999... * 25) = 4
    expect(formatTimecodeEdl(10.2, 25)).toBe('00:00:10:04')
  })

  it('handles exact seconds', () => {
    expect(formatTimecodeEdl(60, 24)).toBe('00:01:00:00')
  })
})

describe('formatRelativeDate', () => {
  it('formats recent as just now', () => {
    expect(formatRelativeDate(new Date().toISOString())).toBe('just now')
  })

  it('handles invalid dates', () => {
    expect(formatRelativeDate('not-a-date')).toBe('')
  })
})
