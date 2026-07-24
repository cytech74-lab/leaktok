import { useEffect, useRef, useState } from 'react'
import { Heart, Play, Volume2, VolumeX } from 'lucide-react'
import ActionBar from './ActionBar'
import CommentsSheet from './CommentsSheet'
import ShareSheet from './ShareSheet'
import LoadingSpinner from './LoadingSpinner'
import VideoProgressBar from './VideoProgressBar'
import { useToast } from './Toast'
import { beginVideoWatch, endVideoWatch } from '../services/analytics'
import { getAnalyticsIdentity } from '../services/analytics'
import { trackVideoShare } from '../services/leaktokApi'

export default function VideoCard({ video, active, muted, setMuted, liked, saved, onLike, onSave, onShareRecorded, onWatch, showTopNav = false, showBottomNav = false, controlsRef }) {
  const media = useRef()
  const clickTimer = useRef()
  const holdTimer = useRef()
  const gesture = useRef(null)
  const suppressClick = useRef(false)
  const watchStats = useRef({ seconds: 0, lastTime: 0, maxTime: 0, rewatch: false })
  const durationRef = useRef(0)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [speeding, setSpeeding] = useState(false)
  const [speedSide, setSpeedSide] = useState('right')
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [heart, setHeart] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [commentDelta, setCommentDelta] = useState(0)
  const toast = useToast()

  const play = () => {
    media.current?.play().then(() => setPaused(false)).catch(() => setPaused(true))
  }
  const flushRecommendationWatch = () => {
    const stats = watchStats.current
    if (stats.seconds > .25 && durationRef.current > 0) {
      onWatch?.({
        watchSeconds: stats.seconds,
        watchPercent: Math.min(1, stats.seconds / durationRef.current),
        rewatch: stats.rewatch,
      })
    }
    watchStats.current = { seconds: 0, lastTime: media.current?.currentTime || 0, maxTime: 0, rewatch: false }
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
      flushRecommendationWatch()
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
    clearTimeout(holdTimer.current)
    if (media.current) media.current.playbackRate = 1
    flushRecommendationWatch()
    if (active) endVideoWatch()
  }, [active])

  const tap = (event) => {
    if (event.detail === 0) return
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
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
  const stopSpeed = () => {
    clearTimeout(holdTimer.current)
    if (media.current) media.current.playbackRate = 1
    if (gesture.current?.held) suppressClick.current = true
    setSpeeding(false)
    gesture.current = null
  }
  const pointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const side = event.clientX - rect.left < rect.width / 2 ? 'left' : 'right'
    gesture.current = { x: event.clientX, y: event.clientY, held: false }
    setSpeedSide(side)
    holdTimer.current = window.setTimeout(() => {
      if (!gesture.current || !media.current) return
      gesture.current.held = true
      media.current.playbackRate = 2
      setSpeeding(true)
    }, 350)
  }
  const pointerMove = (event) => {
    if (!gesture.current || gesture.current.held) return
    const distance = Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y)
    if (distance > 12) {
      clearTimeout(holdTimer.current)
      gesture.current = null
    }
  }
  const updateBuffered = () => {
    const video = media.current
    if (!video || !video.buffered.length || !Number.isFinite(video.duration) || video.duration <= 0) return setBuffered(0)
    setBuffered(Math.min(100, video.buffered.end(video.buffered.length - 1) / video.duration * 100))
  }
  const updateWatchProgress = (event) => {
    const time = event.currentTarget.currentTime
    const stats = watchStats.current
    const delta = time - stats.lastTime
    if (delta > 0 && delta < 2.5 && !event.currentTarget.paused) stats.seconds += delta
    stats.lastTime = time
    stats.maxTime = Math.max(stats.maxTime, time)
    setCurrentTime(time)
  }
  return (
    <article className="video-card">
      <div className="video-stage" onClick={tap} onDoubleClick={doubleTap}
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={stopSpeed}
        onPointerCancel={stopSpeed} onPointerLeave={stopSpeed}>
        <img className="video-poster" src={video.poster} alt="" />
        <video ref={media} src={video.videoUrl} poster={video.poster} loop playsInline muted={muted} preload={active ? 'auto' : 'metadata'}
          onLoadedMetadata={(event) => {
            durationRef.current = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0
            setDuration(durationRef.current)
          }}
          onDurationChange={(event) => {
            durationRef.current = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0
            setDuration(durationRef.current)
          }}
          onTimeUpdate={updateWatchProgress}
          onProgress={updateBuffered}
          onSeeking={(event) => {
            if (event.currentTarget.currentTime < watchStats.current.lastTime - 5) watchStats.current.rewatch = true
            watchStats.current.lastTime = event.currentTarget.currentTime
            endVideoWatch()
          }}
          onSeeked={(event) => {
            setCurrentTime(event.currentTarget.currentTime)
            if (active && !event.currentTarget.paused) beginVideoWatch(video.id)
          }}
          onCanPlay={() => setLoading(false)} onWaiting={() => setLoading(true)}
          onPlaying={() => { setLoading(false); setPaused(false); if (active) beginVideoWatch(video.id) }}
          onPause={endVideoWatch} onEnded={endVideoWatch} />
        <div className="video-shade" />
        {loading && <div className="loading-wrap"><LoadingSpinner /></div>}
        {paused && !loading && <div className="paused-icon"><Play fill="white" /></div>}
        {speeding && <div className={`speed-indicator ${speedSide}`}>2× Speed</div>}
        {heart && <Heart key={heart.key} className="heart-burst" style={{ left: heart.x, top: heart.y }} fill="currentColor" />}
        <VideoProgressBar mediaRef={media} duration={duration} currentTime={currentTime} buffered={buffered}
          paused={paused} active={active} poster={video.thumbnailUrl || video.poster} onSeeked={() => setCurrentTime(media.current?.currentTime || 0)} />
      </div>
      {showTopNav && <div className="top-nav-slot" />}
      <button className="sound-toggle" onClick={(e) => { e.stopPropagation(); setMuted(!muted) }} aria-label={muted ? 'Turn sound on' : 'Mute video'}>
        {muted ? <VolumeX /> : <Volume2 />}
      </button>
      <div className={`video-meta ${showBottomNav ? 'with-nav' : ''}`}>
        <h1 className="video-title">{video.title}</h1>
        {video.creator_name && <span className="video-creator">@{video.creator_name}</span>}
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
        onShared={(channel) => {
          onShareRecorded?.()
          trackVideoShare(video.id, getAnalyticsIdentity().visitor_id, channel).catch(() => {})
        }} />}
    </article>
  )
}
