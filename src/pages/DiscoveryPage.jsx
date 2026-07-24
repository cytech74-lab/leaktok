import { useEffect, useState } from 'react'
import { ArrowLeft, Play } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import DiscoveryLinks from '../components/DiscoveryLinks'
import { getVideos } from '../services/leaktokApi'
import { applyCollectionMetadata } from '../utils/seo'

const pageConfig = {
  trending: { title: 'Trending Videos | LeakTok', heading: 'Trending Videos', description: 'Watch trending and popular videos currently gaining attention on LeakTok.' },
  latest: { title: 'Latest Videos | LeakTok', heading: 'Latest Videos', description: 'Watch the latest public videos uploaded to LeakTok.' },
  popular: { title: 'Popular Videos | LeakTok', heading: 'Popular Videos', description: 'Discover popular and most-watched videos on LeakTok.' },
  ghana: { title: 'Trending Ghana Videos | LeakTok', heading: 'Ghana Videos', description: 'Discover trending and popular videos from Ghana on LeakTok.' },
}

const popularity = (video) => Math.log1p(video.viewCount) + 2 * Math.log1p(video.likes) + 3 * Math.log1p(video.shares) + 2 * Math.log1p(video.saves) + Number(video.completion_rate || 0) * 10
const trending = (video) => {
  const ageHours = Math.max(1, (Date.now() - new Date(video.createdAt).getTime()) / 3600000)
  return Number(video.trending_score || 0) + popularity(video) / Math.sqrt(ageHours)
}
const isGhanaVideo = (video) => {
  const text = `${video.description} ${video.title} ${(video.hashtags || []).join(' ')}`.toLowerCase()
  return /\bghana(?:ian)?\b|\baccra\b|\bkumasi\b|\btakoradi\b|\btamale\b/.test(text)
}

export default function DiscoveryPage({ type }) {
  const navigate = useNavigate()
  const config = pageConfig[type]
  const [videos, setVideos] = useState([])
  const [status, setStatus] = useState('loading')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    getVideos(1, 30, controller.signal)
      .then(({ videos: rows }) => {
        const publicRows = rows.filter((video) => video.visibility === 'public')
        const sorted = type === 'latest'
          ? publicRows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          : type === 'ghana'
            ? publicRows.filter(isGhanaVideo).sort((a, b) => trending(b) - trending(a))
            : publicRows.sort((a, b) => (type === 'popular' ? popularity(b) - popularity(a) : trending(b) - trending(a)))
        setVideos(sorted)
        setStatus('success')
      })
      .catch((error) => { if (error.name !== 'AbortError') setStatus('error') })
    return () => controller.abort()
  }, [type, retry])

  useEffect(() => applyCollectionMetadata({ ...config, path: type === 'ghana' ? '/explore/ghana' : `/${type}`, videos }), [config, type, videos])

  return (
    <main className="discovery-page">
      <header><button className="icon-button" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft /></button><Link to="/" aria-label="LeakTok home"><Logo compact /></Link></header>
      <section className="discovery-hero"><h1>{config.heading}</h1><p>{config.description}</p></section>
      <DiscoveryLinks />
      {status === 'loading' && <div className="collection-state"><span className="spinner" />Loading videos…</div>}
      {status === 'error' && <div className="collection-state"><p>Videos could not load.</p><button onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
      {status === 'success' && !videos.length && <div className="collection-state"><p>No matching public videos are available yet.</p></div>}
      {videos.length > 0 && <section className="discovery-grid" aria-label={config.heading}>{videos.slice(0, 24).map((video) => (
        <article key={video.id}>
          <Link to={`/video/${encodeURIComponent(video.id)}`}>
            <span className="collection-thumb"><img src={video.thumbnailUrl || video.poster} alt="" /><small><Play fill="currentColor" />{video.views}</small></span>
            <h2>{video.title}</h2>
          </Link>
          <p>{video.description}</p>
          {video.createdAt && <time dateTime={video.createdAt}>{new Date(video.createdAt).toLocaleDateString()}</time>}
        </article>
      ))}</section>}
      <footer><DiscoveryLinks /><Link to="/">Watch the LeakTok For You feed</Link></footer>
    </main>
  )
}
