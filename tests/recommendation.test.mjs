import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeHashtags } from '../src/recommendation/profile.js'
import { rankCandidates, scoreVideo } from '../src/recommendation/rank.js'

const now = new Date('2026-07-24T12:00:00Z').getTime()
const video = (id, hashtags, creator, overrides = {}) => ({
  id,
  hashtags,
  creator_id: creator,
  createdAt: '2026-07-23T12:00:00Z',
  viewCount: 100,
  likes: 10,
  shares: 2,
  saves: 3,
  completion_rate: .7,
  average_watch_seconds: 20,
  ...overrides,
})
const profile = (overrides = {}) => ({
  seenVideos: {},
  likedVideos: [],
  hashtagWeights: {},
  creatorWeights: {},
  ...overrides,
})

test('normalizes and deduplicates hashtags', () => {
  assert.deepEqual(normalizeHashtags(['#Ghana', 'ghana', '#FOOTBALL', ' Accra! ']), ['ghana', 'football', 'accra'])
})

test('preferred hashtags increase relevance without hard filtering discovery', () => {
  const football = scoreVideo(video('football', ['football', 'ghana'], 'a'), profile({ hashtagWeights: { football: 12, ghana: 8 } }), now, () => 0)
  const cooking = scoreVideo(video('cooking', ['cooking'], 'b'), profile({ hashtagWeights: { football: 12, ghana: 8 } }), now, () => 0)
  assert.ok(football.finalScore > cooking.finalScore)
  const ranked = rankCandidates([
    video('f1', ['football'], 'a'),
    video('f2', ['football'], 'b'),
    video('travel', ['travel'], 'c'),
    video('music', ['music'], 'd'),
  ], profile({ hashtagWeights: { football: 12 } }), { limit: 4, now, random: () => .25 })
  assert.deepEqual(new Set(ranked.map(({ id }) => id)).size, 4)
  assert.ok(ranked.some(({ id }) => id === 'travel' || id === 'music'))
})

test('recently seen videos receive a decisive suppression penalty', () => {
  const recent = scoreVideo(video('seen', ['football'], 'a'), profile({
    hashtagWeights: { football: 20 },
    seenVideos: { seen: { lastSeenAt: now - 60_000 } },
  }), now, () => 0)
  const unseen = scoreVideo(video('new', ['other'], 'b'), profile(), now, () => 0)
  assert.ok(recent.seenPenalty >= 1000)
  assert.ok(recent.finalScore < unseen.finalScore)
})

test('limits a creator to two selections in a ten-video window when alternatives exist', () => {
  const candidates = [
    ...Array.from({ length: 6 }, (_, index) => video(`same-${index}`, ['football'], 'same')),
    ...Array.from({ length: 10 }, (_, index) => video(`other-${index}`, ['topic'], `creator-${index}`)),
  ]
  const ranked = rankCandidates(candidates, profile({ hashtagWeights: { football: 20 } }), { limit: 10, now, random: () => .4 })
  assert.ok(ranked.filter((item) => item.creator_id === 'same').length <= 2)
  assert.equal(new Set(ranked.map((item) => item.id)).size, ranked.length)
})

test('new-user cold start returns a mixed, duplicate-free feed', () => {
  const candidates = Array.from({ length: 12 }, (_, index) =>
    video(`v${index}`, [`topic${index % 4}`], `c${index % 5}`, { createdAt: new Date(now - index * 3600_000).toISOString() }))
  const ranked = rankCandidates(candidates, profile(), { limit: 10, now, random: () => .3 })
  assert.equal(ranked.length, 10)
  assert.equal(new Set(ranked.map((item) => item.id)).size, 10)
  assert.ok(new Set(ranked.map((item) => item.hashtags[0])).size > 1)
})
