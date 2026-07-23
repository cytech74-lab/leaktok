import { canonicalUrl } from './seo'

export const getVideoLink = (id) => canonicalUrl(`/video/${id}`)

export const shareTargets = (video) => {
  const link = encodeURIComponent(getVideoLink(video.id))
  const text = encodeURIComponent('Check out this video on LeakTok')
  return {
    WhatsApp: `https://wa.me/?text=${text}%20${link}`,
    Facebook: `https://www.facebook.com/sharer/sharer.php?u=${link}`,
    X: `https://twitter.com/intent/tweet?text=${text}&url=${link}`,
    Telegram: `https://t.me/share/url?url=${link}&text=${text}`,
  }
}
