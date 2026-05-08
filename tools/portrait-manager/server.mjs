import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const TOOL_DIR = path.dirname(__filename)
const PUBLIC_DIR = path.join(TOOL_DIR, 'public')
const DATA_DIR = path.join(TOOL_DIR, 'data')
const REQUEST_FILE = path.join(DATA_DIR, 'latest-generation-request.json')
const IMAGE_THREAD_FILE = path.join(DATA_DIR, 'image-thread.json')
const JOB_FILE = path.join(DATA_DIR, 'app-server-job.json')
const PORT = Number(process.env.PORT ?? 4178)
const MAX_BODY_BYTES = 4 * 1024 * 1024
const CODEX_CMD = process.env.CODEX_CMD || 'C:\\home\\adatc\\.npm-global\\codex.cmd'
const IMAGE_THREAD_NAME = '顔グラ量産'
const TURN_TIMEOUT_MS = 12 * 60 * 1000

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

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

async function writeJsonFile(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function createRpcId(prefix) {
  return `${prefix}-${randomBytes(8).toString('hex')}`
}

function threadIdFromResponse(response) {
  return response?.thread?.id || response?.thread?.threadId || response?.thread_id || ''
}

function turnIdFromResponse(response) {
  return response?.turn?.id || response?.turn?.turnId || response?.turn_id || ''
}

function threadIdFromMessage(message) {
  const params = message?.params || {}
  return params.threadId
    || params.thread_id
    || params.turn?.threadId
    || params.turn?.thread_id
    || ''
}

function turnIdFromMessage(message) {
  const params = message?.params || {}
  return params.turnId
    || params.turn_id
    || params.id
    || params.turn?.id
    || params.turn?.turnId
    || params.turn?.turn_id
    || ''
}

function buildGenerationTurnText(request, index, total) {
  return [
    'このスレッドは Navigatoria 顔グラ画像生成専用です。',
    `以下の1件だけを画像生成してください。これは ${index + 1} / ${total} 件目です。`,
    'この返信では説明文を増やさず、生成完了後にタイトルと保存先が分かる最小限の返答だけにしてください。',
    'プロンプトは固有名詞の作家模倣を追加せず、下記の画風ロックを維持してください。',
    '',
    `Title: ${request.title || `portrait-${index + 1}`}`,
    '',
    'Prompt:',
    request.prompt,
    '',
    'Negative prompt:',
    request.negativePrompt,
  ].join('\n')
}

class AppServerClient {
  constructor() {
    this.child = null
    this.buffer = ''
    this.stderr = ''
    this.pending = new Map()
    this.watchers = []
  }

  start() {
    if (this.child) return
    this.child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', CODEX_CMD, 'app-server'], {
      cwd: TOOL_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    this.child.stdout.on('data', (chunk) => this.handleStdout(chunk.toString('utf8')))
    this.child.stderr.on('data', (chunk) => {
      this.stderr = `${this.stderr}${chunk.toString('utf8')}`.slice(-4096)
    })
    this.child.on('close', () => {
      const error = new Error('Codex app-server closed before the request completed.')
      this.rejectAll(error)
    })
    this.child.on('error', (error) => this.rejectAll(error))
  }

  stop() {
    if (!this.child) return
    this.child.kill()
    this.child = null
  }

  async initialize() {
    await this.request('initialize', {
      clientInfo: {
        name: 'portrait-manager',
        title: 'Portrait Manager',
        version: '0.1.0',
      },
      capabilities: {
        experimentalApi: true,
      },
    })
  }

  request(method, params, timeoutMs = 30_000) {
    this.start()
    const id = createRpcId(method.replace(/\W+/g, '-'))
    const payload = JSON.stringify({ id, method, params })

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Codex app-server request timed out: ${method}`))
      }, timeoutMs)

      this.pending.set(id, { resolve, reject, timeout, method })
      this.child.stdin.write(`${payload}\n`)
    })
  }

  waitFor(method, predicate, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.watchers = this.watchers.filter((watcher) => watcher !== watcherRef)
        reject(new Error(`Timed out waiting for ${method}`))
      }, timeoutMs)
      const watcherRef = { method, predicate, resolve, reject, timeout }
      this.watchers.push(watcherRef)
    })
  }

  handleStdout(chunk) {
    this.buffer += chunk
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      let message
      try {
        message = JSON.parse(line)
      } catch {
        continue
      }

      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id)
        this.pending.delete(message.id)
        clearTimeout(pending.timeout)
        if (message.error) {
          pending.reject(new Error(message.error.message || `Codex app-server request failed: ${pending.method}`))
        } else {
          pending.resolve(message.result ?? null)
        }
      }

      if (message.method) {
        this.resolveWatchers(message)
      }
    }
  }

  resolveWatchers(message) {
    for (const watcher of [...this.watchers]) {
      if (watcher.method !== message.method) continue
      if (!watcher.predicate(message)) continue
      this.watchers = this.watchers.filter((item) => item !== watcher)
      clearTimeout(watcher.timeout)
      watcher.resolve(message)
    }
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
    this.pending.clear()
    for (const watcher of this.watchers) {
      clearTimeout(watcher.timeout)
      watcher.reject(error)
    }
    this.watchers = []
  }
}

async function ensureImageThread(client) {
  const saved = await readJsonFile(IMAGE_THREAD_FILE, {})
  if (saved.threadId) {
    return saved.threadId
  }

  const response = await client.request('thread/start', {
    cwd: path.resolve(TOOL_DIR, '..', '..'),
    model: 'gpt-5.4-mini',
    approvalPolicy: 'never',
    personality: 'pragmatic',
    baseInstructions: 'You are a dedicated Navigatoria portrait image-generation worker. Keep this thread only for generated portrait assets.',
    developerInstructions: 'Use the built-in image generation tool when asked to generate a portrait. Generate exactly one image per request. Keep final replies minimal.',
  }, 60_000)
  const threadId = threadIdFromResponse(response)
  if (!threadId) {
    throw new Error('App Server did not return a thread id.')
  }

  await client.request('thread/name/set', {
    threadId,
    name: IMAGE_THREAD_NAME,
  })

  await writeJsonFile(IMAGE_THREAD_FILE, {
    threadId,
    name: IMAGE_THREAD_NAME,
    createdAt: new Date().toISOString(),
  })
  return threadId
}

async function runGenerationJob(requests) {
  const client = new AppServerClient()
  const job = {
    status: 'running',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    count: requests.length,
    completed: 0,
    threadId: '',
    currentTitle: '',
    error: '',
  }

  await writeJsonFile(JOB_FILE, job)

  try {
    await client.initialize()
    job.threadId = await ensureImageThread(client)
    await client.request('thread/resume', { threadId: job.threadId }, 60_000)
    await writeJsonFile(JOB_FILE, { ...job, updatedAt: new Date().toISOString() })

    for (let index = 0; index < requests.length; index += 1) {
      const request = requests[index]
      job.currentTitle = request.title || `portrait-${index + 1}`
      await writeJsonFile(JOB_FILE, { ...job, updatedAt: new Date().toISOString() })

      const completion = client.waitFor('turn/completed', (message) => {
        const messageThreadId = threadIdFromMessage(message)
        return !messageThreadId || messageThreadId === job.threadId
      }, TURN_TIMEOUT_MS)

      await client.request('turn/start', {
        threadId: job.threadId,
        cwd: path.resolve(TOOL_DIR, '..', '..'),
        approvalPolicy: 'never',
        model: 'gpt-5.4-mini',
        input: [{
          type: 'text',
          text: buildGenerationTurnText(request, index, requests.length),
        }],
      }, 60_000)
      await completion

      job.completed = index + 1
      await writeJsonFile(JOB_FILE, { ...job, updatedAt: new Date().toISOString() })
    }

    await writeJsonFile(JOB_FILE, {
      ...job,
      status: 'completed',
      currentTitle: '',
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    })
  } catch (error) {
    await writeJsonFile(JOB_FILE, {
      ...job,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      updatedAt: new Date().toISOString(),
    })
  } finally {
    client.stop()
  }
}

let activeGenerationJob = null

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

  if (request.method === 'GET' && url.pathname === '/api/image-thread') {
    const saved = await readJsonFile(IMAGE_THREAD_FILE, {})
    sendJson(response, 200, saved.threadId ? saved : { threadId: '', name: IMAGE_THREAD_NAME })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/image-thread') {
    if (activeGenerationJob) {
      sendJson(response, 409, { error: 'job_running', message: '画像生成ジョブが実行中です' })
      return
    }
    const client = new AppServerClient()
    try {
      await client.initialize()
      const threadId = await ensureImageThread(client)
      sendJson(response, 201, { threadId, name: IMAGE_THREAD_NAME })
    } finally {
      client.stop()
    }
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/app-server/generate') {
    if (activeGenerationJob) {
      sendJson(response, 409, { error: 'job_running', message: '画像生成ジョブが実行中です' })
      return
    }

    const body = await readJsonBody(request)
    const requests = Array.isArray(body.requests) ? body.requests.map(cleanRequest) : []
    const validRequests = requests.filter((item) => item.prompt)
    if (!validRequests.length) {
      sendJson(response, 400, { error: 'bad_request', message: '生成するPromptがありません' })
      return
    }

    const payload = {
      createdAt: new Date().toISOString(),
      count: validRequests.length,
      requests: validRequests,
    }
    await writeJsonFile(REQUEST_FILE, payload)

    activeGenerationJob = runGenerationJob(validRequests).finally(() => {
      activeGenerationJob = null
    })
    sendJson(response, 202, { count: validRequests.length })
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/app-server/job') {
    sendJson(response, 200, await readJsonFile(JOB_FILE, { status: 'idle', count: 0, completed: 0 }))
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
