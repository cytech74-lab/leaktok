const PROFILE_KEY = 'leaktok_recommendation_profile'
const SESSION_KEY = 'leaktok_feed_session_id'
const MAX_SEEN = 500
const MIN_WEIGHT = -20
const MAX_WEIGHT = 50
const DECAY_INTERVAL = 7 * 24 * 60 * 60 * 1000
const DECAY_FACTOR = .9

const emptyProfile = () => ({
  seenVideos: {},
  likedVideos: [],
  sharedVideos: [],
  savedVideos: [],
  hashtagWeights: {},
  creatorWeights: {},
  lastUpdated: Date.now(),
})

export const normalizeHashtags = (hashtags = []) => [...new Set(
  hashtags
    .flatMap((tag) => String(tag).split(/[,\s]+/))
    .map((tag) => tag.toLowerCase().replace(/^#+/, '').replace(/[^\p{L}\p{N}_-]/gu, '').trim())
    .filter(Boolean),
)]

const bounded = (value) => Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, value))
const creatorKey = (video) => String(video.creator_id || video.creator_name || '').trim()

const prune = (profile) => {
  const recentSeen = Object.entries(profile.seenVideos || {})
    .sort(([, a], [, b]) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0))
    .slice(0, MAX_SEEN)
  profile.seenVideos = Object.fromEntries(recentSeen)
  profile.likedVideos = [...new Set(profile.likedVideos || [])].slice(-100)
  profile.sharedVideos = [...new Set(profile.sharedVideos || [])].slice(-100)
  profile.savedVideos = [...new Set(profile.savedVideos || [])].slice(-100)
  return profile
}

const decay = (profile, now = Date.now()) => {
  const periods = Math.floor((now - Number(profile.lastUpdated || now)) / DECAY_INTERVAL)
  if (periods < 1) return profile
  const factor = DECAY_FACTOR ** periods
  for (const weights of [profile.hashtagWeights, profile.creatorWeights]) {
    Object.keys(weights || {}).forEach((key) => {
      weights[key] = Math.round(weights[key] * factor * 100) / 100
      if (Math.abs(weights[key]) < .1) delete weights[key]
    })
  }
  profile.lastUpdated = now
  return profile
}

export const getRecommendationProfile = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY))
    return decay({ ...emptyProfile(), ...stored })
  } catch {
    return emptyProfile()
  }
}

const save = (profile) => {
  const next = prune({ ...profile, lastUpdated: Date.now() })
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
  return next
}

const adjustInterests = (profile, video, hashtagDelta, creatorDelta) => {
  normalizeHashtags(video.hashtags).forEach((tag) => {
    profile.hashtagWeights[tag] = bounded(Number(profile.hashtagWeights[tag] || 0) + hashtagDelta)
  })
  const creator = creatorKey(video)
  if (creator) profile.creatorWeights[creator] = bounded(Number(profile.creatorWeights[creator] || 0) + creatorDelta)
}

const updateList = (list, id, enabled) => enabled
  ? [...new Set([...list, String(id)])]
  : list.filter((item) => item !== String(id))

export const recordImpression = (video) => {
  const profile = getRecommendationProfile()
  const previous = profile.seenVideos[video.id] || {}
  profile.seenVideos[video.id] = { ...previous, lastSeenAt: Date.now() }
  return save(profile)
}

export const recordLike = (video, enabled = true) => {
  const profile = getRecommendationProfile()
  profile.likedVideos = updateList(profile.likedVideos, video.id, enabled)
  adjustInterests(profile, video, enabled ? 5 : -1.5, enabled ? 4 : -1)
  return save(profile)
}

export const recordSave = (video, enabled = true) => {
  const profile = getRecommendationProfile()
  profile.savedVideos = updateList(profile.savedVideos, video.id, enabled)
  adjustInterests(profile, video, enabled ? 6 : -1.5, enabled ? 4 : -1)
  return save(profile)
}

export const recordShare = (video) => {
  const profile = getRecommendationProfile()
  profile.sharedVideos = updateList(profile.sharedVideos, video.id, true)
  adjustInterests(profile, video, 7, 5)
  return save(profile)
}

export const recordWatch = (video, { watchSeconds = 0, watchPercent = 0, rewatch = false } = {}) => {
  const profile = getRecommendationProfile()
  const percent = Math.max(0, Math.min(1, watchPercent))
  const previous = profile.seenVideos[video.id] || {}
  profile.seenVideos[video.id] = {
    ...previous,
    lastSeenAt: Date.now(),
    watchSeconds: Math.max(Number(previous.watchSeconds || 0), watchSeconds),
    watchPercent: Math.max(Number(previous.watchPercent || 0), percent),
  }
  let hashtagDelta = percent >= .9 ? 4 : percent >= .6 ? 2 : percent >= .3 ? .5 : percent < .15 ? -1 : 0
  let creatorDelta = percent >= .9 ? 3 : percent < .15 ? -1 : 0
  if (rewatch) { hashtagDelta += 5; creatorDelta += 3 }
  adjustInterests(profile, video, hashtagDelta, creatorDelta)
  return save(profile)
}

const topWeights = (weights, limit = 20) => Object.fromEntries(
  Object.entries(weights || {}).sort(([, a], [, b]) => b - a).slice(0, limit),
)

export const getFeedSessionId = () => {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

export const recommendationRequest = (visitorId, excludeIds = [], limit = 10, feedToken) => {
  const profile = getRecommendationProfile()
  const seenIds = Object.entries(profile.seenVideos)
    .sort(([, a], [, b]) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, 100)
    .map(([id]) => id)
  return {
    visitor_id: visitorId,
    feed_session_id: getFeedSessionId(),
    feed_token: feedToken || undefined,
    seen_video_ids: seenIds,
    exclude_video_ids: [...new Set(excludeIds)].slice(-200),
    liked_video_ids: profile.likedVideos.slice(-50),
    shared_video_ids: profile.sharedVideos.slice(-50),
    saved_video_ids: profile.savedVideos.slice(-50),
    hashtag_weights: topWeights(profile.hashtagWeights),
    creator_weights: topWeights(profile.creatorWeights),
    limit,
  }
}

export { PROFILE_KEY }
