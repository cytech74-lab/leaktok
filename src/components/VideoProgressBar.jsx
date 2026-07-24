import { useRef, useState } from 'react'

export const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remaining = total % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${minutes}:${String(remaining).padStart(2, '0')}`
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export default function VideoProgressBar({ mediaRef, duration, currentTime, buffered, paused, active, poster, onSeeked }) {
  const barRef = useRef()
  const wasPlaying = useRef(false)
  const scrubbingRef = useRef(false)
  const previewRef = useRef({ time: 0, percent: 0 })
  const [scrubbing, setScrubbing] = useState(false)
  const [preview, setPreview] = useState({ time: 0, percent: 0 })
  const seekable = active && Number.isFinite(duration) && duration > 0

  const targetFromPointer = (clientX) => {
    const rect = barRef.current.getBoundingClientRect()
    const percent = clamp((clientX - rect.left) / rect.width, 0, 1)
    return { time: percent * duration, percent }
  }
  const updateTarget = (clientX) => {
    const target = targetFromPointer(clientX)
    previewRef.current = target
    setPreview(target)
    if (mediaRef.current) mediaRef.current.currentTime = target.time
  }
  const pointerDown = (event) => {
    event.stopPropagation()
    if (!seekable) return
    event.currentTarget.setPointerCapture(event.pointerId)
    wasPlaying.current = !mediaRef.current.paused
    mediaRef.current.pause()
    scrubbingRef.current = true
    setScrubbing(true)
    updateTarget(event.clientX)
  }
  const pointerMove = (event) => {
    if (!scrubbingRef.current) return
    event.stopPropagation()
    updateTarget(event.clientX)
  }
  const finish = (event) => {
    if (!scrubbingRef.current) return
    event.stopPropagation()
    if (event.type !== 'pointercancel') updateTarget(event.clientX)
    scrubbingRef.current = false
    setScrubbing(false)
    onSeeked?.()
    if (wasPlaying.current) mediaRef.current.play().catch(() => {})
  }
  const keyboardSeek = (event) => {
    if (!seekable || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    mediaRef.current.currentTime = clamp(mediaRef.current.currentTime + direction * (event.shiftKey ? 10 : 5), 0, duration)
    onSeeked?.()
  }
  const playedPercent = duration ? clamp((scrubbing ? preview.time : currentTime) / duration * 100, 0, 100) : 0

  return (
    <div className={`video-progress ${paused ? 'paused' : ''} ${scrubbing ? 'scrubbing' : ''}`} onClick={(event) => event.stopPropagation()}>
      {scrubbing && (
        <div className="seek-preview" style={{ left: `${clamp(preview.percent * 100, 10, 90)}%` }}>
          <img src={poster || '/images/leaktok_logo.png'} alt="" />
          <strong>{formatTime(preview.time)} / {formatTime(duration)}</strong>
        </div>
      )}
      <div
        ref={barRef}
        className="progress-hitbox"
        role="slider"
        tabIndex={seekable ? 0 : -1}
        aria-label="Video progress"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration || 0)}
        aria-valuenow={Math.floor(scrubbing ? preview.time : currentTime)}
        aria-valuetext={`${formatTime(scrubbing ? preview.time : currentTime)} of ${formatTime(duration)}`}
        aria-disabled={!seekable}
        onKeyDown={keyboardSeek}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        <span className="progress-track"><i className="progress-buffered" style={{ width: `${buffered}%` }} /><i className="progress-played" style={{ width: `${playedPercent}%` }} /><b style={{ left: `${playedPercent}%` }} /></span>
      </div>
    </div>
  )
}
