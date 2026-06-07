import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const inputPath = path.join(repoRoot, 'src/data/master/ne_50m_land.json')
const corridorPath = path.join(repoRoot, 'src/data/master/navigableWaterCorridors.json')
const outputDir = path.join(repoRoot, 'public/generated')
const outputPath = path.join(outputDir, 'land-base.svg')

const WIDTH = 4096
const HEIGHT = 2048
const WORLD_WIDTH = 1600 * 32
const LAND_COLOR = '#7a6549'
const MAX_MERCATOR_LAT = 85.05112878

function clampLat(lat) {
  return Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat))
}

function mercatorY(lat) {
  const radians = (clampLat(lat) * Math.PI) / 180
  return Math.log(Math.tan(Math.PI / 4 + radians / 2))
}

const mercatorMin = mercatorY(-MAX_MERCATOR_LAT)
const mercatorMax = mercatorY(MAX_MERCATOR_LAT)

function pointToSvg([lon, lat]) {
  const x = (1 - (lon + 180) / 360) * WIDTH
  const normalizedY = (mercatorY(lat) - mercatorMin) / (mercatorMax - mercatorMin)
  const y = (1 - normalizedY) * HEIGHT
  return `${x.toFixed(1)},${y.toFixed(1)}`
}

function corridorToSvgPath(points) {
  if (!points || points.length < 2) return ''
  const [first, ...rest] = points
  return `M${pointToSvg(first)} ${rest.map((point) => `L${pointToSvg(point)}`).join(' ')}`
}

function ringToPath(ring) {
  if (!ring || ring.length < 3) return ''
  const [first, ...rest] = ring
  return `M${pointToSvg(first)} ${rest.map((point) => `L${pointToSvg(point)}`).join(' ')} Z`
}

const collection = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const corridors = JSON.parse(fs.readFileSync(corridorPath, 'utf8'))
const polygons = []

collection.features.forEach((feature) => {
  const geometry = feature.geometry
  if (!geometry) return

  const sourcePolygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates

  sourcePolygons.forEach((polygon) => {
    const pathData = polygon.map(ringToPath).filter(Boolean).join(' ')
    if (!pathData) return
    polygons.push(`<path d="${pathData}"/>`)
  })
})

const corridorMaskStrokes = corridors
  .map((corridor) => {
    const pathData = corridorToSvgPath(corridor.points)
    if (!pathData) return ''
    const strokeWidth = ((corridor.radius * 2) / WORLD_WIDTH) * WIDTH
    return `<path d="${pathData}" stroke="black" stroke-width="${strokeWidth.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  })
  .filter(Boolean)

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
  '<defs>',
  '<mask id="water-corridor-mask" maskUnits="userSpaceOnUse">',
  `<rect width="${WIDTH}" height="${HEIGHT}" fill="white"/>`,
  ...corridorMaskStrokes,
  '</mask>',
  '</defs>',
  `<g fill="${LAND_COLOR}" fill-rule="evenodd" clip-rule="evenodd" mask="url(#water-corridor-mask)">`,
  ...polygons,
  '</g>',
  '</svg>',
  '',
].join('\n')

fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(outputPath, svg)
console.log(`Generated ${path.relative(repoRoot, outputPath)} (${polygons.length} polygons)`)
