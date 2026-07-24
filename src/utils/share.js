import { canonicalUrl } from './seo'

export const getVideoLink = (id) => {
  const path = `/video/${encodeURIComponent(String(id))}`

  // Share the origin the viewer is actually using. This keeps links valid when
  // the app is deployed on a new/custom domain or VITE_SITE_URL was not set.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(path, window.location.origin).href
  }

  return canonicalUrl(path)
}

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
