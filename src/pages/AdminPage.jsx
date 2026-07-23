import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3, Clock3, Eye, Film, Gauge, LayoutDashboard, LogOut, Menu, Pencil,
  Play, Plus, RefreshCw, Save, Trash2, Upload, UserRound, Users, Wifi, X,
} from 'lucide-react'
import Logo from '../components/Logo'
import {
  adminLogin, adminLogout, createAdminVideo, deleteAdminVideo, getAdmin, getAdminToken,
  getAdminVideos, getDashboard, updateAdminVideo,
} from '../services/adminApi'
import '../styles/admin.css'

const emptyForm = {
  id: '', video_url: '', description: '', title: '', thumbnail_url: '',
  hashtags: '', creator_name: '', status: 'published', scheduled_at: '',
}

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value || 0))
const formatDate = (value) => value ? new Date(value).toLocaleString() : '—'
const formatTime = (seconds) => {
  const value = Math.round(Number(seconds || 0))
  if (value < 60) return `${value}s`
  if (value < 3600) return `${Math.floor(value / 60)}m ${value % 60}s`
  return `${Math.floor(value / 3600)}h ${Math.floor((value % 3600) / 60)}m`
}

function LoginView({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true); setError('')
    try { onLogin(await adminLogin(username, password)) }
    catch (nextError) { setError(nextError.message) }
    finally { setSubmitting(false) }
  }
  return (
    <main className="admin-login">
      <form onSubmit={submit}>
        <Logo />
        <div><h1>Admin access</h1><p>Sign in to manage LeakTok videos and analytics.</p></div>
        {error && <div className="admin-alert">{error}</div>}
        <label>Username<input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
        <small>Authorized administrators only</small>
      </form>
    </main>
  )
}

