import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const inputPath = path.join(repoRoot, 'src/data/master/ne_50m_land.json')
const corridorPath = path.join(repoRoot, 'src/data/master/navigableWaterCorridors.json')
const outputDir = path.join(repoRoot, 'src/data/generated')
const outputPath = path.join(outputDir, 'renderLandMask.ts')

const MASK_WIDTH = 2048
const MASK_HEIGHT = 1024
const WORLD_WIDTH = 1600 * 32
const MAX_MERCATOR_LAT = 85.05112878
const BASE64_LINE_LENGTH = 96

function clampLat(lat) {
  return Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat))
}

function mercatorY(lat) {
  const radians = (clampLat(lat) * Math.PI) / 180
  return Math.log(Math.tan(Math.PI / 4 + radians / 2))
}

const mercatorMin = mercatorY(-MAX_MERCATOR_LAT)
const mercatorMax = mercatorY(MAX_MERCATOR_LAT)

function projectPoint([lon, lat]) {
  const x = ((lon + 180) / 360) * MASK_WIDTH
  const y = ((mercatorY(lat) - mercatorMin) / (mercatorMax - mercatorMin)) * MASK_HEIGHT
  return [x, y]
}

function clampPointToSegment(point, segmentStart, segmentEnd) {
  const [px, py] = point
  const [ax, ay] = segmentStart
  const [bx, by] = segmentEnd
  const abx = bx - ax
  const aby = by - ay
  const segmentLengthSq = abx * abx + aby * aby
  if (segmentLengthSq === 0) return [ax, ay]
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / segmentLengthSq))
  return [ax + abx * t, ay + aby * t]
}

function distanceSq(a, b) {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return dx * dx + dy * dy
}

function isPointInNavigableCorridor(point, corridors) {
  for (const corridor of corridors) {
    const projectedPoints = corridor.projectedPoints
    const radiusSq = corridor.maskRadius * corridor.maskRadius
    for (let i = 1; i < projectedPoints.length; i += 1) {
      const closest = clampPointToSegment(point, projectedPoints[i - 1], projectedPoints[i])
      if (distanceSq(point, closest) <= radiusSq) return true
    }
  }
  return false
}

function projectRing(ring) {
  const projected = ring.map(projectPoint)
  if (projected.length > 1) {
    const first = projected[0]
    const last = projected[projected.length - 1]
    if (first[0] === last[0] && first[1] === last[1]) projected.pop()
  }
  return projected
}

function computeBounds(rings) {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const ring of rings) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  return { minX, minY, maxX, maxY }
}

function isPointInBounds(x, y, bounds) {
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY
}

function isPointInRing(x, y, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.000001) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function isPointInPolygon(x, y, polygon) {
  let inside = false
  for (const ring of polygon.rings) {
    if (isPointInRing(x, y, ring)) inside = !inside
  }
  return inside
}

function chunkString(value, chunkLength) {
  const chunks = []
  for (let index = 0; index < value.length; index += chunkLength) {
    chunks.push(value.slice(index, index + chunkLength))
  }
  return chunks
}

const collection = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const corridors = JSON.parse(fs.readFileSync(corridorPath, 'utf8')).map((corridor) => ({
  projectedPoints: corridor.points.map(projectPoint),
  maskRadius: (corridor.radius / WORLD_WIDTH) * MASK_WIDTH,
}))
const polygons = []

for (const feature of collection.features) {
  const geometry = feature.geometry
  if (!geometry) continue

  const sourcePolygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates

  for (const polygon of sourcePolygons) {
    const rings = polygon.map(projectRing).filter((ring) => ring.length >= 3)
    if (rings.length === 0) continue
    polygons.push({ rings, bounds: computeBounds(rings) })
  }
}

const bitCount = MASK_WIDTH * MASK_HEIGHT
const bytes = Buffer.alloc(Math.ceil(bitCount / 8))

for (let y = 0; y < MASK_HEIGHT; y += 1) {
  for (let x = 0; x < MASK_WIDTH; x += 1) {
    const sampleX = x + 0.5
    const sampleY = y + 0.5
    if (isPointInNavigableCorridor([sampleX, sampleY], corridors)) continue
    const isLand = polygons.some((polygon) =>
      isPointInBounds(sampleX, sampleY, polygon.bounds) &&
      isPointInPolygon(sampleX, sampleY, polygon),
    )
    if (!isLand) continue

    const bitIndex = y * MASK_WIDTH + x
    bytes[bitIndex >> 3] |= 1 << (bitIndex & 7)
  }
}

const base64Chunks = chunkString(bytes.toString('base64'), BASE64_LINE_LENGTH)
const source = [
  '// Generated by scripts/generate-render-land-mask.mjs',
  "import { WORLD_HEIGHT, WORLD_WIDTH } from '@/config/gameConfig.ts'",
  '',
  `export const RENDER_LAND_MASK_WIDTH = ${MASK_WIDTH}`,
  `export const RENDER_LAND_MASK_HEIGHT = ${MASK_HEIGHT}`,
  'const RENDER_LAND_MASK_BASE64 = [',
  ...base64Chunks.map((chunk) => `  '${chunk}',`),
  "].join('')",
  '',
  'let cachedMaskBytes: Uint8Array | null = null',
  '',
  'function getMaskBytes(): Uint8Array {',
  '  if (cachedMaskBytes) return cachedMaskBytes',
  '',
  '  const binary = atob(RENDER_LAND_MASK_BASE64)',
  '  const bytes = new Uint8Array(binary.length)',
  '  for (let index = 0; index < binary.length; index += 1) {',
  '    bytes[index] = binary.charCodeAt(index)',
  '  }',
  '  cachedMaskBytes = bytes',
  '  return bytes',
  '}',
  '',
  'export function isPointOnRenderedLand(point: [number, number]): boolean {',
  '  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return false',
  '',
  '  const x = Math.floor((point[0] / WORLD_WIDTH) * RENDER_LAND_MASK_WIDTH)',
  '  const y = Math.floor((point[1] / WORLD_HEIGHT) * RENDER_LAND_MASK_HEIGHT)',
  '  if (x < 0 || x >= RENDER_LAND_MASK_WIDTH || y < 0 || y >= RENDER_LAND_MASK_HEIGHT) return false',
  '',
  '  const bitIndex = y * RENDER_LAND_MASK_WIDTH + x',
  '  return (getMaskBytes()[bitIndex >> 3]! & (1 << (bitIndex & 7))) !== 0',
  '}',
  '',
].join('\n')

fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(outputPath, source)
console.log(`Generated ${path.relative(repoRoot, outputPath)} (${MASK_WIDTH}x${MASK_HEIGHT})`)
