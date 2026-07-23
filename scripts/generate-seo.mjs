import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { videos } from '../src/data/mockVideos.js'

const root = resolve(import.meta.dirname, '..')

async function readEnvironment() {
  const values = { ...process.env }
  for (const filename of ['.env', '.env.production']) {
    const path = resolve(root, filename)
    if (!existsSync(path)) continue
    const contents = await readFile(path, 'utf8')
    contents.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*?)\s*$/)
      if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    })
  }
  return values
}

const env = await readEnvironment()
const rawSiteUrl = env.VITE_SITE_URL || 'https://example.com'
let siteUrl
try {
  const parsed = new URL(rawSiteUrl)
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
  siteUrl = parsed.origin + parsed.pathname.replace(/\/+$/, '')
} catch {
  throw new Error('VITE_SITE_URL must be a valid absolute HTTP(S) URL.')
}

const siteName = env.VITE_SITE_NAME || 'LeakTok'
const dist = resolve(root, 'dist')
const baseHtml = await readFile(resolve(dist, 'index.html'), 'utf8')

const normalizeApiVideo = (video) => ({
  ...video,
  id: String(video.id || video._id),
  title: video.title || String(video.description || '').slice(0, 80) || 'LeakTok video',
  description: video.description || '',
  caption: video.description || '',
  videoUrl: video.video_url,
  poster: video.thumbnail_url || `${siteUrl}/images/leaktok_logo.png`,
  thumbnailUrl: video.thumbnail_url || `${siteUrl}/images/leaktok_logo.png`,
  createdAt: video.published_at || video.created_at,
  updatedAt: video.updated_at,
  viewCount: Number(video.views || 0),
  hashtags: Array.isArray(video.hashtags) ? video.hashtags : [],
  visibility: video.visibility || 'public',
  allowIndexing: video.allow_indexing !== false,
})

async function loadSeoVideos() {
  const apiUrl = (env.LEAKTOK_SEO_API_URL || env.VITE_LEAKTOK_API_URL || '').replace(/\/+$/, '')
  if (!apiUrl) return videos
  try {
    const collected = []
    let page = 1
    let hasMore = true
    while (hasMore && page <= 1000) {
      const response = await fetch(`${apiUrl}/videos?page=${page}&limit=30`, { signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json()
      const rows = payload.videos || payload.data?.videos || []
      collected.push(...rows.map(normalizeApiVideo))
      hasMore = Boolean(payload.pagination?.has_more || payload.data?.pagination?.has_more)
      page += 1
    }
    if (collected.length) {
      console.log(`SEO: loaded ${collected.length} videos from ${apiUrl}`)
      return collected
    }
    console.warn('SEO: backend returned no public videos; using local fallback data.')
  } catch (error) {
    console.warn(`SEO: backend unavailable (${error.message}); using local fallback data.`)
  }
  return videos
}

const seoVideos = await loadSeoVideos()
const indexableVideos = seoVideos.filter((video) => video.visibility === 'public' && video.allowIndexing === true)
const escapeHtml = (value = '') => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const escapeXml = escapeHtml
const absoluteUrl = (value) => new URL(value, `${siteUrl}/`).href
const replaceMeta = (html, selector, value) => {
  const escaped = escapeHtml(value)
  const pattern = selector === 'title'
    ? /<title>.*?<\/title>/
    : new RegExp(`<meta ([^>]*?${selector}[^>]*?)content="[^"]*"([^>]*)>`)
  return selector === 'title'
    ? html.replace(pattern, `<title>${escaped}</title>`)
    : html.replace(pattern, `<meta $1content="${escaped}"$2>`)
}

for (const video of indexableVideos) {
  const canonical = `${siteUrl}/video/${encodeURIComponent(video.id)}`
  const title = `${video.title} | ${siteName}`
  const description = video.description || video.caption
  const thumbnail = absoluteUrl(video.thumbnailUrl || video.poster)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description,
    thumbnailUrl: [thumbnail],
    uploadDate: video.createdAt,
    contentUrl: video.videoUrl,
    embedUrl: canonical,
    ...(video.durationIso ? { duration: video.durationIso } : {}),
    ...(Number.isFinite(video.viewCount) ? {
      interactionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: { '@type': 'WatchAction' },
        userInteractionCount: video.viewCount,
      },
    } : {}),
  }
  let html = replaceMeta(baseHtml, 'title', title)
  html = replaceMeta(html, 'name="description"', description)
  html = replaceMeta(html, 'name="robots"', 'index, follow')
  html = replaceMeta(html, 'property="og:title"', title)
  html = replaceMeta(html, 'property="og:description"', description)
  html = replaceMeta(html, 'property="og:image"', thumbnail)
  html = replaceMeta(html, 'property="og:url"', canonical)
  html = replaceMeta(html, 'property="og:type"', 'video.other')
  html = replaceMeta(html, 'name="twitter:title"', title)
  html = replaceMeta(html, 'name="twitter:description"', description)
  html = replaceMeta(html, 'name="twitter:image"', thumbnail)
  html = html
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${escapeHtml(canonical)}" />`)
    .replace('</head>', `    <meta property="og:video" content="${escapeHtml(video.videoUrl)}" />
    <script id="video-structured-data" type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
  </head>`)
    .replace('<div id="root"></div>', `<div id="root"><article><h1>${escapeHtml(video.title)}</h1><p>${escapeHtml(description)}</p><p>${video.hashtags.map((tag) => `#${escapeHtml(tag)}`).join(' ')}</p><time datetime="${escapeHtml(video.createdAt)}">${escapeHtml(video.createdAt.slice(0, 10))}</time></article></div>`)
  const target = resolve(dist, 'video', video.id)
  await mkdir(target, { recursive: true })
  await writeFile(resolve(target, 'index.html'), html)
  // The flat copy supports static hosts that map extensionless URLs to .html files.
  await writeFile(resolve(dist, 'video', `${video.id}.html`), html)
}

const sitemapUrls = [
  { loc: `${siteUrl}/` },
  ...indexableVideos.map((video) => ({ loc: `${siteUrl}/video/${encodeURIComponent(video.id)}`, lastmod: video.updatedAt || video.createdAt })),
]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(({ loc, lastmod }) => `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${escapeXml(lastmod.slice(0, 10))}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>
`
await writeFile(resolve(dist, 'sitemap.xml'), sitemap)

const videoSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${indexableVideos.map((video) => `  <url>
    <loc>${escapeXml(`${siteUrl}/video/${encodeURIComponent(video.id)}`)}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(absoluteUrl(video.thumbnailUrl || video.poster))}</video:thumbnail_loc>
      <video:title>${escapeXml(video.title)}</video:title>
      <video:description>${escapeXml(video.description || video.caption)}</video:description>
      <video:content_loc>${escapeXml(video.videoUrl)}</video:content_loc>
      <video:publication_date>${escapeXml(video.createdAt)}</video:publication_date>
    </video:video>
  </url>`).join('\n')}
</urlset>
`
await mkdir(resolve(dist, 'sitemaps'), { recursive: true })
await writeFile(resolve(dist, 'sitemaps', 'videos-1.xml'), videoSitemap)

const robots = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /settings/
Disallow: /account/
Disallow: /api/

Sitemap: ${siteUrl}/sitemap.xml
Sitemap: ${siteUrl}/sitemaps/videos-1.xml
`
await writeFile(resolve(dist, 'robots.txt'), robots)
console.log(`SEO: prerendered ${indexableVideos.length} public videos for ${siteUrl}`)