export default function AdminPage() {
  const [admin, setAdmin] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [view, setView] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [videos, setVideos] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const notify = (next) => { setMessage(next); setTimeout(() => setMessage(''), 2300) }
  const loadDashboard = async () => {
    try { setDashboard(await getDashboard()) } catch (error) { if (error.status === 401) setAdmin(null); else notify(error.message) }
  }
  const loadVideos = async () => {
    try { setVideos(await getAdminVideos()) } catch (error) { if (error.status === 401) setAdmin(null); else notify(error.message) }
  }
  useEffect(() => {
    document.title = 'LeakTok Admin'
    let robots = document.head.querySelector('meta[name="robots"]')
    if (!robots) {
      robots = document.createElement('meta')
      robots.name = 'robots'
      document.head.appendChild(robots)
    }
    robots.content = 'noindex, nofollow'
    if (!getAdminToken()) { setAuthReady(true); return }
    getAdmin().then(setAdmin).catch(() => setAdmin(null)).finally(() => setAuthReady(true))
  }, [])
  useEffect(() => {
    if (!admin) return
    loadDashboard(); loadVideos()
  }, [admin])

  const changeView = (next) => {
    setView(next); setMenuOpen(false)
    if (next === 'dashboard' || next === 'analytics') loadDashboard()
    if (next === 'videos') loadVideos()
  }
  const edit = (video) => {
    setForm({
      id: video.id,
      video_url: video.video_url || '',
      description: video.description || '',
      title: video.title || '',
      thumbnail_url: video.thumbnail_url || '',
      hashtags: (video.hashtags || []).join(', '),
      creator_name: video.creator_name || '',
      status: video.status || 'published',
      scheduled_at: video.scheduled_at ? video.scheduled_at.slice(0, 16) : '',
    })
    changeView('upload')
  }
  const saveVideo = async (event) => {
    event.preventDefault()
    if (form.status === 'scheduled' && !form.scheduled_at) { notify('Choose a schedule date and time'); return }
    setBusy(true)
    const payload = {
      ...form,
      scheduled_at: form.status === 'scheduled' ? new Date(form.scheduled_at).toISOString() : null,
    }
    try {
      if (form.id) await updateAdminVideo(form.id, payload)
      else await createAdminVideo(payload)
      notify(form.id ? 'Video updated' : 'Video published')
      setForm(emptyForm); await loadVideos(); changeView('videos')
    } catch (error) { notify(error.message) }
    finally { setBusy(false) }
  }
  const remove = async (video) => {
    if (!window.confirm('Are you sure you want to delete this video?')) return
    try { await deleteAdminVideo(video.id); setVideos((items) => items.filter((item) => item.id !== video.id)); notify('Video deleted') }
    catch (error) { notify(error.message) }
  }
  const logout = async () => { await adminLogout(); setAdmin(null) }

  const metrics = useMemo(() => dashboard ? [
    ['Total videos', dashboard.total_videos, Film, formatNumber],
    ['Total visits', dashboard.total_visits, Gauge, formatNumber],
    ['Unique visitors', dashboard.unique_visitors, Users, formatNumber],
    ['Online now', dashboard.online_now, Wifi, formatNumber],
    ['Video views', dashboard.total_video_views, Eye, formatNumber],
    ['Watch time', dashboard.total_watch_seconds, Clock3, formatTime],
    ['Average watch', dashboard.average_watch_seconds, Play, formatTime],
    ["Today's visits", dashboard.today_visits, UserRound, formatNumber],
    ["Today's views", dashboard.today_video_views, BarChart3, formatNumber],
  ] : [], [dashboard])

  if (!authReady) return <main className="admin-loading"><Logo /><span /></main>
  if (!admin) return <LoginView onLogin={setAdmin} />

  const nav = [
    ['dashboard', 'Dashboard', LayoutDashboard],
    ['upload', 'Upload Video', Upload],
    ['videos', 'Videos', Film],
    ['analytics', 'Analytics', BarChart3],
  ]
  const maxTrend = Math.max(1, ...(dashboard?.last_7_days || []).flatMap((day) => [day.visits, day.video_views]))
  return (
    <main className="admin-app">
      <aside className={menuOpen ? 'open' : ''}>
        <div className="admin-brand"><Logo /><button onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></button></div>
        <nav>{nav.map(([id, label, Icon]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => changeView(id)}><Icon />{label}</button>)}</nav>
        <button className="admin-logout" onClick={logout}><LogOut />Logout</button>
      </aside>
      {menuOpen && <button className="admin-scrim" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
      <section className="admin-main">
        <header>
          <button className="menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button>
          <div><h1>{nav.find(([id]) => id === view)?.[1]}</h1><p>Welcome, {admin.username}</p></div>
          <span><i /> Live</span>
        </header>

        {(view === 'dashboard' || view === 'analytics') && (
          <>
            <div className="admin-metrics">{metrics.map(([label, value, Icon, formatter]) => <article key={label}><Icon /><small>{label}</small><strong>{formatter(value)}</strong></article>)}</div>
            {view === 'dashboard' && <section className="admin-panel">
              <div className="panel-title"><div><h2>Last 7 days</h2><p>Visits and qualified views</p></div><button onClick={loadDashboard}><RefreshCw />Refresh</button></div>
              <div className="admin-chart">{(dashboard?.last_7_days || []).map((day) => <div key={day.date} title={`${day.visits} visits, ${day.video_views} views`}><i className="visit" style={{ height: `${day.visits / maxTrend * 100}%` }} /><i className="view" style={{ height: `${day.video_views / maxTrend * 100}%` }} /><small>{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</small></div>)}</div>
            </section>}
            {view === 'analytics' && <section className="admin-panel admin-copy"><h2>How analytics work</h2><p>Online visitors have sent a heartbeat within two minutes. A view counts once per video and session after two seconds of active playback. Watch time is batched when playback pauses, the viewer scrolls away, or the tab becomes hidden.</p></section>}
          </>
        )}

        {view === 'upload' && <section className="admin-panel admin-form">
          <div className="panel-title"><div><h2>{form.id ? 'Edit video' : 'Publish a video'}</h2><p>Use an externally hosted browser-playable URL.</p></div></div>
          <form onSubmit={saveVideo}>
            <label>Video URL *<input type="url" required value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://cdn.example.com/video.mp4" /></label>
            <div className="admin-preview">{form.video_url ? <video src={form.video_url} controls playsInline /> : <span>Paste a video URL to preview it</span>}</div>
            <label>Description *<textarea required maxLength="5000" rows="5" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="admin-form-grid">
              <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
              <label>Thumbnail URL<input type="url" value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} /></label>
              <label>Hashtags<input value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} placeholder="ghana, dance, trending" /></label>
              <label>Creator name<input value={form.creator_name} onChange={(e) => setForm({ ...form, creator_name: e.target.value })} /></label>
            </div>
            <fieldset><legend>Publishing</legend>{['published', 'scheduled', 'draft'].map((status) => <label key={status}><input type="radio" name="status" checked={form.status === status} onChange={() => setForm({ ...form, status })} />{status === 'published' ? 'Publish now' : status[0].toUpperCase() + status.slice(1)}</label>)}</fieldset>
            {form.status === 'scheduled' && <label>Publish date and time<input type="datetime-local" required value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></label>}
            <div className="admin-actions">{form.id && <button type="button" onClick={() => setForm(emptyForm)}>Cancel edit</button>}<button className="primary" disabled={busy}><Save />{busy ? 'Saving…' : 'Save video'}</button></div>
          </form>
        </section>}

        {view === 'videos' && <section className="admin-panel">
          <div className="panel-title"><div><h2>All videos</h2><p>Published, scheduled and draft content</p></div><button className="primary" onClick={() => { setForm(emptyForm); changeView('upload') }}><Plus />Add video</button></div>
          <div className="admin-table"><table><thead><tr><th>Video</th><th>Status</th><th>Published</th><th>Views</th><th>Watch time</th><th>Actions</th></tr></thead><tbody>
            {videos.map((video) => <tr key={video.id}><td><div className="admin-video-cell"><img src={video.thumbnail_url || '/images/leaktok_logo.png'} alt="" /><div><strong>{video.title || 'Untitled'}</strong><span>{video.description}</span></div></div></td><td><span className={`admin-badge ${video.status}`}>{video.status}</span></td><td>{formatDate(video.published_at || video.scheduled_at)}</td><td>{formatNumber(video.views)}</td><td>{formatTime(video.total_watch_seconds)}</td><td><div className="table-actions"><button onClick={() => window.open(video.video_url, '_blank', 'noopener')} aria-label="Preview video"><Play /></button><button onClick={() => edit(video)} aria-label="Edit video"><Pencil /></button><button className="danger" onClick={() => remove(video)} aria-label="Delete video"><Trash2 /></button></div></td></tr>)}
          </tbody></table>{!videos.length && <div className="admin-empty">No videos have been added yet.</div>}</div>
        </section>}
      </section>
      {message && <div className="admin-toast">{message}</div>}
    </main>
  )
}
