import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { searchVideos } from '../services/leaktokApi'
import { applySearchMetadata } from '../utils/seo'

const fallbackThumbnail = '/images/leaktok_logo.png'
const descriptionScore = (video, query) => {
  const description = (video.description || '').toLowerCase()
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  let score = description.includes(query.toLowerCase()) ? 100 : 0
  score += terms.filter((term) => description.includes(term)).length * 20
  if ((video.title || '').toLowerCase().includes(query.toLowerCase())) score += 5
  return score
}

export default function SearchPage() {
  const navigate = useNavigate()
  const inputRef = useRef()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [retryKey, setRetryKey] = useState(0)
  const normalizedQuery = query.trim()

  useEffect(() => { applySearchMetadata() }, [])

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      setResults([])
      setStatus('idle')
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setStatus('loading')
      try {
        const videos = await searchVideos(normalizedQuery, controller.signal)
        setResults([...videos].sort((a, b) => descriptionScore(b, normalizedQuery) - descriptionScore(a, normalizedQuery)))
        setStatus('success')
      } catch (error) {
        if (error.name !== 'AbortError') {
          setResults([])
          setStatus('error')
        }
      }
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [normalizedQuery, retryKey])

  return (
    <main className="search-page">
      <div className="search-container">
        <header className="search-header">
          <button className="icon-button" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft /></button>
          <div className="search-input-wrap">
            <Search aria-hidden="true" />
            <input
              ref={inputRef}
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search video descriptions"
              aria-label="Search video descriptions"
            />
            {query && <button onClick={() => { setQuery(''); inputRef.current?.focus() }} aria-label="Clear search"><X /></button>}
          </div>
        </header>

        <section className="results-section" aria-live="polite">
          {normalizedQuery.length < 2 && <div className="search-prompt"><Search /><strong>Search LeakTok videos</strong><p>Type at least 2 characters to search descriptions, titles, creators and hashtags.</p></div>}
          {status === 'loading' && <div className="search-loading"><span />Searching videos…</div>}
          {status === 'error' && <div className="search-state"><p>Search could not be completed</p><button onClick={() => setRetryKey((value) => value + 1)}>Retry</button></div>}
          {status === 'success' && results.length === 0 && <div className="search-state"><p>No matching videos found</p></div>}
          {status === 'success' && results.length > 0 && (
            <>
              <h2>Matching videos</h2>
              <div className="search-results">
                {results.map((video) => (
                  <button key={video.id} className="search-result" onClick={() => navigate(`/video/${encodeURIComponent(video.id)}`)}>
                    <img src={video.thumbnailUrl || video.poster || fallbackThumbnail} onError={(event) => { event.currentTarget.src = fallbackThumbnail }} alt="" />
                    <span>
                      <strong>{video.description || video.caption}</strong>
                      <small>{video.creator_name ? `@${video.creator_name} · ` : ''}{video.views} views</small>
                      {video.hashtags.length > 0 && <em>{video.hashtags.slice(0, 3).map((tag) => `#${tag}`).join(' ')}</em>}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
