import { createReadStream, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { Readable } from 'node:stream'
import app from './dist/server/server.js'

const host = process.env.HOST || '0.0.0.0'
const port = Number(process.env.PORT || 3000)
const clientRoot = join(process.cwd(), 'dist/client')

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

function safeAssetPath(pathname) {
  const normalized = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  return join(clientRoot, normalized)
}

async function serveStatic(pathname, res) {
  const filePath = safeAssetPath(pathname)
  if (!filePath.startsWith(clientRoot)) return false
  if (!existsSync(filePath)) return false

  const fileStat = await stat(filePath).catch(() => null)
  if (!fileStat || !fileStat.isFile()) return false

  const type = contentTypes[extname(filePath)] || 'application/octet-stream'
  res.writeHead(200, {
    'content-type': type,
    'content-length': fileStat.size,
    'cache-control': 'public, max-age=31536000, immutable',
  })
  createReadStream(filePath).pipe(res)
  return true
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${port}`}`)

    if (url.pathname !== '/' && (await serveStatic(url.pathname, res))) return

    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Readable.toWeb(req),
      duplex: 'half',
    })

    const response = await app.fetch(request)

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
    if (!response.body || req.method === 'HEAD') {
      res.end()
      return
    }

    Readable.fromWeb(response.body).pipe(res)
  } catch (error) {
    console.error(error)
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Internal Server Error')
  }
})

server.listen(port, host, () => {
  console.log(`xian frontend listening on http://${host}:${port}`)
})
