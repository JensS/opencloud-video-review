export interface ReviewComment {
  id: string
  timestamp: number
  text: string
  author: string
  color: string
  drawing?: string
  createdAt: string
}

export type ApprovalStatus = 'pending' | 'approved' | 'revisions'

export interface ReviewData {
  version: number
  fileId: string
  fileName: string
  duration: number
  approval: ApprovalStatus
  comments: ReviewComment[]
  exportedAt: string
}
