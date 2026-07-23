import { siteConfig } from '../config/seo'

export const slugify = (value = '') => value
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

export const canonicalUrl = (path = '/') => {
  const cleanPath = path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}`
  return `${siteConfig.url}${cleanPath}`
}

export const videoCanonicalUrl = (video) => canonicalUrl(`/video/${encodeURIComponent(video.id)}`)

export const isVideoIndexable = (video) =>
  Boolean(video && video.visibility === 'public' && video.allowIndexing === true)

export const videoSeoDescription = (video) =>
  video.description || video.caption

export const videoJsonLd = (video) => {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: videoSeoDescription(video),
    thumbnailUrl: [video.thumbnailUrl || video.poster],
    uploadDate: video.createdAt,
    contentUrl: video.videoUrl,
    embedUrl: videoCanonicalUrl(video),
  }
  if (video.durationIso) data.duration = video.durationIso
  if (Number.isFinite(video.viewCount)) {
    data.interactionStatistic = {
      '@type': 'InteractionCounter',
      interactionType: { '@type': 'WatchAction' },
      userInteractionCount: video.viewCount,
    }
  }
  return data
}

const upsertMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value))
}

const upsertCanonical = (href) => {
  let link = document.head.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = href
}

export const applyVideoMetadata = (video) => {
  if (!video) return () => {}
  const title = `${video.title} | ${siteConfig.name}`
  const description = videoSeoDescription(video)
  const url = videoCanonicalUrl(video)
  const image = video.thumbnailUrl || video.poster
  const robots = isVideoIndexable(video) ? 'index, follow' : 'noindex, nofollow'
  document.title = title
  upsertMeta('meta[name="description"]', { name: 'description', content: description })
  upsertMeta('meta[name="robots"]', { name: 'robots', content: robots })
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url })
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'video.other' })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image })
  upsertCanonical(url)
  let jsonLd = document.head.querySelector('#video-structured-data')
  if (!jsonLd) {
    jsonLd = document.createElement('script')
    jsonLd.type = 'application/ld+json'
    jsonLd.id = 'video-structured-data'
    document.head.appendChild(jsonLd)
  }
  jsonLd.textContent = JSON.stringify(videoJsonLd(video))
  return () => jsonLd?.remove()
}

export const applyHomeMetadata = () => {
  const image = canonicalUrl(siteConfig.defaultImage)
  document.title = siteConfig.defaultTitle
  upsertMeta('meta[name="description"]', { name: 'description', content: siteConfig.defaultDescription })
  upsertMeta('meta[name="robots"]', { name: 'robots', content: 'index, follow' })
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: siteConfig.defaultTitle })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: siteConfig.defaultDescription })
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl('/') })
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: siteConfig.defaultTitle })
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: siteConfig.defaultDescription })
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image })
  upsertCanonical(canonicalUrl('/'))
}
