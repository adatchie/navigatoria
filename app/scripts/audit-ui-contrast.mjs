import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const targetUrl = process.env.AUDIT_URL ?? 'http://127.0.0.1:4174/navigatoria/'
const profileDir = 'C:/dol/app/tmp-contrast-audit-profile'
const port = Number(process.env.CDP_PORT ?? 9444)
const minimumRatio = Number(process.env.MIN_CONTRAST ?? 4.5)

rmSync(profileDir, { recursive: true, force: true })
mkdirSync(profileDir, { recursive: true })

const chrome = spawn(chromePath, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=1920,1080',
  targetUrl,
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function getJson(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      return await (await fetch(url)).json()
    } catch {
      await sleep(250)
    }
  }
  throw new Error(`CDP endpoint did not become ready: ${url}`)
}

let callId = 0

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (!message.id || !pending.has(message.id)) return
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(JSON.stringify(message.error)))
    else resolve(message.result)
  }
  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  return {
    ready,
    send(method, params = {}) {
      const id = ++callId
      ws.send(JSON.stringify({ id, method, params }))
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
    },
    close() {
      ws.close()
    },
  }
}

const auditExpression = `
(() => {
  const minimumRatio = ${JSON.stringify(minimumRatio)};
  const parseColor = (value) => {
    if (!value || value === 'transparent') return null;
    const match = value.match(/rgba?\\(([^)]+)\\)/);
    if (!match) return null;
    const parts = match[1].split(',').map((part) => part.trim());
    const rgb = parts.slice(0, 3).map(Number);
    const alpha = parts[3] === undefined ? 1 : Number(parts[3]);
    return { r: rgb[0], g: rgb[1], b: rgb[2], a: Number.isFinite(alpha) ? alpha : 1 };
  };
  const blend = (fg, bg) => {
    const alpha = fg.a + bg.a * (1 - fg.a);
    if (alpha === 0) return { r: 255, g: 255, b: 255, a: 1 };
    return {
      r: Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / alpha),
      g: Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / alpha),
      b: Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / alpha),
      a: alpha,
    };
  };
  const luminance = (color) => {
    const channel = (value) => {
      const srgb = value / 255;
      return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  };
  const ratio = (a, b) => {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const effectiveBackground = (element) => {
    let color = { r: 255, g: 255, b: 255, a: 1 };
    let hasImage = false;
    const imageFallbackColor = (image) => {
      if (!image || image === 'none') return null;
      if (image.includes('dark-oak')) return { r: 62, g: 39, b: 35, a: 1 };
      if (image.includes('parchment') || image.includes('ledger')) return { r: 239, g: 224, b: 178, a: 1 };
      if (image.includes('brass')) return { r: 184, g: 134, b: 11, a: 1 };
      return null;
    };
    const chain = [];
    for (let current = element; current; current = current.parentElement) chain.push(current);
    for (const current of chain.reverse()) {
      const style = getComputedStyle(current);
      if (style.backgroundImage && style.backgroundImage !== 'none') {
        hasImage = true;
        const fallback = imageFallbackColor(style.backgroundImage);
        if (fallback) color = fallback;
      }
      const bg = parseColor(style.backgroundColor);
      if (bg && bg.a > 0) color = blend(bg, color);
    }
    return { color, hasImage };
  };
  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0;
  };
  const failures = [];
  const nodes = Array.from(document.querySelectorAll('body *')).filter(isVisible);
  for (const element of nodes) {
    const text = (element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim();
    if (!text || text.length > 80) continue;
    if (Array.from(element.children).some((child) => (child.innerText || child.textContent || '').trim())) continue;
    const style = getComputedStyle(element);
    const fg = parseColor(style.color);
    if (!fg) continue;
    const bg = effectiveBackground(element);
    const contrast = ratio(fg, bg.color);
    if (contrast < minimumRatio) {
      const rect = element.getBoundingClientRect();
      failures.push({
        text,
        contrast: Number(contrast.toFixed(2)),
        color: style.color,
        background: 'rgb(' + bg.color.r + ', ' + bg.color.g + ', ' + bg.color.b + ')',
        hasBackgroundImage: bg.hasImage,
        tag: element.tagName.toLowerCase(),
        className: element.className ? String(element.className).slice(0, 80) : '',
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      });
    }
  }
  return failures.sort((a, b) => a.contrast - b.contrast).slice(0, 60);
})()
`

