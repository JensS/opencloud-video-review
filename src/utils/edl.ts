import type { ReviewComment } from '../types'
import { formatTimecodeEdl } from './time'

/**
 * Generate a CMX 3600 EDL file from review comments.
 * Can be imported into DaVinci Resolve, Premiere, Avid, etc.
 *
 * Each comment becomes an edit event with the comment text as a note.
 * Color tags are mapped to comment marker colors where supported.
 */
export function generateEdl(
  comments: ReviewComment[],
  fileName: string,
  duration: number,
  fps: number = 24
): string {
  const lines: string[] = []
  const title = fileName.replace(/\.[^/.]+$/, '')

  lines.push(`TITLE: ${title} — Video Review`)
  lines.push(`FCM: NON-DROP FRAME`)
  lines.push('')

  const sorted = [...comments].sort((a, b) => a.timestamp - b.timestamp)

  sorted.forEach((comment, i) => {
    const eventNum = String(i + 1).padStart(3, '0')
    const srcIn = formatTimecodeEdl(comment.timestamp, fps)
    // Each marker is 1 frame long
    const srcOut = formatTimecodeEdl(comment.timestamp + (1 / fps), fps)
    const recIn = srcIn
    const recOut = srcOut

    // Event line: edit number, reel, track, transition, source in/out, record in/out
    lines.push(`${eventNum}  AX       V     C        ${srcIn} ${srcOut} ${recIn} ${recOut}`)

    // Clip name
    lines.push(`* FROM CLIP NAME: ${fileName}`)

    // Comment as locator/note
    const colorMap: Record<string, string> = {
      red: 'RED', yellow: 'YELLOW', green: 'GREEN',
      blue: 'BLUE', purple: 'PURPLE',
    }
    const edlColor = colorMap[comment.color] || 'YELLOW'

    lines.push(`* LOC: ${srcIn} ${edlColor}     ${comment.author}: ${comment.text}`)
    lines.push(`* COMMENT: [${comment.color.toUpperCase()}] ${comment.author}: ${comment.text}`)

    if (comment.drawing) {
      lines.push(`* COMMENT: [DRAWING ATTACHED]`)
    }

    lines.push('')
  })

  // Summary at the end
  lines.push(`* === VIDEO REVIEW SUMMARY ===`)
  lines.push(`* Total comments: ${comments.length}`)
  lines.push(`* Exported: ${new Date().toISOString()}`)

  const colorCounts = comments.reduce<Record<string, number>>((acc, c) => {
    acc[c.color] = (acc[c.color] || 0) + 1
    return acc
  }, {})
  for (const [color, count] of Object.entries(colorCounts)) {
    lines.push(`* ${color}: ${count} comment${count !== 1 ? 's' : ''}`)
  }

  return lines.join('\n') + '\n'
}
