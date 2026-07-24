import { useEffect, useRef, useState } from 'react'
import { videos as fallbackVideos } from '../data/mockVideos'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { getRecommendedFeed } from '../services/leaktokApi'
import { initializeAnalytics } from '../services/analytics'
import { getAnalyticsIdentity } from '../services/analytics'
import { setVideoLike, setVideoSaved } from '../services/leaktokApi'
import { useToast } from './Toast'
import VideoCard from './VideoCard'
import TopNav from './TopNav'
import BottomNav from './BottomNav'
import { getRecommendationProfile, recommendationRequest, recordImpression, recordLike, recordSave, recordShare, recordWatch } from '../recommendation/profile'
import { rankCandidates } from '../recommendation/rank'

export default function VideoFeed() {
  const [videos, setVideos] = useState([])
  const [active, setActive] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [fetching, setFetching] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)
  const [muted, setMuted] = useState(true)
  const [liked, setLiked] = useLocalStorage('leaktok-liked', [])
  const [saved, setSaved] = useLocalStorage('leaktok-saved', [])
  const feedRef = useRef()
  const controlsRef = useRef()
  const feedTokenRef = useRef()
  const toast = useToast()

  const toggle = (set, values, id) => set(values.includes(id) ? values.filter((item) => item !== id) : [...values, id])
  const loadPage = async (nextPage, replace = false) => {
    if (!replace && (fetching || !hasMore)) return
    setFetching(true)
    try {
      const existingIds = replace ? [] : videos.map((video) => video.id)
      const request = recommendationRequest(getAnalyticsIdentity().visitor_id, existingIds, 10, feedTokenRef.current)
      const result = await getRecommendedFeed(request, nextPage)
      const ranked = result.personalized ? result.videos : rankCandidates(result.videos, getRecommendationProfile(), { limit: result.videos.length })
      setVideos((items) => replace ? ranked : [...items, ...ranked.filter((video) => !items.some((item) => item.id === video.id))])
      feedTokenRef.current = result.feedToken
      setPage(nextPage)
      setHasMore(result.hasMore)
      setUsingFallback(false)
    } catch {
      if (replace) {
        setVideos(fallbackVideos)
        setHasMore(false)
        setUsingFallback(true)
        toast('Showing saved demo videos — reconnecting soon')
      }
    } finally {
      setFetching(false)
    }
  }
  useEffect(() => {
    loadPage(1, true)
    return initializeAnalytics()
  }, [])
  useEffect(() => {
    if (!usingFallback && hasMore && videos.length && active >= videos.length - 3) loadPage(page + 1)
  }, [active, videos.length, hasMore, usingFallback, page])
  useEffect(() => {
    const video = videos[active]
    if (video) recordImpression(video)
  }, [active, videos[active]?.id])
  useEffect(() => {
    if (!feedRef.current || !videos.length) return
    const cards = [...feedRef.current.querySelectorAll('.video-card')]
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= .65) setActive(cards.indexOf(entry.target))
      })
    }, { root: feedRef.current, threshold: [.65] })
    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [videos.length])
  useEffect(() => {
    const keydown = (event) => {
      if (/INPUT|TEXTAREA/.test(event.target.tagName)) return
      if (event.code === 'Space') { event.preventDefault(); controlsRef.current?.togglePlay() }
      if (event.key === 'm' || event.key === 'M') controlsRef.current?.toggleMute()
      if (event.key === 'l' || event.key === 'L') controlsRef.current?.like()
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const next = Math.min(videos.length - 1, Math.max(0, active + (event.key === 'ArrowDown' ? 1 : -1)))
        feedRef.current.children[next]?.scrollIntoView({ behavior: 'smooth' })
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [active, videos.length])

  return (
    <main className="feed-shell">
      <div className="feed" ref={feedRef}>
        {videos.map((video, index) => (
          <VideoCard key={video.id} video={video} active={active === index} muted={muted} setMuted={setMuted}
            liked={liked.includes(video.id)} saved={saved.includes(video.id)}
            onLike={() => {
              const enabled = !liked.includes(video.id)
              toggle(setLiked, liked, video.id)
              recordLike(video, enabled)
              setVideoLike(video.id, getAnalyticsIdentity().visitor_id, enabled).catch(() => {})
            }}
            onSave={() => {
              const enabled = !saved.includes(video.id)
              toggle(setSaved, saved, video.id)
              recordSave(video, enabled)
              setVideoSaved(video.id, getAnalyticsIdentity().visitor_id, enabled).catch(() => {})
              toast(enabled ? 'Video saved' : 'Removed from saved')
            }}
            onShareRecorded={() => recordShare(video)}
            onWatch={(stats) => recordWatch(video, stats)}
            showTopNav showBottomNav controlsRef={controlsRef} />
        ))}
        {fetching && videos.length > 0 && <div className="feed-fetching" aria-label="Loading more videos"><span /></div>}
        {!fetching && videos.length === 0 && <div className="feed-error"><strong>Videos could not load</strong><p>Check your connection and try again.</p><button onClick={() => loadPage(1, true)}>Retry</button></div>}
      </div>
      <TopNav />
      <BottomNav />
    </main>
  )
}
