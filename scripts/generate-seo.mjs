import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { videos } from '../src/data/mockVideos.js'
import { meaningfulVideoTitle } from '../src/utils/title.js'

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
  title: meaningfulVideoTitle(video.title, video.description),
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
const navigation = `<nav aria-label="Discover videos">
  <a href="${siteUrl}/trending">Trending Videos</a>
  <a href="${siteUrl}/latest">Latest Videos</a>
  <a href="${siteUrl}/popular">Popular Videos</a>
  <a href="${siteUrl}/explore/ghana">Ghana Videos</a>
</nav>`
const popularityScore = (video) => Math.log1p(Number(video.viewCount || 0)) + 2 * Math.log1p(Number(video.likes || 0)) + 3 * Math.log1p(Number(video.shares || 0)) + 2 * Math.log1p(Number(video.saves || 0)) + Number(video.completion_rate || 0) * 10
const trendingScore = (video) => {
  const ageHours = Math.max(1, (Date.now() - new Date(video.createdAt).getTime()) / 3600000)
  return Number(video.trending_score || 0) + popularityScore(video) / Math.sqrt(ageHours)
}
const isGhanaVideo = (video) => /\bghana(?:ian)?\b|\baccra\b|\bkumasi\b|\btakoradi\b|\btamale\b/.test(`${video.description} ${video.title} ${(video.hashtags || []).join(' ')}`.toLowerCase())

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
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: siteName, item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Trending Videos', item: `${siteUrl}/trending` },
      { '@type': 'ListItem', position: 3, name: video.title, item: canonical },
    ],
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
    <script id="breadcrumb-structured-data" type="application/ld+json">${JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c')}</script>
  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${navigation}<article><h1>${escapeHtml(video.title)}</h1>${video.creator_name ? `<p>By ${escapeHtml(video.creator_name)}</p>` : ''}<p>${escapeHtml(description)}</p><p>${video.hashtags.map((tag) => `#${escapeHtml(tag)}`).join(' ')}</p><time datetime="${escapeHtml(video.createdAt)}">${escapeHtml(video.createdAt.slice(0, 10))}</time></article></div>`)
  const target = resolve(dist, 'video', video.id)
  await mkdir(target, { recursive: true })
  await writeFile(resolve(target, 'index.html'), html)
  // The flat copy supports static hosts that map extensionless URLs to .html files.
  await writeFile(resolve(dist, 'video', `${video.id}.html`), html)
}

const collectionDefinitions = [
  { path: '/trending', title: 'Trending Videos | LeakTok', heading: 'Trending Videos', description: 'Watch trending and popular videos currently gaining attention on LeakTok.', videos: [...indexableVideos].sort((a, b) => trendingScore(b) - trendingScore(a)) },
  { path: '/latest', title: 'Latest Videos | LeakTok', heading: 'Latest Videos', description: 'Watch the latest public videos uploaded to LeakTok.', videos: [...indexableVideos].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) },
  { path: '/popular', title: 'Popular Videos | LeakTok', heading: 'Popular Videos', description: 'Discover popular and most-watched videos on LeakTok.', videos: [...indexableVideos].sort((a, b) => popularityScore(b) - popularityScore(a)) },
  { path: '/explore/ghana', title: 'Trending Ghana Videos | LeakTok', heading: 'Ghana Videos', description: 'Discover trending and popular videos from Ghana on LeakTok.', videos: [...indexableVideos].filter(isGhanaVideo).sort((a, b) => trendingScore(b) - trendingScore(a)) },
]
const indexableCollections = collectionDefinitions.filter((collection) => collection.videos.length)

for (const collection of collectionDefinitions) {
  const canonical = `${siteUrl}${collection.path}`
  const robots = collection.videos.length ? 'index, follow' : 'noindex, follow'
  const image = absoluteUrl(collection.videos[0]?.thumbnailUrl || collection.videos[0]?.poster || '/images/leaktok_logo.png')
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: collection.heading,
    itemListElement: collection.videos.slice(0, 24).map((video, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: video.title,
      url: `${siteUrl}/video/${encodeURIComponent(video.id)}`,
    })),
  }
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: siteName, item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: collection.heading, item: canonical },
    ],
  }
  const cards = collection.videos.slice(0, 24).map((video) => `<article>
    <a href="${siteUrl}/video/${encodeURIComponent(video.id)}"><img src="${escapeHtml(absoluteUrl(video.thumbnailUrl || video.poster))}" alt=""><h2>${escapeHtml(video.title)}</h2></a>
    <p>${escapeHtml(video.description || video.caption)}</p>
  </article>`).join('')
  let html = replaceMeta(baseHtml, 'title', collection.title)
  html = replaceMeta(html, 'name="description"', collection.description)
  html = replaceMeta(html, 'name="robots"', robots)
  html = replaceMeta(html, 'property="og:title"', collection.title)
  html = replaceMeta(html, 'property="og:description"', collection.description)
  html = replaceMeta(html, 'property="og:image"', image)
  html = replaceMeta(html, 'property="og:url"', canonical)
  html = replaceMeta(html, 'property="og:type"', 'website')
  html = replaceMeta(html, 'name="twitter:title"', collection.title)
  html = replaceMeta(html, 'name="twitter:description"', collection.description)
  html = replaceMeta(html, 'name="twitter:image"', image)
  const collectionStructuredData = collection.videos.length
    ? `    <script id="collection-structured-data" type="application/ld+json">${JSON.stringify(itemList).replace(/</g, '\\u003c')}</script>\n`
    : ''
  html = html
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${escapeHtml(canonical)}" />`)
    .replace('</head>', `${collectionStructuredData}    <script id="breadcrumb-structured-data" type="application/ld+json">${JSON.stringify(breadcrumb).replace(/</g, '\\u003c')}</script>
  </head>`)
    .replace('<div id="root"></div>', `<div id="root"><header><a href="${siteUrl}/">${siteName}</a></header><main>${navigation}<h1>${collection.heading}</h1><p>${collection.description}</p>${cards || '<p>No matching public videos are available yet.</p>'}</main><footer>${navigation}</footer></div>`)
  const target = resolve(dist, collection.path.replace(/^\//, ''))
  await mkdir(target, { recursive: true })
  await writeFile(resolve(target, 'index.html'), html)
}

const promotedVideos = collectionDefinitions[0].videos.slice(0, 8)
const homeContent = `<div id="root"><main><h1>${siteName}</h1>${navigation}<section><h2>Trending Now</h2>${promotedVideos.map((video) => `<article><a href="${siteUrl}/video/${encodeURIComponent(video.id)}">${escapeHtml(video.title)}</a><p>${escapeHtml(video.description || video.caption)}</p></article>`).join('')}</section></main><footer>${navigation}</footer></div>`
const enhancedHome = baseHtml
  .replace('<div id="root"></div>', homeContent)
await writeFile(resolve(dist, 'index.html'), enhancedHome)

let searchHtml = replaceMeta(baseHtml, 'title', `Search Videos | ${siteName}`)
searchHtml = replaceMeta(searchHtml, 'name="description"', `Search public videos on ${siteName}.`)
searchHtml = replaceMeta(searchHtml, 'name="robots"', 'noindex, follow')
searchHtml = searchHtml
  .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${siteUrl}/search" />`)
  .replace('<div id="root"></div>', `<div id="root"><main><h1>Search Videos</h1>${navigation}</main></div>`)
await mkdir(resolve(dist, 'search'), { recursive: true })
await writeFile(resolve(dist, 'search', 'index.html'), searchHtml)

const sitemapUrls = [
  { loc: `${siteUrl}/` },
  ...indexableCollections.map((collection) => ({ loc: `${siteUrl}${collection.path}` })),
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
