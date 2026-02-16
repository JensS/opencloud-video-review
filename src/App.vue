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

        <button class="ctrl-btn" @click="skipBack" title="Back 5s">⏪</button>
        <button class="ctrl-btn" @click="skipForward" title="Forward 5s">⏩</button>

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
        <div class="sidebar-actions">
          <button @click="exportEdl" class="export-btn" title="Export as EDL for DaVinci Resolve">
            📋 EDL
          </button>
          <button @click="exportJson" class="export-btn" title="Export as JSON">
            💾 JSON
          </button>
        </div>
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
        <h3>Status</h3>
        <div class="approval-buttons">
          <button
            @click="setApproval('approved')"
            class="approval-btn approved"
            :class="{ active: approval === 'approved' }"
          >
            ✅ Approved
          </button>
          <button
            @click="setApproval('revisions')"
            class="approval-btn revisions"
            :class="{ active: approval === 'revisions' }"
          >
            🔄 Revisions Needed
          </button>
          <button
            @click="setApproval('pending')"
            class="approval-btn pending"
            :class="{ active: approval === 'pending' }"
          >
            ⏳ Pending
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, readonly } from 'vue'
import type { ReviewComment, ReviewData, ApprovalStatus } from './types'
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

const newComment = ref({
  author: localStorage.getItem('vr-author') || '',
  text: '',
  color: 'yellow' as string,
})

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
const { comments, approval, loadComments, saveComments, addCommentToStore, removeComment, setApprovalStatus } = useComments(fileId, props)

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
}

function deleteComment(id: string) {
  removeComment(id)
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
          drawCtx.strokeStyle = '#ff3333'
          drawCtx.lineWidth = 3
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

// Export
function exportEdl() {
  const edl = generateEdl(sortedComments.value, fileName.value, duration.value)
  downloadFile(edl, `${fileName.value}.edl`, 'text/plain')
}

function exportJson() {
  const data: ReviewData = {
    version: 1,
    fileId: fileId.value,
    fileName: fileName.value,
    duration: duration.value,
    approval: approval.value,
    comments: comments.value,
    exportedAt: new Date().toISOString(),
  }
  downloadFile(JSON.stringify(data, null, 2), `${fileName.value}.review.json`, 'application/json')
}

function downloadFile(content: string, name: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  loadComments()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style lang="scss" src="./assets/style.scss" />
