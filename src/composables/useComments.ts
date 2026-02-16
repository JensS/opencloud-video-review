import { ref, type ComputedRef, watch, onUnmounted } from 'vue'
import type { ReviewComment, ApprovalStatus } from '../types'

/**
 * Comments storage composable.
 *
 * Storage strategy (in priority order):
 * 1. Sidecar JSON file via WebDAV fetch (if authenticated)
 * 2. LocalStorage fallback (always, for guests and as backup)
 *
 * The sidecar file is stored next to the video as `<filename>.review.json`.
 */
export function useComments(fileId: ComputedRef<string>, props: any) {
  const comments = ref<ReviewComment[]>([])
  const approval = ref<ApprovalStatus>('pending')
  let loaded = false

  const storageKey = () => `vr-comments-${fileId.value}`

  function getAuthToken(): string {
    try {
      // Only sessionStorage — localStorage may have stale tokens from previous sessions
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (!key) continue
        if (key.startsWith('oidc.user:')) {
          try {
            const data = JSON.parse(sessionStorage.getItem(key) || '')
            if (!data?.access_token) continue
            if (data.expires_at && data.expires_at < Date.now() / 1000) continue
            return data.access_token
          } catch { /* not JSON */ }
        }
      }
      return ''
    } catch {
      return ''
    }
  }

  function getSidecarWebDavPath(): string | null {
    try {
      const resource = props.resource
      if (!resource) return null
      const webDavPath = resource.webDavPath || resource.path
      if (!webDavPath) return null
      return `${webDavPath}.review.json`
    } catch {
      return null
    }
  }

  async function loadFromSidecar(): Promise<boolean> {
    const token = getAuthToken()
    if (!token) return false

    const sidecarPath = getSidecarWebDavPath()
    if (!sidecarPath) return false

    try {
      const url = `${window.location.origin}/remote.php/dav${sidecarPath}`
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'omit',
      })

      if (!response.ok) return false

      const text = await response.text()
      if (!text) return false

      const data = JSON.parse(text)
      comments.value = data.comments || []
      approval.value = data.approval || 'pending'
      return true
    } catch {
      return false
    }
  }

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

  async function saveToSidecar() {
    const token = getAuthToken()
    if (!token) return

    const sidecarPath = getSidecarWebDavPath()
    if (!sidecarPath) return

    const data = {
      version: 1,
      fileId: fileId.value,
      approval: approval.value,
      comments: comments.value,
      updatedAt: new Date().toISOString(),
    }

    try {
      const url = `${window.location.origin}/remote.php/dav${sidecarPath}`
      await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'omit',
        body: JSON.stringify(data, null, 2),
      })
    } catch {
      console.warn('[VideoReview] Could not write sidecar file')
    }
  }

  function saveToLocalStorage() {
    try {
      const data = {
        version: 1,
        fileId: fileId.value,
        approval: approval.value,
        comments: comments.value,
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem(storageKey(), JSON.stringify(data))
    } catch {
      // Storage full or unavailable
    }
  }

  async function loadComments() {
    // Try sidecar first (authenticated users), then localStorage
    const fromSidecar = await loadFromSidecar()
    if (!fromSidecar) {
      loadFromLocalStorage()
    }
    loaded = true
  }

  async function saveComments() {
    // Always save to localStorage
    saveToLocalStorage()
    // Also save sidecar for authenticated users
    await saveToSidecar()
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

  // Auto-save when comments change (skip initial load)
  let saving = false
  watch(comments, () => {
    if (loaded && !saving) saveComments()
  }, { deep: true })

  // Reload comments when fileId changes (resource may not be ready at mount)
  watch(fileId, (newId, oldId) => {
    if (newId && newId !== 'unknown' && newId !== oldId) {
      loadComments()
    }
  })

  // Poll sidecar for real-time comment sync (every 5s)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    if (pollTimer) return
    pollTimer = setInterval(async () => {
      const token = getAuthToken()
      if (!token) return

      const sidecarPath = getSidecarWebDavPath()
      if (!sidecarPath) return

      try {
        const url = `${window.location.origin}/remote.php/dav${sidecarPath}`
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'omit',
        })
        if (!response.ok) return

        const text = await response.text()
        if (!text) return

        const data = JSON.parse(text)
        const remote = data.comments || []
        const remoteApproval = data.approval || 'pending'

        // Merge: add any comments we don't have locally
        const localIds = new Set(comments.value.map(c => c.id))
        let changed = false
        for (const rc of remote) {
          if (!localIds.has(rc.id)) {
            comments.value.push(rc)
            changed = true
          }
        }

        // Check for deletions: remove local comments not in remote (if remote has data)
        if (remote.length > 0) {
          const remoteIds = new Set(remote.map((c: any) => c.id))
          const before = comments.value.length
          comments.value = comments.value.filter(c => remoteIds.has(c.id))
          if (comments.value.length !== before) changed = true
        }

        // Update approval if changed remotely
        if (remoteApproval !== approval.value) {
          approval.value = remoteApproval
          changed = true
        }

        // Save merged state to localStorage (suppress watcher save loop)
        if (changed) {
          saving = true
          saveToLocalStorage()
          saving = false
        }
      } catch {
        // Polling failure is silent
      }
    }, 5000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  // Auto-start polling, clean up on unmount
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
  }
}
