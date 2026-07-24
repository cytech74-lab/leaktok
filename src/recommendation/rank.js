const DAY = 24 * 60 * 60 * 1000
const primaryTag = (video) => video.hashtags?.[0] || ''
const creator = (video) => String(video.creator_id || video.creator_name || '')
const log = (value) => Math.log1p(Math.max(0, Number(value || 0)))

export const scoreVideo = (video, profile, now = Date.now(), random = Math.random) => {
  const tags = video.hashtags || []
  const hashtagScore = tags.length
    ? tags.reduce((sum, tag) => sum + Number(profile.hashtagWeights?.[tag] || 0), 0) / Math.sqrt(tags.length)
    : 0
  const creatorScore = Number(profile.creatorWeights?.[creator(video)] || 0)
  const popularityScore = log(video.viewCount) + 2 * log(video.likes) + 3 * log(video.shares) + 2 * log(video.saves)
  const completionRate = Number(video.completion_rate || 0)
  const watchQualityScore = completionRate * 12 + Math.min(8, log(video.average_watch_seconds))
  const published = new Date(video.published_at || video.createdAt || 0).getTime()
  const ageDays = Math.max(0, (now - published) / DAY)
  const freshnessScore = 10 * Math.exp(-ageDays / 7)
  const trendingScore = Math.min(15, Number(video.trending_score || 0) || (popularityScore / Math.max(1, Math.sqrt(ageDays + 1))))
  const seen = profile.seenVideos?.[video.id]
  const seenAge = seen ? now - seen.lastSeenAt : Infinity
  const seenPenalty = seenAge < 30 * 60 * 1000 ? 1000 : seenAge < DAY ? 70 : seenAge < 7 * DAY ? 25 : seenAge < 30 * DAY ? 7 : 0
  const likedPenalty = profile.likedVideos?.includes(video.id) ? 25 : 0
  const explorationScore = random() * 8
  const finalScore = hashtagScore * 1.6 + creatorScore + popularityScore + watchQualityScore + freshnessScore + trendingScore + explorationScore - seenPenalty - likedPenalty
  return { finalScore, hashtagScore, creatorScore, popularityScore, watchQualityScore, freshnessScore, trendingScore, explorationScore, seenPenalty }
}

const weightedPick = (items, random) => {
  if (!items.length) return null
  const floor = Math.min(...items.map((item) => item.score.finalScore))
  const weights = items.map((item) => Math.max(.1, item.score.finalScore - floor + 1))
  let target = random() * weights.reduce((sum, weight) => sum + weight, 0)
  const index = weights.findIndex((weight) => (target -= weight) <= 0)
  return items.splice(index < 0 ? 0 : index, 1)[0]
}

export const rankCandidates = (videos, profile, { limit = 10, random = Math.random, now = Date.now() } = {}) => {
  const unique = [...new Map(videos.map((video) => [video.id, video])).values()]
  const scored = unique.map((video) => ({ video, score: scoreVideo(video, profile, now, random) }))
  const knownInterests = Object.values(profile.hashtagWeights || {}).some((weight) => weight > 0)
  const personalized = scored.filter(({ score }) => score.hashtagScore > 0 || score.creatorScore > 0).sort((a, b) => b.score.finalScore - a.score.finalScore)
  const trending = [...scored].sort((a, b) => (b.score.trendingScore + b.score.popularityScore) - (a.score.trendingScore + a.score.popularityScore))
  const discovery = [...scored].sort((a, b) => (b.score.freshnessScore + b.score.watchQualityScore + b.score.explorationScore) - (a.score.freshnessScore + a.score.watchQualityScore + a.score.explorationScore))
  const targets = knownInterests ? ['personalized','personalized','trending','personalized','discovery','personalized','trending','personalized','discovery','personalized'] : ['trending','fresh','discovery','trending','fresh','discovery','trending','fresh','discovery','trending']
  const pools = { personalized, trending, discovery, fresh: discovery }
  const selected = []
  const creatorCounts = {}
  const tagCounts = {}

  for (let index = 0; index < limit && selected.length < unique.length; index += 1) {
    const preferred = pools[targets[index % targets.length]]
    const candidates = preferred.filter(({ video }) =>
      !selected.some((item) => item.video.id === video.id)
      && (!creator(video) || (creatorCounts[creator(video)] || 0) < 2)
      && (!primaryTag(video) || (tagCounts[primaryTag(video)] || 0) < 3))
    const fallback = scored.filter(({ video }) => !selected.some((item) => item.video.id === video.id))
    const creatorSafeFallback = fallback.filter(({ video }) =>
      !creator(video) || (creatorCounts[creator(video)] || 0) < 2)
    const pick = weightedPick(candidates.length ? candidates : creatorSafeFallback.length ? creatorSafeFallback : fallback, random)
    if (!pick) break
    selected.push(pick)
    if (creator(pick.video)) creatorCounts[creator(pick.video)] = (creatorCounts[creator(pick.video)] || 0) + 1
    if (primaryTag(pick.video)) tagCounts[primaryTag(pick.video)] = (tagCounts[primaryTag(pick.video)] || 0) + 1
  }

  if (import.meta.env?.DEV && import.meta.env.VITE_RECOMMENDATION_DEBUG === 'true') {
    console.table(selected.map(({ video, score }, index) => ({ rank: index + 1, video_id: video.id, ...score })))
  }
  return selected.map(({ video }) => video)
}
