import { ref, type ComputedRef, watch, onUnmounted } from 'vue'
import type { ReviewComment, ApprovalStatus } from '../types'

/**
 * Comments storage composable.
 *
 * Storage strategy:
 * 1. Authenticated users: Sidecar JSON via WebDAV + Bearer token
 * 2. Public share guests: Sidecar JSON via public-files WebDAV + Basic auth (share token)
 * 3. Fallback: localStorage (always, as backup)
 */
export function useComments(fileId: ComputedRef<string>, props: any) {
  const comments = ref<ReviewComment[]>([])
  const approval = ref<ApprovalStatus>('pending')
  let loaded = false

  const storageKey = () => `vr-comments-${fileId.value}`

  // === Auth helpers ===

  function getAuthToken(): string {
    try {
      for (const storage of [sessionStorage, localStorage]) {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i)
          if (!key) continue
          try {
            const raw = storage.getItem(key) || ''
            if (!raw.startsWith('{')) continue
            const data = JSON.parse(raw)
            if (data?.access_token) {
              if (data.expires_at && data.expires_at < Date.now() / 1000) continue
              return data.access_token
            }
          } catch { /* not JSON */ }
        }
      }
      return ''
    } catch {
      return ''
    }
  }

  function getShareToken(): string {
    try {
      // OpenCloud share URLs: /s/{token} in path or hash
      const path = window.location.pathname + window.location.hash
      const match = path.match(/\/s\/([a-zA-Z0-9_-]+)/)
      if (match) return match[1]
      // Also check URL params
      const params = new URLSearchParams(window.location.search)
      const token = params.get('shareToken') || params.get('token')
      if (token) return token
      return ''
    } catch {
      return ''
    }
  }

  // === WebDAV helpers ===

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

  function getSidecarFileName(): string {
    const resource = props.resource
    const name = resource?.name || 'video'
    return `${name}.review.json`
  }

  /**
   * Make a WebDAV request with the best available auth method.
   * Returns the response or null on failure.
   */
  async function webdavRequest(
    method: string,
    path: string,
    body?: string,
  ): Promise<Response | null> {
    const baseUrl = window.location.origin
    const headers: Record<string, string> = {}
    if (body) headers['Content-Type'] = 'application/octet-stream'

    // Strategy 1: Bearer token (authenticated user)
    const token = getAuthToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
      try {
        const url = `${baseUrl}/remote.php/dav${path}`
        const res = await fetch(url, { method, headers, credentials: 'omit', body })
        if (res.ok || res.status === 201 || res.status === 204) return res
      } catch { /* fall through */ }
    }

    // Strategy 2: Public share Basic auth (guest)
    const shareToken = getShareToken()
    if (shareToken) {
      const sidecarName = getSidecarFileName()
      const publicUrl = `${baseUrl}/remote.php/dav/public-files/${shareToken}/${sidecarName}`
      headers['Authorization'] = 'Basic ' + btoa(shareToken + ':')
      try {
        const res = await fetch(publicUrl, { method, headers, credentials: 'omit', body })
        if (res.ok || res.status === 201 || res.status === 204) return res
      } catch { /* fall through */ }
    }

    return null
  }

  // === Load / Save ===

  async function loadFromRemote(): Promise<boolean> {
    const sidecarPath = getSidecarWebDavPath()
    // Try authenticated path first, then public share path
    const res = await webdavRequest('GET', sidecarPath || '/nonexistent')
    if (!res) return false

    try {
      const text = await res.text()
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

  async function saveToRemote() {
    const sidecarPath = getSidecarWebDavPath()
    if (!sidecarPath && !getShareToken()) return

    const data = {
      version: 1,
      fileId: fileId.value,
      approval: approval.value,
      comments: comments.value,
      updatedAt: new Date().toISOString(),
    }

    await webdavRequest('PUT', sidecarPath || '/placeholder', JSON.stringify(data, null, 2))
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
    } catch { /* Storage full or unavailable */ }
  }

  async function loadComments() {
    const fromRemote = await loadFromRemote()
    if (!fromRemote) loadFromLocalStorage()
    loaded = true
  }

  async function saveComments() {
    saveToLocalStorage()
    await saveToRemote()
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

  // Poll for real-time comment sync (every 5s)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    if (pollTimer) return
    pollTimer = setInterval(async () => {
      const sidecarPath = getSidecarWebDavPath()
      if (!sidecarPath && !getShareToken()) return

      const res = await webdavRequest('GET', sidecarPath || '/nonexistent')
      if (!res) return

      try {
        const text = await res.text()
        if (!text) return
        const data = JSON.parse(text)
        const remote = data.comments || []
        const remoteApproval = data.approval || 'pending'

        // Merge: add comments we don't have locally
        const localIds = new Set(comments.value.map(c => c.id))
        let changed = false
        for (const rc of remote) {
          if (!localIds.has(rc.id)) {
            comments.value.push(rc)
            changed = true
          }
        }

        // Remove local comments deleted remotely
        if (remote.length > 0) {
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
    getAuthToken,
    getShareToken,
  }
}
