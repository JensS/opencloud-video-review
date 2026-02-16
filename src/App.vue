<template>
  <div class="video-review" :class="{ 'sidebar-open': sidebarOpen && reviewMode }">
    <!-- Video Player Area -->
    <div class="player-area">
      <div class="video-container" ref="videoContainer">
        <video
          ref="videoEl"
          :src="videoUrl"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onMetadataLoaded"
          @click="togglePlay"
          @dblclick="toggleFullscreen"
          crossorigin="anonymous"
        />

        <!-- Drawing overlay -->
        <canvas
          v-if="isDrawing && reviewMode"
          ref="drawCanvas"
          class="draw-overlay"
          @mousedown="startDraw"
          @mousemove="doDraw"
          @mouseup="endDraw"
          @mouseleave="endDraw"
        />

        <!-- Annotation marker on video -->
        <div v-if="activeAnnotation && reviewMode" class="annotation-overlay">
          <img :src="activeAnnotation" class="annotation-image" />
        </div>
      </div>

      <!-- Controls -->
      <div class="controls">
        <button class="ctrl-btn" @click="togglePlay" :title="playing ? 'Pause' : 'Play'">
          <span v-if="playing">⏸</span>
          <span v-else>▶</span>
        </button>

        <button class="ctrl-btn skip-btn" @click="skipBack" title="Back 5s">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
        </button>
        <button class="ctrl-btn skip-btn" @click="skipForward" title="Forward 5s">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
        </button>

        <span class="timecode">{{ formatTimecode(currentTime) }} / {{ formatTimecode(duration) }}</span>

        <!-- Timeline with markers -->
        <div class="timeline" ref="timelineEl" @click="seekTo">
          <div class="timeline-progress" :style="{ width: progress + '%' }" />
          <div class="timeline-playhead" :style="{ left: progress + '%' }" />
          <div
            v-for="comment in (reviewMode ? comments : [])"
            :key="comment.id"
            class="timeline-marker"
            :class="'color-' + comment.color"
            :style="{ left: (comment.timestamp / duration * 100) + '%' }"
            :title="comment.author + ': ' + comment.text"
            @click.stop="jumpToComment(comment)"
          />
        </div>

        <button v-if="reviewMode" class="ctrl-btn" @click="toggleDraw" :class="{ active: isDrawing }" title="Draw on frame">
          ✏️
        </button>

        <button v-if="reviewMode" class="ctrl-btn" @click="sidebarOpen = !sidebarOpen" title="Toggle comments">
          💬 <span class="badge" v-if="comments.length">{{ comments.length }}</span>
        </button>

        <button class="ctrl-btn review-toggle" :class="{ active: reviewMode }" @click="toggleReviewMode" :title="reviewMode ? 'Disable review mode' : 'Enable review mode'">
          {{ reviewMode ? '📝' : '▶️' }}
        </button>

        <select v-model="playbackRate" @change="setPlaybackRate" class="speed-select" title="Playback speed">
          <option :value="0.25">0.25×</option>
          <option :value="0.5">0.5×</option>
          <option :value="1">1×</option>
          <option :value="1.5">1.5×</option>
          <option :value="2">2×</option>
        </select>
      </div>
    </div>

    <!-- Comments Sidebar -->
    <aside class="sidebar" v-if="sidebarOpen && reviewMode">
      <div class="sidebar-header">
        <h2>Comments</h2>
        <button class="share-review-btn" @click="shareForReview" :disabled="sharingInProgress" :title="shareTooltip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          {{ shareBtnLabel }}
        </button>
      </div>

      <!-- Add comment -->
      <div class="add-comment">
        <div class="comment-meta">
          <span class="comment-tc" @click="pauseAndCapture">
            {{ formatTimecode(currentTime) }}
          </span>
          <div class="color-picker">
            <button
              v-for="c in colors"
              :key="c.value"
              class="color-dot"
              :class="['bg-' + c.value, { selected: newComment.color === c.value }]"
              :title="c.label"
              @click="newComment.color = c.value"
            />
          </div>
        </div>
        <input
          v-model="newComment.author"
          placeholder="Your name"
          class="author-input"
        />
        <textarea
          v-model="newComment.text"
          placeholder="Add a comment at this timestamp..."
          class="comment-input"
          @keydown.ctrl.enter="addComment"
          @keydown.meta.enter="addComment"
          rows="3"
        />
        <div class="comment-actions">
          <label class="drawing-label" v-if="drawingDataUrl">
            <span>📎 Drawing attached</span>
            <button @click="drawingDataUrl = ''" class="clear-drawing">✕</button>
          </label>
          <button @click="addComment" class="submit-btn" :disabled="!newComment.text.trim()">
            Add Comment
          </button>
        </div>
      </div>

      <!-- Comment list -->
      <div class="comment-list">
        <div
          v-for="comment in sortedComments"
          :key="comment.id"
          class="comment"
          :class="{ active: activeCommentId === comment.id }"
          @click="jumpToComment(comment)"
        >
          <div class="comment-header">
            <span class="comment-tc" :class="'color-' + comment.color">
              {{ formatTimecode(comment.timestamp) }}
            </span>
            <span class="comment-author">{{ comment.author }}</span>
            <span class="comment-date">{{ formatRelativeDate(comment.createdAt) }}</span>
            <button class="delete-btn" @click.stop="deleteComment(comment.id)" title="Delete">✕</button>
          </div>
          <p class="comment-text">{{ comment.text }}</p>
          <img
            v-if="comment.drawing"
            :src="comment.drawing"
            class="comment-drawing"
            @click.stop="showAnnotation(comment.drawing)"
          />
        </div>

        <div v-if="comments.length === 0" class="empty-state">
          <p>No comments yet.</p>
          <p class="hint">Pause the video and add a comment to start your review.</p>
        </div>
      </div>

      <!-- Approval section -->
      <div class="approval-section">
        <div class="status-dropdown" ref="statusDropdownEl">
          <button
            class="status-btn"
            :class="'status-' + approval"
            @click="statusDropdownOpen = !statusDropdownOpen"
          >
            <span class="status-dot" />
            <span class="status-label">{{ statusLabels[approval] }}</span>
            <svg class="status-arrow" :class="{ open: statusDropdownOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div v-if="statusDropdownOpen" class="status-options">
            <button
              v-for="opt in statusOptions"
              :key="opt.value"
              class="status-option"
              :class="['status-' + opt.value, { selected: approval === opt.value }]"
              @click="setApproval(opt.value); statusDropdownOpen = false"
            >
              <span class="status-dot" />
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, readonly } from 'vue'
import type { ReviewComment, ReviewData, ApprovalStatus } from './types'
import { onClickOutside } from './utils/clickOutside'
import { useComments } from './composables/useComments'
import { generateEdl } from './utils/edl'
import { formatTimecode, formatRelativeDate } from './utils/time'

