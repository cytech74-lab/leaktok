import { useEffect, useState } from 'react'
import { Heart, Send, X } from 'lucide-react'
import { initialComments } from '../data/mockVideos'
import { addVideoComment, getVideoComments } from '../services/leaktokApi'
import { getAnalyticsIdentity } from '../services/analytics'

export default function CommentsSheet({ video, onClose, onAdded }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    let active = true
    getVideoComments(video.id)
      .then((result) => {
        if (active) setComments((result.comments || []).map((comment, index) => ({
          ...comment,
          avatar: `https://i.pravatar.cc/80?img=${20 + (index % 40)}`,
          timestamp: comment.created_at ? new Date(comment.created_at).toLocaleDateString() : '',
        })))
      })
      .catch(() => { if (active) setComments(initialComments) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [video.id])
  const submit = async (event) => {
    event.preventDefault()
    if (!text.trim()) return
    setSubmitting(true)
    try {
      const comment = await addVideoComment(video.id, getAnalyticsIdentity().visitor_id, text.trim())
      setComments((items) => [{
        ...comment,
        avatar: `https://i.pravatar.cc/80?u=${encodeURIComponent(comment.username)}`,
        timestamp: 'now',
      }, ...items])
      setText('')
      onAdded()
    } catch {
      const username = `user${Math.floor(1_000_000 + Math.random() * 9_000_000)}`
      setComments((items) => [{ id: Date.now(), username, avatar: 'https://i.pravatar.cc/80?img=20', text: text.trim(), likes: 0, timestamp: 'now' }, ...items])
      setText('')
      onAdded('Comment saved locally')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <section className="sheet comments-sheet" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Comments">
        <div className="sheet-handle" />
        <header><strong>{(video.comments + comments.length).toLocaleString()} comments</strong><button className="icon-button" onClick={onClose} aria-label="Close comments"><X /></button></header>
        <div className="comment-list">
          {loading && <p className="comments-loading">Loading comments…</p>}
          {comments.map((comment) => (
            <article className="comment" key={comment.id}>
              <img src={comment.avatar} alt="" />
              <div><strong>@{comment.username}</strong><p>{comment.text}</p><small>{comment.timestamp} · Reply</small></div>
              <button aria-label="Like comment"><Heart size={17} /><small>{comment.likes}</small></button>
            </article>
          ))}
        </div>
        <form className="comment-form" onSubmit={submit}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add comment..." aria-label="Add comment" />
          <button aria-label="Post comment" disabled={!text.trim() || submitting}><Send size={20} /></button>
        </form>
      </section>
    </div>
  )
}
