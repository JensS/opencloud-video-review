/**
 * Format seconds to HH:MM:SS display timecode
 */
export function formatTimecode(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const f = Math.floor((seconds % 1) * 24) // frames at 24fps
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`
  }
  return `${pad(m)}:${pad(s)}:${pad(f)}`
}

/**
 * Format seconds to EDL timecode HH:MM:SS:FF (SMPTE)
 */
export function formatTimecodeEdl(seconds: number, fps: number = 24): string {
  if (!seconds || isNaN(seconds)) return '00:00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const f = Math.floor((seconds % 1) * fps)
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`
}

/**
 * Format ISO date string to relative human-readable format
 */
export function formatRelativeDate(iso: string): string {
  try {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)

    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`

    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h ago`

    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `${diffD}d ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}