const props = defineProps<{
  url?: string
  resource?: any
  space?: any
  currentFileContext?: any
}>()

// Review mode — enabled by default, can be toggled or set via URL ?review=false
const reviewModeDefault = (() => {
  try {
    const params = new URLSearchParams(window.location.search)
    const val = params.get('review')
    if (val === 'false' || val === '0') return false
    return true
  } catch { return true }
})()
const reviewMode = ref(reviewModeDefault)

function toggleReviewMode() {
  reviewMode.value = !reviewMode.value
}

// Video state
const videoEl = ref<HTMLVideoElement | null>(null)
const videoContainer = ref<HTMLDivElement | null>(null)
const timelineEl = ref<HTMLDivElement | null>(null)
const drawCanvas = ref<HTMLCanvasElement | null>(null)
const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const progress = ref(0)
const playbackRate = ref(1)
const sidebarOpen = ref(true)
const isDrawing = ref(false)
const drawingDataUrl = ref('')
const activeAnnotation = ref('')
const activeCommentId = ref('')

// Comment state
const colors = [
  { value: 'red', label: 'Red — Issue' },
  { value: 'yellow', label: 'Yellow — Note' },
  { value: 'green', label: 'Green — Approved' },
  { value: 'blue', label: 'Blue — Suggestion' },
  { value: 'purple', label: 'Purple — Creative' },
]

const colorHex: Record<string, string> = {
  red: '#ef4444',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
}

