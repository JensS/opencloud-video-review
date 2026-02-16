import { ref, type Ref, type ComputedRef, watch } from 'vue'
import type { ReviewComment, ApprovalStatus } from '../types'

/**
 * Comments storage composable.
 *
 * Storage strategy (in priority order):
 * 1. Sidecar JSON file via WebDAV (if authenticated with write access)
 * 2. LocalStorage fallback (for public links or read-only access)
 *
 * The sidecar file is stored next to the video as `<filename>.review.json`.
 */
export function useComments(fileId: ComputedRef<string>, props: any) {
  const comments = ref<ReviewComment[]>([])
  const approval = ref<ApprovalStatus>('pending')
  const canWriteRemote = ref(false)

  const storageKey = () => `vr-comments-${fileId.value}`

  // Try to detect the WebDAV path for sidecar file
  function getSidecarUrl(): string | null {
    try {
      const resource = props.resource
      if (!resource) return null

      // Build sidecar path from resource's WebDAV path
      const webDavPath = resource.webDavPath || resource.path
      if (!webDavPath) return null

      return `${webDavPath}.review.json`
    } catch {
      return null
    }
  }

  async function loadComments() {
    // Try sidecar file first
    const sidecarUrl = getSidecarUrl()
    if (sidecarUrl) {
      try {
        const client = (props as any).clientService?.webdav
        if (client) {
          const response = await client.getFileContents(sidecarUrl, { format: 'text' })
          if (response) {
            const data = JSON.parse(response as string)
            comments.value = data.comments || []
            approval.value = data.approval || 'pending'
            canWriteRemote.value = true
            return
          }
        }
      } catch {
        // Sidecar doesn't exist yet or no access — fall through
      }
    }

    // Fallback: localStorage
    try {
      const stored = localStorage.getItem(storageKey())
      if (stored) {
        const data = JSON.parse(stored)
        comments.value = data.comments || []
        approval.value = data.approval || 'pending'
      }
    } catch {
      // ignore
    }
  }

  async function saveComments() {
    const data = {
      version: 1,
      fileId: fileId.value,
      approval: approval.value,
      comments: comments.value,
      updatedAt: new Date().toISOString(),
    }

    // Always save to localStorage as backup
    try {
      localStorage.setItem(storageKey(), JSON.stringify(data))
    } catch {
      // Storage full or unavailable
    }

    // Try to save sidecar file
    if (canWriteRemote.value) {
      const sidecarUrl = getSidecarUrl()
      if (sidecarUrl) {
        try {
          const client = (props as any).clientService?.webdav
          if (client) {
            await client.putFileContents(sidecarUrl, JSON.stringify(data, null, 2), {
              contentLength: false,
              overwrite: true,
            })
          }
        } catch {
          // Write failed — localStorage is our backup
          console.warn('[VideoReview] Could not write sidecar file, using localStorage')
        }
      }
    }
  }

  function addCommentToStore(comment: ReviewComment) {
    comments.value.push(comment)
    saveComments()
  }

  function removeComment(id: string) {
    comments.value = comments.value.filter(c => c.id !== id)
    saveComments()
  }

  function setApprovalStatus(status: ApprovalStatus) {
    approval.value = status
    saveComments()
  }

  // Auto-save when comments change
  watch(comments, () => saveComments(), { deep: true })

  return {
    comments,
    approval,
    canWriteRemote,
    loadComments,
    saveComments,
    addCommentToStore,
    removeComment,
    setApprovalStatus,
  }
}
