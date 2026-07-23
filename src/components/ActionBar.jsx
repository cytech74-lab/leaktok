import { Bookmark, Heart, MessageCircle, Share2 } from 'lucide-react'

const compact = (value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}K` : value

export default function ActionBar({ video, liked, saved, onLike, onSave, onComments, onShare }) {
  return (
    <aside className="action-bar">
      <button className={liked ? 'liked' : ''} onClick={onLike} aria-label="Like video"><Heart fill={liked ? 'currentColor' : 'none'} /><span>{compact(video.likes + (liked ? 1 : 0))}</span></button>
      <button onClick={onComments} aria-label="Open comments"><MessageCircle fill="rgba(255,255,255,.08)" /><span>{compact(video.comments)}</span></button>
      <button className={saved ? 'saved' : ''} onClick={onSave} aria-label="Save video"><Bookmark fill={saved ? 'currentColor' : 'none'} /><span>{compact(video.saves + (saved ? 1 : 0))}</span></button>
      <button onClick={onShare} aria-label="Share video"><Share2 /><span>{compact(video.shares)}</span></button>
    </aside>
  )
}
