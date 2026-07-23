import { Clipboard, Facebook, Send, Share2, X } from 'lucide-react'
import { getVideoLink, shareTargets } from '../utils/share'

export default function ShareSheet({ video, onClose, onCopied, onShared }) {
  const targets = shareTargets(video)
  const copy = async () => {
    try { await navigator.clipboard.writeText(getVideoLink(video.id)) }
    catch {
      const area = document.createElement('textarea')
      area.value = getVideoLink(video.id); document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove()
    }
    onShared('copy'); onCopied(); onClose()
  }
  const nativeShare = async () => {
    await navigator.share({ title: 'Watch this on LeakTok', text: 'Check out this video on LeakTok', url: getVideoLink(video.id) })
    onShared('native'); onClose()
  }
  return (
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <section className="sheet share-sheet" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Share video">
        <div className="sheet-handle" />
        <header><strong>Share this leak</strong><button className="icon-button" onClick={onClose} aria-label="Close share menu"><X /></button></header>
        <div className="share-options">
          <button onClick={copy}><span><Clipboard /></span>Copy link</button>
          <a href={targets.WhatsApp} onClick={() => onShared('whatsapp')} target="_blank" rel="noreferrer"><span className="whatsapp"><Send /></span>WhatsApp</a>
          <a href={targets.Facebook} onClick={() => onShared('facebook')} target="_blank" rel="noreferrer"><span className="facebook"><Facebook /></span>Facebook</a>
          <a href={targets.X} onClick={() => onShared('x')} target="_blank" rel="noreferrer"><span className="x-icon">𝕏</span>X</a>
          <a href={targets.Telegram} onClick={() => onShared('telegram')} target="_blank" rel="noreferrer"><span className="telegram"><Send /></span>Telegram</a>
          {navigator.share && <button onClick={nativeShare}><span><Share2 /></span>More</button>}
        </div>
        <button className="cancel-button" onClick={onClose}>Cancel</button>
      </section>
    </div>
  )
}
