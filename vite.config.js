import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = (env.VITE_SITE_URL || 'https://example.com').replace(/\/+$/, '')
  const siteName = env.VITE_SITE_NAME || 'LeakTok'
  const description = 'Watch trending videos and discover popular content on LeakTok.'
  const image = `${siteUrl}/images/leaktok_logo.png`

  return {
    plugins: [
      react(),
      {
        name: 'leaktok-home-seo',
        transformIndexHtml: {
          order: 'pre',
          handler(html) {
            return html
              .replace(/<title>.*?<\/title>/, `<title>${siteName} | Trending & Popular Videos</title>`)
              .replace('</head>', `    <meta name="description" content="${description}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${siteUrl}/" />
    <meta property="og:title" content="${siteName} | Trending & Popular Videos" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${siteUrl}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${siteName}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${siteName} | Trending & Popular Videos" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <script id="website-structured-data" type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: siteName, url: `${siteUrl}/`, description },
        { '@type': 'Organization', name: siteName, url: `${siteUrl}/`, logo: image },
      ],
    }).replace(/</g, '\\u003c')}</script>
  </head>`)
          },
        },
      },
    ],
  }
})
