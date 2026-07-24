const fallbackUrl = 'https://example.com'

export const siteConfig = {
  name: import.meta.env.VITE_SITE_NAME || 'LeakTok',
  url: (import.meta.env.VITE_SITE_URL || fallbackUrl).replace(/\/+$/, ''),
  defaultTitle: 'LeakTok | Trending & Popular Videos',
  defaultDescription: 'Watch trending videos and discover popular content on LeakTok.',
  defaultImage: '/images/leaktok_logo.png',
}
