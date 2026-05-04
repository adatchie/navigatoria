import landRaw from '@/data/master/ne_50m_land.json'
import { projectGeoPairToWorld } from '@/data/master/worldMapProjection.ts'

interface Bounds2D {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface DetailLandPolygon {
  id: string
  rings: [number, number][][]
  bounds: Bounds2D
}

interface GeoJsonGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

interface GeoJsonFeature {
  geometry: GeoJsonGeometry
}

interface GeoJsonFeatureCollection {
  features: GeoJsonFeature[]
}

interface DetailTileRequest {
  type: 'render-detail-tile'
  requestId: number
  centerX: number
  centerY: number
  tileWorldSize: number
  textureSize: number
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<DetailTileRequest>) => void) | null
  postMessage: (message: unknown) => void
}

const LAND_COLOR = '#3f5f34'

function computeBounds(points: [number, number][]): Bounds2D {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  points.forEach(([x, y]) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  })

  return { minX, minY, maxX, maxY }
}

function boundsIntersect(bounds: Bounds2D, minX: number, minY: number, maxX: number, maxY: number): boolean {
  return bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxY >= minY && bounds.minY <= maxY
}

function projectRing(ring: number[][]): [number, number][] {
  const points = ring
    .map(([lon, lat]) => projectGeoPairToWorld([lon, lat]))
    .filter((point, index, arr) => index === 0 || arr[index - 1]![0] !== point[0] || arr[index - 1]![1] !== point[1])

  const first = points[0]
  const last = points[points.length - 1]
  if (first && last && first[0] === last[0] && first[1] === last[1]) points.pop()
  return points
}

function projectPolygon(featureIndex: number, polygonIndex: number, polygon: number[][][]): DetailLandPolygon | null {
  const rings = polygon
    .map(projectRing)
    .filter((ring) => ring.length >= 3)

  if (rings.length === 0) return null

  return {
    id: `detail_land_${featureIndex}_${polygonIndex}`,
    rings,
    bounds: computeBounds(rings.flat()),
  }
}

function buildDetailPolygons(): DetailLandPolygon[] {
  const collection = landRaw as GeoJsonFeatureCollection
  const polygons: DetailLandPolygon[] = []

  collection.features.forEach((feature, featureIndex) => {
    const geometry = feature.geometry
    if (!geometry) return

    if (geometry.type === 'Polygon') {
      const polygon = projectPolygon(featureIndex, 0, geometry.coordinates as number[][][])
      if (polygon) polygons.push(polygon)
      return
    }

    const multiPolygon = geometry.coordinates as number[][][][]
    multiPolygon.forEach((polygonData, polygonIndex) => {
      const polygon = projectPolygon(featureIndex, polygonIndex, polygonData)
      if (polygon) polygons.push(polygon)
    })
  })

  return polygons
}

const detailPolygons = buildDetailPolygons()

function polygonToSvgPath(polygon: DetailLandPolygon, tileBounds: Bounds2D, textureSize: number): string {
  const tileWidth = tileBounds.maxX - tileBounds.minX
  const tileHeight = tileBounds.maxY - tileBounds.minY
  const toSvgPoint = ([x, y]: [number, number]): string => {
    const [px, py] = [
    ((tileBounds.maxX - x) / tileWidth) * textureSize,
    (1 - (y - tileBounds.minY) / tileHeight) * textureSize,
    ]
    return `${px.toFixed(1)},${py.toFixed(1)}`
  }

  return polygon.rings
    .map((ring) => {
      if (ring.length < 3) return ''
      const [first, ...rest] = ring
      return `M${toSvgPoint(first!)} ${rest.map((point) => `L${toSvgPoint(point)}`).join(' ')} Z`
    })
    .filter(Boolean)
    .join(' ')
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function renderDetailTileSvg(request: DetailTileRequest): string {
  const halfSize = request.tileWorldSize / 2
  const tileBounds = {
    minX: request.centerX - halfSize,
    minY: request.centerY - halfSize,
    maxX: request.centerX + halfSize,
    maxY: request.centerY + halfSize,
  }

  const paths = detailPolygons
    .filter((polygon) => boundsIntersect(polygon.bounds, tileBounds.minX, tileBounds.minY, tileBounds.maxX, tileBounds.maxY))
    .map((polygon) => {
      const path = polygonToSvgPath(polygon, tileBounds, request.textureSize)
      return path ? `<path d="${escapeXml(path)}"/>` : ''
    })
    .filter(Boolean)
    .join('')

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${request.textureSize}" height="${request.textureSize}" viewBox="0 0 ${request.textureSize} ${request.textureSize}">`,
    `<g fill="${LAND_COLOR}" fill-rule="evenodd" clip-rule="evenodd">`,
    paths,
    '</g>',
    '</svg>',
  ].join('')
}

const workerScope = self as unknown as WorkerScope

workerScope.onmessage = (event: MessageEvent<DetailTileRequest>) => {
  const request = event.data
  if (request.type !== 'render-detail-tile') return

  const svg = renderDetailTileSvg(request)
  workerScope.postMessage({
    type: 'detail-tile-rendered',
    requestId: request.requestId,
    centerX: request.centerX,
    centerY: request.centerY,
    svg,
  })
}

export {}
