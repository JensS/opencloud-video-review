const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 3456
const DATA_DIR = process.env.DATA_DIR || '/data'

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const server = http.createServer((req, res) => {
  // CORS — allow any origin (review links can be opened from anywhere)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  // Health check
  if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json')
    res.end('{"status":"ok"}')
    return
  }

  // Route: /reviews/{reviewId}
  const match = req.url.match(/^\/reviews\/([a-zA-Z0-9_-]{8,64})$/)
  if (!match) {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  const reviewId = match[1]
  const file = path.join(DATA_DIR, `${reviewId}.json`)

  if (req.method === 'GET') {
    try {
      const data = fs.readFileSync(file, 'utf8')
      res.setHeader('Content-Type', 'application/json')
      res.end(data)
    } catch {
      // No review data yet — return empty state
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ comments: [], approval: 'pending' }))
    }
  } else if (req.method === 'PUT') {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      // Limit body size to 1MB
      if (body.length > 1_000_000) {
        res.writeHead(413)
        res.end('Payload too large')
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body)
        // Validate structure
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
