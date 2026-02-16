const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 3456
const DATA_DIR = process.env.DATA_DIR || '/data'
const OC_URL = process.env.OC_URL || '' // e.g. https://cloud.jenssage.com

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

// Load the standalone review page HTML
const viewHtml = fs.readFileSync(path.join(__dirname, 'view.html'), 'utf8')

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url, `http://${req.headers.host}`)

  // Health check
  if (url.pathname === '/health') {
    res.setHeader('Content-Type', 'application/json')
    res.end('{"status":"ok"}')
    return
  }

  // Standalone review page: /view/{reviewId}
  const viewMatch = url.pathname.match(/^\/view\/([a-zA-Z0-9_-]{8,128})$/)
  if (viewMatch && req.method === 'GET') {
    const reviewId = viewMatch[1]
    const shareToken = url.searchParams.get('share') || ''
    const fileName = url.searchParams.get('name') || 'Video'

    // Inject config into HTML
    const html = viewHtml
      .replace('__REVIEW_ID__', reviewId)
      .replace('__SHARE_TOKEN__', shareToken)
      .replace('__FILE_NAME__', fileName.replace(/'/g, "\\'"))
      .replace('__OC_URL__', OC_URL)
      .replace('__API_BASE__', `${url.protocol}//${url.host}`)

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(html)
    return
  }

  // API: /reviews/{reviewId}
  const apiMatch = url.pathname.match(/^\/reviews\/([a-zA-Z0-9_-]{8,128})$/)
  if (!apiMatch) {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  const reviewId = apiMatch[1]
  const file = path.join(DATA_DIR, `${reviewId}.json`)

  if (req.method === 'GET') {
    try {
      const data = fs.readFileSync(file, 'utf8')
      res.setHeader('Content-Type', 'application/json')
      res.end(data)
    } catch {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ comments: [], approval: 'pending' }))
    }
  } else if (req.method === 'PUT') {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 2_000_000) {
        res.writeHead(413)
        res.end('Payload too large')
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body)
        if (!Array.isArray(parsed.comments)) throw new Error('Invalid format')
        fs.writeFileSync(file, JSON.stringify(parsed, null, 2))
        res.setHeader('Content-Type', 'application/json')
        res.end('{"ok":true}')
      } catch (e) {
        res.writeHead(400)
        res.end(`Invalid JSON: ${e.message}`)
      }
    })
  } else {
    res.writeHead(405)
    res.end('Method not allowed')
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Review API listening on :${PORT}`)
})