async function evaluateAudit(page, context) {
  const result = await page.send('Runtime.evaluate', {
    expression: auditExpression,
    returnByValue: true,
  })
  return (result.result.value ?? []).map((entry) => ({ context, ...entry }))
}

try {
  const version = await getJson(`http://127.0.0.1:${port}/json/version`)
  const browser = connect(version.webSocketDebuggerUrl)
  await browser.ready
  const targets = await getJson(`http://127.0.0.1:${port}/json/list`)
  const pageTarget = targets.find((target) => target.type === 'page')
  const page = connect(pageTarget.webSocketDebuggerUrl)
  await page.ready
  await page.send('Page.enable')
  await page.send('Runtime.enable')
  await sleep(8500)
  const readiness = await page.send('Runtime.evaluate', {
    expression: `({ title: document.title, bodyText: document.body?.innerText?.slice(0, 200) ?? '', url: location.href })`,
    returnByValue: true,
  })
  const pageInfo = readiness.result.value
  if (/ERR_|このサイトにアクセスできません|refused|拒否/.test(`${pageInfo.title} ${pageInfo.bodyText}`)) {
    throw new Error(`Target page did not load: ${pageInfo.url} / ${pageInfo.title}`)
  }
  let townReady = false
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const result = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const townButton = buttons.find((button) => button.textContent.trim() === '港概要');
        if (townButton) return true;
        buttons.find((button) => button.textContent.includes('新しく航海'))?.click();
        return false;
      })()`,
      returnByValue: true,
    })
    townReady = Boolean(result.result.value)
    if (townReady) break
    await sleep(750)
  }
  if (!townReady) throw new Error('Town screen did not become ready after starting a new voyage.')
  const failures = []
  const sections = ['港概要', '出航所', '市場', 'ギルド', '酒場', '造船所', '銀行', '保管庫']
  for (const section of sections) {
    await page.send('Runtime.evaluate', {
      expression: `Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === ${JSON.stringify(section)})?.click()`,
    })
    await sleep(250)
    for (const scrollTop of [0, 600, 1200, 1800, 2400]) {
      await page.send('Runtime.evaluate', {
        expression: `(() => { const els=[...document.querySelectorAll('*')]; const sc=els.filter(e=>e.scrollHeight>e.clientHeight+20).sort((a,b)=>(b.clientHeight*b.clientWidth)-(a.clientHeight*a.clientWidth))[0]; if(sc) sc.scrollTop=${scrollTop}; })()`,
      })
      await sleep(120)
      failures.push(...await evaluateAudit(page, `${section}@${scrollTop}`))
    }
  }
  const seen = new Set()
  const uniqueFailures = failures.filter((entry) => {
    const key = `${entry.context}:${entry.text}:${entry.rect.x}:${entry.rect.y}:${entry.color}:${entry.background}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => a.contrast - b.contrast).slice(0, 80)
  writeFileSync('contrast-audit.json', `${JSON.stringify(uniqueFailures, null, 2)}\n`)
  if (uniqueFailures.length > 0) {
    console.log(`Contrast audit found ${uniqueFailures.length} low-contrast text candidates. See contrast-audit.json.`)
    console.table(uniqueFailures.slice(0, 20).map(({ context, text, contrast, color, background, hasBackgroundImage }) => ({ context, text, contrast, color, background, hasBackgroundImage })))
    process.exitCode = 1
  } else {
    console.log(`Contrast audit passed: no visible text below ${minimumRatio}:1.`)
  }
  page.close()
  browser.close()
} finally {
  chrome.kill()
  await sleep(600)
  try {
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 })
  } catch (error) {
    console.warn(`Could not remove temporary Chrome profile: ${error.message}`)
  }
}
