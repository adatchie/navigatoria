import corridorsRaw from './navigableWaterCorridors.json'
import { projectGeoPairToWorld } from './worldMapProjection.ts'

export interface NavigableWaterCorridor {
  id: string
  radius: number
  points: [number, number][]
}

interface NavigableWaterCorridorSource {
  id: string
  radius: number
  points: [number, number][]
}

export const NAVIGABLE_WATER_CORRIDORS: NavigableWaterCorridor[] = (corridorsRaw as NavigableWaterCorridorSource[]).map((corridor) => ({
  id: corridor.id,
  radius: corridor.radius,
  points: corridor.points.map(([lon, lat]) => projectGeoPairToWorld([lon, lat])),
}))

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

export function isPointInNavigableWaterCorridor(point: [number, number]): boolean {
  for (const corridor of NAVIGABLE_WATER_CORRIDORS) {
    const radiusSq = corridor.radius * corridor.radius
    for (let i = 1; i < corridor.points.length; i++) {
      const closest = clampPointToSegment(point, corridor.points[i - 1]!, corridor.points[i]!)
      if (distanceSq(point, closest) <= radiusSq) return true
    }
  }
  return false
}