// Status dropdown
const statusDropdownOpen = ref(false)
const statusDropdownEl = ref<HTMLDivElement | null>(null)
const statusLabels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  revisions: 'Revisions Needed',
}
const statusOptions = [
  { value: 'approved' as ApprovalStatus, label: 'Approved' },
  { value: 'revisions' as ApprovalStatus, label: 'Revisions Needed' },
  { value: 'pending' as ApprovalStatus, label: 'Pending' },
]

const newComment = ref({
  author: localStorage.getItem('vr-author') || '',
  text: '',
  color: 'yellow' as string,
})

// Auth detection
const isAuthenticated = ref(false)

// Get video URL from OpenCloud resource
// The AppWrapper provides the 'url' prop when urlForResourceOptions is set
// and the component declares a 'url' prop
const videoUrl = computed(() => {
  if (props.url) return props.url
  if (props.currentFileContext?.url) return props.currentFileContext.url
  if (props.resource?.downloadURL) return props.resource.downloadURL
  return ''
})

// File identifier for storing comments
const fileId = computed(() => {
  return props.resource?.fileId || props.resource?.id || 'unknown'
})

const fileName = computed(() => {
  return props.resource?.name || 'video'
})

// Comments management
const { comments, approval, loadComments, addCommentToStore, removeComment, setApprovalStatus } = useComments(fileId, props)

const sortedComments = computed(() =>
  [...comments.value].sort((a, b) => a.timestamp - b.timestamp)
)

// Video controls
function togglePlay() {
  if (!videoEl.value) return
  if (videoEl.value.paused) {
    videoEl.value.play()
    playing.value = true
  } else {
    videoEl.value.pause()
    playing.value = false
  }
}

function onTimeUpdate() {
  if (!videoEl.value) return
  currentTime.value = videoEl.value.currentTime
  progress.value = duration.value ? (currentTime.value / duration.value) * 100 : 0
}

function onMetadataLoaded() {
  if (!videoEl.value) return
  duration.value = videoEl.value.duration
}

function skipBack() {
  if (videoEl.value) videoEl.value.currentTime = Math.max(0, videoEl.value.currentTime - 5)
}

function skipForward() {
  if (videoEl.value) videoEl.value.currentTime = Math.min(duration.value, videoEl.value.currentTime + 5)
}

function seekTo(e: MouseEvent) {
  if (!timelineEl.value || !videoEl.value) return
  const rect = timelineEl.value.getBoundingClientRect()
  const pct = (e.clientX - rect.left) / rect.width
  videoEl.value.currentTime = pct * duration.value
}

function setPlaybackRate() {
  if (videoEl.value) videoEl.value.playbackRate = playbackRate.value
}

function toggleFullscreen() {
  if (!videoContainer.value) return
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    videoContainer.value.requestFullscreen()
  }
}

// Frame stepping with arrow keys
function onKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  switch (e.key) {
    case ' ':
      e.preventDefault()
      togglePlay()
      break
    case 'ArrowLeft':
      e.preventDefault()
      if (videoEl.value) videoEl.value.currentTime -= e.shiftKey ? 1 : (1 / 24)
      break
    case 'ArrowRight':
      e.preventDefault()
      if (videoEl.value) videoEl.value.currentTime += e.shiftKey ? 1 : (1 / 24)
      break
    case 'j':
      skipBack()
      break
    case 'l':
      skipForward()
      break
    case 'k':
      togglePlay()
      break
  }
}

// Comments
function addComment() {
  if (!newComment.value.text.trim()) return
  const comment: ReviewComment = {
    id: crypto.randomUUID(),
    timestamp: currentTime.value,
    text: newComment.value.text.trim(),
    author: newComment.value.author || 'Anonymous',
    color: newComment.value.color,
    drawing: drawingDataUrl.value || undefined,
    createdAt: new Date().toISOString(),
  }
  addCommentToStore(comment)
  localStorage.setItem('vr-author', newComment.value.author)
  newComment.value.text = ''
  drawingDataUrl.value = ''
  // Auto-save EDL + JSON sidecar to OpenCloud folder
  autoSaveExports()
}

function deleteComment(id: string) {
  removeComment(id)
  autoSaveExports()
}

