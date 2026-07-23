import { postAnalytics } from './leaktokApi'

const SESSION_TIMEOUT = 30 * 60 * 1000
const HEARTBEAT_INTERVAL = 45 * 1000
const visitorKey = 'leaktok_visitor_id'
const sessionKey = 'leaktok_session'
const viewedKey = 'leaktok_viewed_session'

const randomId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`

function getIdentity() {
  let visitorId = localStorage.getItem(visitorKey)
  if (!visitorId) {
    visitorId = randomId()
    localStorage.setItem(visitorKey, visitorId)
  }
  let sessionData
  try { sessionData = JSON.parse(localStorage.getItem(sessionKey)) } catch { sessionData = null }
  if (!sessionData || Date.now() - Number(sessionData.lastActive || 0) > SESSION_TIMEOUT) {
    sessionData = { id: randomId(), lastActive: Date.now() }
    sessionStorage.removeItem(viewedKey)
  } else {
    sessionData.lastActive = Date.now()
  }
  localStorage.setItem(sessionKey, JSON.stringify(sessionData))
  return { visitorId, sessionId: sessionData.id }
}

const identity = getIdentity()
let heartbeatTimer
let currentVideoId = ''
let watch = null

const payload = () => ({ visitor_id: identity.visitorId, session_id: identity.sessionId })
const safely = (promise) => promise.catch(() => {})

export function initializeAnalytics() {
  safely(postAnalytics('/analytics/session/start', {
    ...payload(),
    page: window.location.pathname,
    referrer: document.referrer,
  }))
  const heartbeat = () => safely(postAnalytics('/analytics/heartbeat', {
    ...payload(),
    current_page: window.location.pathname,
    current_video_id: currentVideoId || undefined,
  }))
  heartbeat()
  heartbeatTimer ||= window.setInterval(heartbeat, HEARTBEAT_INTERVAL)
  const hidden = () => {
    if (document.hidden) endVideoWatch()
    else heartbeat()
  }
  document.addEventListener('visibilitychange', hidden)
  return () => document.removeEventListener('visibilitychange', hidden)
}

export const getAnalyticsIdentity = () => ({ ...payload() })

export function beginVideoWatch(videoId) {
  if (!videoId || watch?.videoId === videoId) return
  endVideoWatch()
  currentVideoId = videoId
  watch = { videoId, startedAt: performance.now(), viewTimer: null }
  watch.viewTimer = window.setTimeout(() => {
    let viewed = []
    try { viewed = JSON.parse(sessionStorage.getItem(viewedKey)) || [] } catch { viewed = [] }
    if (!viewed.includes(videoId)) {
      safely(postAnalytics(`/videos/${encodeURIComponent(videoId)}/view`, payload()))
      sessionStorage.setItem(viewedKey, JSON.stringify([...viewed, videoId]))
    }
  }, 2000)
}

export function endVideoWatch() {
  if (!watch) return
  clearTimeout(watch.viewTimer)
  const watchedSeconds = (performance.now() - watch.startedAt) / 1000
  const videoId = watch.videoId
  watch = null
  currentVideoId = ''
  if (watchedSeconds >= .25) {
    safely(postAnalytics('/analytics/video/watch', {
      ...payload(),
      video_id: videoId,
      watched_seconds: Math.min(watchedSeconds, 600),
    }, true))
  }
}
