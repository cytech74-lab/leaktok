import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import VideoCard from '../components/VideoCard'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useToast } from '../components/Toast'
import Logo from '../components/Logo'
import { applyVideoMetadata } from '../utils/seo'
import { getVideo, setVideoLike, setVideoSaved } from '../services/leaktokApi'
import { getAnalyticsIdentity } from '../services/analytics'
import { videos as fallbackVideos } from '../data/mockVideos'
import { recordImpression, recordLike, recordSave, recordShare, recordWatch } from '../recommendation/profile'
import DiscoveryLinks from '../components/DiscoveryLinks'

export default function VideoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [video, setVideo] = useState(() => fallbackVideos.find((item) => item.id === id) || null)
  const [loading, setLoading] = useState(!video)
  const [notFound, setNotFound] = useState(false)
  const [muted, setMuted] = useState(true)
  const [liked, setLiked] = useLocalStorage('leaktok-liked', [])
  const [saved, setSaved] = useLocalStorage('leaktok-saved', [])
  const toast = useToast()
  const toggle = (set, values, value) => set(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  useEffect(() => {
    const controller = new AbortController()
    const fallbackVideo = fallbackVideos.find((item) => String(item.id) === id) || null
    setVideo(fallbackVideo)
    setLoading(!fallbackVideo)
    setNotFound(false)

    getVideo(id, controller.signal)
      .then((result) => { setVideo(result); setNotFound(false) })
      .catch((error) => {
        if (error.name !== 'AbortError' && !fallbackVideo) setNotFound(true)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [id])
  useEffect(() => {
    if (!video) {
      document.title = 'Video Not Found | LeakTok'
      const robots = document.head.querySelector('meta[name="robots"]')
      robots?.setAttribute('content', 'noindex, follow')
      return
    }
    return applyVideoMetadata(video)
  }, [video])
  useEffect(() => {
    if (video) recordImpression(video)
  }, [video?.id])
  if (loading) return <main className="not-found"><Logo /><p>Loading video…</p></main>
  if (!video || notFound) return <main className="not-found"><Logo /><h1>Video not found</h1><p>This leak may have moved or no longer exists.</p><button onClick={() => navigate('/')}>Back to feed</button></main>
  return (
    <main className="single-video">
      <button className="back-overlay icon-button" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft /></button>
      <VideoCard video={video} active muted={muted} setMuted={setMuted} liked={liked.includes(id)} saved={saved.includes(id)}
        onLike={() => {
          const enabled = !liked.includes(id)
          toggle(setLiked, liked, id)
          recordLike(video, enabled)
          setVideoLike(id, getAnalyticsIdentity().visitor_id, enabled).catch(() => {})
        }}
        onSave={() => {
          const enabled = !saved.includes(id)
          toggle(setSaved, saved, id)
          recordSave(video, enabled)
          setVideoSaved(id, getAnalyticsIdentity().visitor_id, enabled).catch(() => {})
          toast(enabled ? 'Video saved' : 'Removed from saved')
        }}
        onShareRecorded={() => recordShare(video)}
        onWatch={(stats) => recordWatch(video, stats)}
      />
      <DiscoveryLinks className="single-video-links" />
    </main>
  )
}