function jumpToComment(comment: ReviewComment) {
  if (videoEl.value) {
    videoEl.value.currentTime = comment.timestamp
    videoEl.value.pause()
    playing.value = false
  }
  activeCommentId.value = comment.id
  if (comment.drawing) {
    activeAnnotation.value = comment.drawing
    setTimeout(() => { activeAnnotation.value = '' }, 3000)
  }
}

function showAnnotation(drawing: string) {
  activeAnnotation.value = drawing
  setTimeout(() => { activeAnnotation.value = '' }, 5000)
}

function setApproval(status: ApprovalStatus) {
  setApprovalStatus(status)
}

function pauseAndCapture() {
  if (videoEl.value && !videoEl.value.paused) {
    videoEl.value.pause()
    playing.value = false
  }
}

// Drawing
let drawCtx: CanvasRenderingContext2D | null = null
let isMouseDown = false

function toggleDraw() {
  isDrawing.value = !isDrawing.value
  if (isDrawing.value) {
    if (videoEl.value && !videoEl.value.paused) {
      videoEl.value.pause()
      playing.value = false
    }
    nextTick(() => {
      if (drawCanvas.value && videoEl.value) {
        drawCanvas.value.width = videoEl.value.videoWidth || videoEl.value.clientWidth
        drawCanvas.value.height = videoEl.value.videoHeight || videoEl.value.clientHeight
        drawCtx = drawCanvas.value.getContext('2d')
        if (drawCtx) {
          drawCtx.strokeStyle = colorHex[newComment.value.color] || '#ef4444'
          drawCtx.lineWidth = 5
          drawCtx.lineCap = 'round'
          drawCtx.lineJoin = 'round'
        }
      }
    })
  } else if (drawCanvas.value) {
    drawingDataUrl.value = drawCanvas.value.toDataURL('image/png')
  }
}

function startDraw(e: MouseEvent) {
  if (!drawCtx || !drawCanvas.value) return
  isMouseDown = true
  const rect = drawCanvas.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) * (drawCanvas.value.width / rect.width)
  const y = (e.clientY - rect.top) * (drawCanvas.value.height / rect.height)
  drawCtx.beginPath()
  drawCtx.moveTo(x, y)
}

function doDraw(e: MouseEvent) {
  if (!drawCtx || !isMouseDown || !drawCanvas.value) return
  const rect = drawCanvas.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) * (drawCanvas.value.width / rect.width)
  const y = (e.clientY - rect.top) * (drawCanvas.value.height / rect.height)
  drawCtx.lineTo(x, y)
  drawCtx.stroke()
}

function endDraw() {
  isMouseDown = false
}

// Share for Review — creates a public link and copies the review URL
const sharingInProgress = ref(false)
const shareBtnLabel = ref('Share')
const shareTooltip = ref('Create a review link for this video')

async function shareForReview() {
  if (sharingInProgress.value) return
  sharingInProgress.value = true
  shareBtnLabel.value = '...'

  try {
    const resource = props.resource
    if (!resource) throw new Error('No resource')

    const token = getAuthToken()
    if (!token) throw new Error('Not authenticated — please log in to share')
    const baseUrl = window.location.origin
    const filePath = resource.path || resource.webDavPath || ''
    if (!filePath) throw new Error('No file path')

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    // First check if a public link already exists for this file
    const listRes = await fetch(
      `${baseUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json&path=${encodeURIComponent(filePath)}&share_types=3`,
      { headers, credentials: 'omit' }
    )

    let shareToken = ''

    if (listRes.ok) {
      const listData = await listRes.json()
      const existing = listData?.ocs?.data?.[0]
      if (existing?.token) {
        shareToken = existing.token
      }
    }

    // Create new share if none exists
    if (!shareToken) {
      const createRes = await fetch(
        `${baseUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json`,
        {
          method: 'POST',
          headers,
          credentials: 'omit',
          body: new URLSearchParams({
            path: filePath,
            shareType: '3',
            permissions: '1',
            name: `Review: ${fileName.value}`,
          }),
        }
      )

      if (!createRes.ok) {
        const errText = await createRes.text()
        throw new Error(`Share API ${createRes.status}: ${errText}`)
      }

      const createData = await createRes.json()
      shareToken = createData?.ocs?.data?.token
      if (!shareToken) throw new Error('No share token returned')
    }

    // Build a direct URL to our app route for the public share
    // Pattern: /video-review/public/{token}/{filename}?fileId={itemId}
    const fName = encodeURIComponent(fileName.value)
    const itemId = resource.fileId || resource.id || ''
    const reviewUrl = `${baseUrl}/video-review/public/${shareToken}/${fName}?fileId=${encodeURIComponent(itemId)}`
    await copyToClipboard(reviewUrl)

    shareBtnLabel.value = 'Copied!'
    shareTooltip.value = 'Review link copied to clipboard'
    setTimeout(() => {
      shareBtnLabel.value = 'Share'
      shareTooltip.value = 'Create a review link for this video'
    }, 3000)
  } catch (e) {
    console.error('[VideoReview] Share failed:', e)
    shareBtnLabel.value = 'Failed'
    setTimeout(() => { shareBtnLabel.value = 'Share' }, 2000)
  } finally {
    sharingInProgress.value = false
  }
}

