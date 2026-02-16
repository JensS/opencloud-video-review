import { describe, it, expect } from 'vitest'
import { generateEdl } from '../../src/utils/edl'
import type { ReviewComment } from '../../src/types'

describe('EDL Export', () => {
  const makeComment = (overrides: Partial<ReviewComment> = {}): ReviewComment => ({
    id: 'test-1',
    timestamp: 83.5, // 00:01:23:12 at 24fps
    text: 'Color grading too warm',
    author: 'Client',
    color: 'red',
    createdAt: '2026-02-16T12:00:00Z',
    ...overrides,
  })

  it('generates valid CMX 3600 header', () => {
    const edl = generateEdl([], 'test.mp4', 120)
    expect(edl).toContain('TITLE: test — Video Review')
    expect(edl).toContain('FCM: NON-DROP FRAME')
  })

  it('generates correct timecodes for comments', () => {
    const comments = [makeComment()]
    const edl = generateEdl(comments, 'final.mp4', 300)
    expect(edl).toContain('001  AX       V     C')
    expect(edl).toContain('00:01:23:12')
    expect(edl).toContain('FROM CLIP NAME: final.mp4')
  })

  it('includes color tags as LOC markers', () => {
    const comments = [makeComment({ color: 'red' })]
    const edl = generateEdl(comments, 'test.mp4', 120)
    expect(edl).toContain('LOC:')
    expect(edl).toContain('RED')
    expect(edl).toContain('Client: Color grading too warm')
  })

  it('sorts comments by timestamp', () => {
    const comments = [
      makeComment({ id: '2', timestamp: 60, text: 'Second' }),
      makeComment({ id: '1', timestamp: 10, text: 'First' }),
      makeComment({ id: '3', timestamp: 120, text: 'Third' }),
    ]
    const edl = generateEdl(comments, 'test.mp4', 180)
    const firstIdx = edl.indexOf('First')
    const secondIdx = edl.indexOf('Second')
    const thirdIdx = edl.indexOf('Third')
    expect(firstIdx).toBeLessThan(secondIdx)
    expect(secondIdx).toBeLessThan(thirdIdx)
  })

  it('includes summary with color counts', () => {
    const comments = [
      makeComment({ id: '1', color: 'red' }),
      makeComment({ id: '2', color: 'red' }),
      makeComment({ id: '3', color: 'green' }),
    ]
    const edl = generateEdl(comments, 'test.mp4', 120)
    expect(edl).toContain('Total comments: 3')
    expect(edl).toContain('red: 2 comments')
    expect(edl).toContain('green: 1 comment')
  })

  it('notes drawing attachments', () => {
    const comments = [makeComment({ drawing: 'data:image/png;base64,...' })]
    const edl = generateEdl(comments, 'test.mp4', 120)
    expect(edl).toContain('[DRAWING ATTACHED]')
  })

  it('handles empty comments array', () => {
    const edl = generateEdl([], 'test.mp4', 120)
    expect(edl).toContain('Total comments: 0')
  })
})
