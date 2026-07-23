const fallbackUrl = 'https://example.com'

export const siteConfig = {
  name: import.meta.env.VITE_SITE_NAME || 'LeakTok',
  url: (import.meta.env.VITE_SITE_URL || fallbackUrl).replace(/\/+$/, ''),
  defaultTitle: 'LeakTok | Discover Trending Videos',
  defaultDescription: 'Discover and watch trending videos and viral moments on LeakTok.',
  defaultImage: '/images/leaktok_logo.png',
}