function getAuthToken(): string {
  try {
    // OpenCloud stores OIDC user data in sessionStorage with key pattern: oidc.user:...
    // Only check sessionStorage (per-tab) — localStorage may have stale tokens from previous sessions
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (!key) continue
      if (key.startsWith('oidc.user:')) {
        try {
          const data = JSON.parse(sessionStorage.getItem(key) || '')
          if (!data?.access_token) continue
          // Check if token is expired (JWT has 3 dot-separated base64 parts)
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

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Fallback for HTTP/non-secure contexts
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

// Auto-save EDL + JSON exports to the same OpenCloud folder via WebDAV
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

function autoSaveExports() {
  // Debounce: wait 2s after last change before saving
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => doAutoSave(), 2000)
}

async function doAutoSave() {
  if (!comments.value.length && approval.value === 'pending') return

  // Skip auto-save entirely when not authenticated (prevents browser Basic Auth popups)
  const token = getAuthToken()
  if (!token) return

  const resource = props.resource
  if (!resource) return

  const webDavPath = resource.webDavPath || resource.path
  if (!webDavPath) return

  const basePath = webDavPath.replace(/\/?$/, '')

  // Save EDL
  try {
    const edl = generateEdl(sortedComments.value, fileName.value, duration.value)
    await putWebDavFile(`${basePath}.edl`, edl)
  } catch (e) {
    console.warn('[VideoReview] Could not auto-save EDL:', e)
  }

  // Save JSON
  try {
    const data: ReviewData = {
      version: 1,
      fileId: fileId.value,
      fileName: fileName.value,
      duration: duration.value,
      approval: approval.value,
      comments: comments.value,
      exportedAt: new Date().toISOString(),
    }
    await putWebDavFile(`${basePath}.review.json`, JSON.stringify(data, null, 2))
  } catch (e) {
    console.warn('[VideoReview] Could not auto-save JSON:', e)
  }
}

async function putWebDavFile(path: string, content: string) {
  const token = getAuthToken()
  // Skip WebDAV calls entirely when not authenticated (prevents Basic Auth popup)
  if (!token) {
    console.info('[VideoReview] No auth token — skipping WebDAV save (guest mode)')
    return
  }

  const baseUrl = window.location.origin
  const url = `${baseUrl}/remote.php/dav${path}`

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Authorization': `Bearer ${token}`,
    },
    credentials: 'omit',
    body: content,
  })

  if (!response.ok && response.status !== 201 && response.status !== 204) {
    throw new Error(`WebDAV PUT failed: ${response.status}`)
  }
}

// Update pen color when comment color changes during drawing
watch(() => newComment.value.color, (color) => {
  if (drawCtx && isDrawing.value) {
    drawCtx.strokeStyle = colorHex[color] || '#ef4444'
  }
})

// Lifecycle
// Close status dropdown on outside click
onClickOutside(statusDropdownEl, () => { statusDropdownOpen.value = false })

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  isAuthenticated.value = !!getAuthToken()
  loadComments()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style lang="scss" src="./assets/style.scss" />
