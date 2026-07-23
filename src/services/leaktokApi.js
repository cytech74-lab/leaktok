const configuredUrl = import.meta.env.VITE_LEAKTOK_API_URL
const API_URL = (configuredUrl || 'https://www.cytechdevhub.com/api/leaktok').replace(/\/+$/, '')

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || `LeakTok API request failed (${response.status}).`)
    error.status = response.status
    throw error
  }
  return payload
}

const compactCount = (value) => {
  const count = Number(value || 0)
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(0)}K`
  return String(count)
}

export function normalizeVideo(video) {
  const publishedAt = video.published_at || video.created_at
  return {
    ...video,
    id: String(video.id || video._id),
    videoUrl: video.video_url,
    poster: video.thumbnail_url || '/images/leaktok_logo.png',
    thumbnailUrl: video.thumbnail_url || '/images/leaktok_logo.png',
    caption: video.description || video.title || '',
    description: video.description || '',
    title: video.title || video.description?.slice(0, 80) || 'LeakTok video',
    hashtags: Array.isArray(video.hashtags) ? video.hashtags : [],
    createdAt: publishedAt,
    updatedAt: video.updated_at,
    likes: Number(video.likes || 0),
    comments: Number(video.comments || 0),
    shares: Number(video.shares || 0),
    saves: Number(video.saves || 0),
    viewCount: Number(video.views || 0),
    views: compactCount(video.views),
    visibility: video.visibility || 'public',
    allowIndexing: video.allow_indexing !== false,
  }
}

export async function getVideos(page = 1, limit = 10, signal) {
  const payload = await apiRequest(`/videos?page=${page}&limit=${limit}`, { signal })
  return {
    videos: (payload.videos || payload.data?.videos || []).map(normalizeVideo),
    pagination: payload.pagination || payload.data?.pagination || { page, limit, has_more: false },
  }
}

export async function getVideo(id, signal) {
  const payload = await apiRequest(`/videos/${encodeURIComponent(id)}`, { signal })
  return normalizeVideo(payload.data)
}

export async function searchVideos(query, signal) {
  const payload = await apiRequest(`/search?q=${encodeURIComponent(query)}`, { signal })
  return (payload.data || []).map(normalizeVideo)
}

export async function postAnalytics(path, body, keepalive = false) {
  return apiRequest(path, { method: 'POST', body: JSON.stringify(body), keepalive })
}

export async function getVideoComments(id, page = 1) {
  const payload = await apiRequest(`/videos/${encodeURIComponent(id)}/comments?page=${page}&limit=30`)
  return payload.data
}

export async function addVideoComment(id, visitorId, text) {
  const payload = await apiRequest(`/videos/${encodeURIComponent(id)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ visitor_id: visitorId, text }),
  })
  return payload.data
}

export async function setVideoLike(id, visitorId, enabled) {
  const payload = await apiRequest(`/videos/${encodeURIComponent(id)}/like`, {
    method: 'POST',
    body: JSON.stringify({ visitor_id: visitorId, enabled }),
  })
  return payload.data
}

export async function setVideoSaved(id, visitorId, enabled) {
  const payload = await apiRequest(`/videos/${encodeURIComponent(id)}/save`, {
    method: 'POST',
    body: JSON.stringify({ visitor_id: visitorId, enabled }),
  })
  return payload.data
}

export async function trackVideoShare(id, visitorId, channel = 'share_sheet') {
  const payload = await apiRequest(`/videos/${encodeURIComponent(id)}/share`, {
    method: 'POST',
    body: JSON.stringify({ visitor_id: visitorId, channel }),
  })
  return payload.data
}

export { API_URL }
