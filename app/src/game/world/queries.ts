import type { Position2D } from '@/types/common.ts'
import type { Port } from '@/types/port.ts'
import type { Zone } from '@/types/world.ts'

export function getZoneAtPosition(position: Position2D, zones: Zone[]): Zone | undefined {
  return zones.find(
    (zone) =>
      position.x >= zone.bounds.topLeft.x &&
      position.x <= zone.bounds.bottomRight.x &&
      position.y <= zone.bounds.topLeft.y &&
      position.y >= zone.bounds.bottomRight.y,
  )
}

export function getNearestPort(position: Position2D, ports: Port[]): { port: Port; distanceKm: number } | null {
  if (ports.length === 0) return null

  let bestPort = ports[0]!
  let bestDistance = getDistanceKm(position, bestPort.position)

  for (let i = 1; i < ports.length; i++) {
    const port = ports[i]!
    const distance = getDistanceKm(position, port.position)
    if (distance < bestDistance) {
      bestPort = port
      bestDistance = distance
    }
  }

  return { port: bestPort, distanceKm: bestDistance }
}

export function getDistanceKm(a: Position2D, b: Position2D): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.hypot(dx, dy)
}
