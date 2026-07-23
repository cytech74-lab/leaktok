import { useEffect, useRef, useState } from 'react'
import { Heart, Play, Volume2, VolumeX } from 'lucide-react'
import ActionBar from './ActionBar'
import CommentsSheet from './CommentsSheet'
import ShareSheet from './ShareSheet'
import LoadingSpinner from './LoadingSpinner'
import { useToast } from './Toast'
import { beginVideoWatch, endVideoWatch } from '../services/analytics'
import { getAnalyticsIdentity } from '../services/analytics'
import { trackVideoShare } from '../services/leaktokApi'

export default function VideoCard({ video, active, muted, setMuted, liked, saved, onLike, onSave, showTopNav = false, showBottomNav = false, controlsRef }) {
  const media = useRef()
  const clickTimer = useRef()
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [heart, setHeart] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [commentDelta, setCommentDelta] = useState(0)
  const toast = useToast()

  const play = () => {
    media.current?.play().then(() => setPaused(false)).catch(() => setPaused(true))
  }
  const togglePlay = () => {
    if (!media.current) return
    if (media.current.paused) play()
    else { media.current.pause(); setPaused(true) }
  }
  useEffect(() => {
    if (!media.current) return
    if (active && !sheet) play()
    else {
      media.current.pause()
      endVideoWatch()
    }
  }, [active, sheet])
  useEffect(() => { if (media.current) media.current.muted = muted }, [muted])
  useEffect(() => {
    if (controlsRef && active) controlsRef.current = { togglePlay, like: onLike, toggleMute: () => setMuted(!muted) }
  })
  useEffect(() => () => {
    clearTimeout(clickTimer.current)
    if (active) endVideoWatch()
  }, [active])

  const tap = (event) => {
    if (event.detail === 0) return
    clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(togglePlay, 220)
  }
  const doubleTap = (event) => {
    clearTimeout(clickTimer.current)
    const rect = event.currentTarget.getBoundingClientRect()
    setHeart({ x: event.clientX - rect.left, y: event.clientY - rect.top, key: Date.now() })
    if (!liked) onLike()
    setTimeout(() => setHeart(null), 850)
  }
  return (
    <article className="video-card">
      <div className="video-stage" onClick={tap} onDoubleClick={doubleTap}>
        <img className="video-poster" src={video.poster} alt="" />
        <video ref={media} src={video.videoUrl} poster={video.poster} loop playsInline muted={muted} preload={active ? 'auto' : 'metadata'}
          onCanPlay={() => setLoading(false)} onWaiting={() => setLoading(true)}
          onPlaying={() => { setLoading(false); setPaused(false); if (active) beginVideoWatch(video.id) }}
          onPause={endVideoWatch} onEnded={endVideoWatch} />
        <div className="video-shade" />
        {loading && <div className="loading-wrap"><LoadingSpinner /></div>}
        {paused && !loading && <div className="paused-icon"><Play fill="white" /></div>}
        {heart && <Heart key={heart.key} className="heart-burst" style={{ left: heart.x, top: heart.y }} fill="currentColor" />}
      </div>
      {showTopNav && <div className="top-nav-slot" />}
      <button className="sound-toggle" onClick={(e) => { e.stopPropagation(); setMuted(!muted) }} aria-label={muted ? 'Turn sound on' : 'Mute video'}>
        {muted ? <VolumeX /> : <Volume2 />}
      </button>
      <div className={`video-meta ${showBottomNav ? 'with-nav' : ''}`}>
        {video.createdAt && (
          <time className="video-date" dateTime={video.createdAt}>
            {new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(video.createdAt))}
          </time>
        )}
        <p className={expanded ? 'expanded' : ''}>{video.caption}</p>
        {video.caption.length > 80 && <button className="more-button" onClick={() => setExpanded(!expanded)}>{expanded ? 'less' : 'more'}</button>}
        <div className="hashtags">{video.hashtags.map((tag) => <strong key={tag}>#{tag} </strong>)}</div>
      </div>
      <ActionBar video={{ ...video, comments: video.comments + commentDelta }} liked={liked} saved={saved} onLike={onLike} onSave={onSave}
        onComments={() => setSheet('comments')} onShare={() => setSheet('share')} />
      {sheet === 'comments' && <CommentsSheet video={video} onClose={() => setSheet(null)} onAdded={() => { setCommentDelta((value) => value + 1); toast('Comment added') }} />}
      {sheet === 'share' && <ShareSheet video={video} onClose={() => setSheet(null)} onCopied={() => toast('Link copied')}
        onShared={(channel) => trackVideoShare(video.id, getAnalyticsIdentity().visitor_id, channel).catch(() => {})} />}
    </article>
  )
}
