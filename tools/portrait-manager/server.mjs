import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const TOOL_DIR = path.dirname(__filename)
const PUBLIC_DIR = path.join(TOOL_DIR, 'public')
const DATA_DIR = path.join(TOOL_DIR, 'data')
const REQUEST_FILE = path.join(DATA_DIR, 'latest-generation-request.json')
const PORT = Number(process.env.PORT ?? 4178)
const MAX_BODY_BYTES = 4 * 1024 * 1024

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    ...headers,
  })
  response.end(body)
}

function sendJson(response, status, payload) {
  send(response, status, JSON.stringify(payload, null, 2), {
    'content-type': 'application/json; charset=utf-8',
  })
}

function notFound(response) {
  sendJson(response, 404, { error: 'not_found' })
}

async function readJsonBody(request) {
  const chunks = []
  let totalBytes = 0

  for await (const chunk of request) {
    totalBytes += chunk.length
    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error('request_body_too_large')
    }
    chunks.push(chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function cleanRequest(input) {
  return {
    title: String(input.title ?? '').trim(),
    prompt: String(input.prompt ?? '').trim(),
    negativePrompt: String(input.negativePrompt ?? '').trim(),
    styleProfile: input.styleProfile && typeof input.styleProfile === 'object' ? input.styleProfile : {},
    brief: input.brief && typeof input.brief === 'object' ? input.brief : {},
  }
}

async function handleApi(request, response, url) {
  if (request.method === 'POST' && url.pathname === '/api/generate') {
    const body = await readJsonBody(request)
    const requests = Array.isArray(body.requests) ? body.requests.map(cleanRequest) : []
    const validRequests = requests.filter((item) => item.prompt)
    if (!validRequests.length) {
      sendJson(response, 400, { error: 'bad_request', message: '生成するPromptがありません' })
      return
    }

    await mkdir(DATA_DIR, { recursive: true })
    const payload = {
      createdAt: new Date().toISOString(),
      count: validRequests.length,
      requests: validRequests,
    }
    await writeFile(REQUEST_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    sendJson(response, 202, { count: validRequests.length, requestPath: REQUEST_FILE })
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/latest-generation-request') {
    try {
      const file = await readFile(REQUEST_FILE, 'utf8')
      send(response, 200, file, { 'content-type': 'application/json; charset=utf-8' })
    } catch {
      sendJson(response, 200, { count: 0, requests: [] })
    }
    return
  }

  notFound(response)
}

async function serveStatic(response, url) {
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname
  const resolved = path.resolve(PUBLIC_DIR, `.${decodeURIComponent(pathname)}`)

  if (!resolved.startsWith(PUBLIC_DIR)) {
    notFound(response)
    return
  }

  try {
    const file = await readFile(resolved)
    const contentType = MIME_TYPES[path.extname(resolved).toLowerCase()] ?? 'application/octet-stream'
    send(response, 200, file, { 'content-type': contentType })
  } catch {
    notFound(response)
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `localhost:${PORT}`}`)

    if (request.method === 'OPTIONS') {
      send(response, 204, '')
      return
    }

    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url)
      return
    }

    await serveStatic(response, url)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    sendJson(response, message === 'request_body_too_large' ? 413 : 500, {
      error: 'server_error',
      message,
    })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Portrait Generator: http://127.0.0.1:${PORT}`)
  console.log(`Latest request: ${REQUEST_FILE}`)
})
