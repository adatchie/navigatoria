// ============================================================
// Natural Earth 50m land polygons projected into the game's
// Mercator-based world coordinate system.
// Source: https://www.naturalearthdata.com/
// Mirror used for download: https://github.com/nvkelso/natural-earth-vector
// ============================================================

import landRaw from '@/data/master/ne_50m_land.json'
import { projectGeoPairToWorld } from '@/data/master/worldMapProjection.ts'

export interface LandPolygon {
  id: string
  name: string
  points: [number, number][]
  color: string
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

const LAND_COLOR = '#3f5f34'
const MIN_RING_POINTS = 3
const PORT_SEA_OFFSET = 0.12
const DEPARTURE_SEA_OFFSET = 1.6
const SEA_SEARCH_MAX_RADIUS = 2.4
const SEA_SEARCH_RADIAL_STEPS = 24
const SEA_SEARCH_ANGLE_STEPS = 48

function projectRing(ring: number[][]): [number, number][] {
  const projected = ring.map(([lon, lat]) => projectGeoPairToWorld([lon, lat]))
  if (projected.length > 1) {
    const first = projected[0]!
    const last = projected[projected.length - 1]!
    if (first[0] === last[0] && first[1] === last[1]) {
      projected.pop()
    }
  }
  return projected.filter((_, index, arr) => index === 0 || arr[index - 1]![0] !== arr[index]![0] || arr[index - 1]![1] !== arr[index]![1])
}

function polygonToLandPolygons(featureIndex: number, polygonIndex: number, polygon: number[][][]): LandPolygon[] {
  const outerRing = polygon[0]
  if (!outerRing) return []

  const projected = projectRing(outerRing)
  if (projected.length < MIN_RING_POINTS) return []

  return [{
    id: `land_${featureIndex}_${polygonIndex}`,
    name: `land_${featureIndex}_${polygonIndex}`,
    points: projected,
    color: LAND_COLOR,
  }]
}

function buildLandPolygons(): LandPolygon[] {
  const featureCollection = landRaw as GeoJsonFeatureCollection
  const polygons: LandPolygon[] = []

  featureCollection.features.forEach((feature, featureIndex) => {
    const geometry = feature.geometry
    if (!geometry) return

    if (geometry.type === 'Polygon') {
      polygons.push(...polygonToLandPolygons(featureIndex, 0, geometry.coordinates as number[][][]))
      return
    }

    if (geometry.type === 'MultiPolygon') {
      const multiPolygon = geometry.coordinates as number[][][][]
      multiPolygon.forEach((polygon, polygonIndex) => {
        polygons.push(...polygonToLandPolygons(featureIndex, polygonIndex, polygon))
      })
    }
  })

  return polygons
}

export const LANDMASSES: LandPolygon[] = buildLandPolygons()

function isPointInPolygon(point: [number, number], polygon: LandPolygon): boolean {
  const [px, py] = point
  let inside = false
  const points = polygon.points
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]!
    const [xj, yj] = points[j]!
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 0.000001) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function isPointOnLand(point: [number, number]): boolean {
  for (const polygon of LANDMASSES) {
    if (isPointInPolygon(point, polygon)) return true
  }
  return false
}

function clampPointToSegment(
  point: [number, number],
  segmentStart: [number, number],
  segmentEnd: [number, number],
): [number, number] {
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

function distanceSq(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return dx * dx + dy * dy
}

function findNearestCoastPoint(point: [number, number]): [number, number] {
  let bestPoint: [number, number] = point
  let bestDistance = Number.POSITIVE_INFINITY

  for (const polygon of LANDMASSES) {
    const points = polygon.points
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const candidate = clampPointToSegment(point, points[j]!, points[i]!)
      const candidateDistance = distanceSq(point, candidate)
      if (candidateDistance < bestDistance) {
        bestDistance = candidateDistance
        bestPoint = candidate
      }
    }
  }

  return bestPoint
}

function findNearestSeaAroundCoast(
  originalPoint: [number, number],
  coast: [number, number],
  offset: number,
): [number, number] {
  let bestSeaPoint = coast
  let bestDistance = Number.POSITIVE_INFINITY

  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2
    const candidate: [number, number] = [
      coast[0] + Math.cos(angle) * offset,
      coast[1] + Math.sin(angle) * offset,
    ]
    if (isPointOnLand(candidate)) continue

    const candidateDistance = distanceSq(originalPoint, candidate)
    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance
      bestSeaPoint = candidate
    }
  }

  return bestSeaPoint
}

function normalizeVector(dx: number, dy: number): [number, number] | null {
  const length = Math.hypot(dx, dy)
  if (length <= 0.0001) return null
  return [dx / length, dy / length]
}

/**
 * 港座標を海岸線に吸着し、最小限だけ海側へオフセットする。
 * 座標系の差があっても、港マーカーが海岸線から大きく離れないようにする。
 */
export function anchorPortPointToCoast(point: [number, number], offset = PORT_SEA_OFFSET): [number, number] {
  const coast = findNearestCoastPoint(point)
  const seaPoint = findNearestSeaAroundCoast(point, coast, offset)
  return seaPoint
}

export function snapPointToNearestSea(point: [number, number], offset = PORT_SEA_OFFSET): [number, number] {
  if (!isPointOnLand(point)) return point

  let bestPoint: [number, number] | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (let radiusStep = 1; radiusStep <= SEA_SEARCH_RADIAL_STEPS; radiusStep++) {
    const radius = (SEA_SEARCH_MAX_RADIUS * radiusStep) / SEA_SEARCH_RADIAL_STEPS
    for (let angleStep = 0; angleStep < SEA_SEARCH_ANGLE_STEPS; angleStep++) {
      const angle = (angleStep / SEA_SEARCH_ANGLE_STEPS) * Math.PI * 2
      const candidate: [number, number] = [
        point[0] + Math.cos(angle) * radius,
        point[1] + Math.sin(angle) * radius,
      ]
      if (isPointOnLand(candidate)) continue

      const candidateDistance = distanceSq(point, candidate)
      if (candidateDistance < bestDistance) {
        bestDistance = candidateDistance
        bestPoint = candidate
      }
    }

    if (bestPoint && bestDistance <= radius * radius) {
      break
    }
  }

  if (bestPoint) {
    if (offset <= 0) return bestPoint
    const direction = normalizeVector(bestPoint[0] - point[0], bestPoint[1] - point[1])
    if (!direction) return bestPoint
    const paddedPoint: [number, number] = [
      bestPoint[0] + direction[0] * offset,
      bestPoint[1] + direction[1] * offset,
    ]
    return isPointOnLand(paddedPoint) ? bestPoint : paddedPoint
  }

  return anchorPortPointToCoast(point, offset)
}

export function getSeawardDeparture(point: [number, number], offset = DEPARTURE_SEA_OFFSET): { point: [number, number]; heading: number } {
  const coast = findNearestCoastPoint(point)
  const fallbackSeaPoint = findNearestSeaAroundCoast(point, coast, offset)
  const direction = normalizeVector(point[0] - coast[0], point[1] - coast[1])

  const seaPoint: [number, number] = direction
    ? [point[0] + direction[0] * offset, point[1] + direction[1] * offset]
    : fallbackSeaPoint

  const safePoint = isPointOnLand(seaPoint) ? fallbackSeaPoint : seaPoint
  const safeDirection = normalizeVector(safePoint[0] - coast[0], safePoint[1] - coast[1]) ?? [0, 1]
  const heading = (Math.atan2(safeDirection[0], safeDirection[1]) * 180) / Math.PI

  return {
    point: safePoint,
    heading: (heading + 360) % 360,
  }
}
