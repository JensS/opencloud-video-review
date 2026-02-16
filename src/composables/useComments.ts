import { ref, type ComputedRef, watch, onUnmounted } from 'vue'
import type { ReviewComment, ApprovalStatus } from '../types'

/**
 * Comments storage composable.
 *
 * Storage: Review API server (simple REST endpoint).
 * - GET  /reviews/{reviewId} → { comments, approval }
 * - PUT  /reviews/{reviewId} → save { comments, approval }
 *
 * The reviewId is passed via URL parameter ?reviewId=xxx
 * Fallback: localStorage (when no API available)
 */
export function useComments(fileId: ComputedRef<string>, _props: any) {
  const comments = ref<ReviewComment[]>([])
  const approval = ref<ApprovalStatus>('pending')
  let loaded = false

  const storageKey = () => `vr-comments-${fileId.value}`

  // === Review API ===

  function getReviewApiBase(): string {
    // Check for explicit config
    const meta = document.querySelector('meta[name="review-api"]')
    if (meta) return meta.getAttribute('content') || ''

    // Default: same origin /review-api or configurable via URL param
    const params = new URLSearchParams(window.location.search)
    const apiUrl = params.get('reviewApi')
    if (apiUrl) return apiUrl

    // Try well-known path on same origin
    return `${window.location.origin}/review-api`
  }

  function getReviewId(): string {
    // From URL param (set by "Share for Review" button)
    const params = new URLSearchParams(window.location.search)
    const id = params.get('reviewId')
    if (id) return id

    // Fallback: derive a safe reviewId from fileId (may contain $, !, : etc.)
    const raw = fileId.value || ''
    if (!raw || raw === 'unknown') return ''
    return hashId(raw)
  }

  // Convert arbitrary fileId to a URL-safe review ID
  function hashId(input: string): string {
    // Simple deterministic hash → base36 string
    let h = 0
    for (let i = 0; i < input.length; i++) {
      h = ((h << 5) - h + input.charCodeAt(i)) | 0
    }
    // Use both hash and a sanitized prefix for readability
    const safe = input.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)
    const hash = Math.abs(h).toString(36)
    return `${safe}-${hash}`
  }

  async function loadFromApi(): Promise<boolean> {
    const reviewId = getReviewId()
    if (!reviewId || reviewId === 'unknown') return false

    const base = getReviewApiBase()
    if (!base) return false

    try {
      const res = await fetch(`${base}/reviews/${encodeURIComponent(reviewId)}`, {
        credentials: 'omit',
      })
      if (!res.ok) return false

      const data = await res.json()
      comments.value = data.comments || []
      approval.value = data.approval || 'pending'
      return true
    } catch {
      return false
    }
  }

  async function saveToApi(): Promise<boolean> {
    const reviewId = getReviewId()
    if (!reviewId || reviewId === 'unknown') return false

    const base = getReviewApiBase()
    if (!base) return false

    try {
      const res = await fetch(`${base}/reviews/${encodeURIComponent(reviewId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          comments: comments.value,
          approval: approval.value,
          fileId: fileId.value,
          updatedAt: new Date().toISOString(),
        }),
      })
      return res.ok
    } catch {
      return false
    }
  }

  // === localStorage fallback ===

  function loadFromLocalStorage(): boolean {
    try {
      const stored = localStorage.getItem(storageKey())
      if (!stored) return false
      const data = JSON.parse(stored)
      comments.value = data.comments || []
      approval.value = data.approval || 'pending'
      return true
    } catch {
      return false
    }
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify({
        comments: comments.value,
        approval: approval.value,
        updatedAt: new Date().toISOString(),
      }))
    } catch { /* full or unavailable */ }
  }

  // === Public interface ===

  async function loadComments() {
    const fromApi = await loadFromApi()
    if (!fromApi) loadFromLocalStorage()
    loaded = true
  }

  async function saveComments() {
    saveToLocalStorage()
    await saveToApi()
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

  // Auto-save on changes (skip initial load)
  let saving = false
  watch(comments, () => {
    if (loaded && !saving) saveComments()
  }, { deep: true })

  // Reload when fileId changes (resource may not be ready at mount)
  watch(fileId, (newId, oldId) => {
    if (newId && newId !== 'unknown' && newId !== oldId) {
      loadComments()
    }
  })

  // Poll for real-time sync (every 5s)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    if (pollTimer) return
    pollTimer = setInterval(async () => {
      const reviewId = getReviewId()
      if (!reviewId || reviewId === 'unknown') return

      const base = getReviewApiBase()
      if (!base) return

      try {
        const res = await fetch(`${base}/reviews/${encodeURIComponent(reviewId)}`, {
          credentials: 'omit',
        })
        if (!res.ok) return

        const data = await res.json()
        const remote = data.comments || []
        const remoteApproval = data.approval || 'pending'

        const localIds = new Set(comments.value.map(c => c.id))
        let changed = false

        // Add new remote comments
        for (const rc of remote) {
          if (!localIds.has(rc.id)) {
            comments.value.push(rc)
            changed = true
          }
        }

        // Remove locally deleted comments
        if (remote.length > 0 || comments.value.length > 0) {
          const remoteIds = new Set(remote.map((c: any) => c.id))
          const before = comments.value.length
          comments.value = comments.value.filter(c => remoteIds.has(c.id))
          if (comments.value.length !== before) changed = true
        }

        if (remoteApproval !== approval.value) {
          approval.value = remoteApproval
          changed = true
        }

        if (changed) {
          saving = true
          saveToLocalStorage()
          saving = false
        }
      } catch { /* silent */ }
    }, 5000)
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  startPolling()
  onUnmounted(stopPolling)

  return {
    comments,
    approval,
    loadComments,
    saveComments,
    addCommentToStore,
    removeComment,
    setApprovalStatus,
    getReviewId,
    getReviewApiBase,
  }
}
