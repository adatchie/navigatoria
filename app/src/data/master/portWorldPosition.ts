import { INITIAL_PLAYER } from '@/config/gameConfig.ts'
import { anchorPortPointToCoast } from '@/data/master/landmasses.ts'
import { PORT_GEO_COORDINATES } from '@/data/master/portGeography.ts'
import { projectGeoToWorld } from '@/data/master/worldMapProjection.ts'
import type { Position2D } from '@/types/common.ts'

function getFallbackPortPosition(): Position2D {
  const projected = projectGeoToWorld(PORT_GEO_COORDINATES[INITIAL_PLAYER.START_PORT]!)
  const [x, y] = anchorPortPointToCoast([projected.x, projected.y])
  return { x, y }
}

export function getPortWorldPosition(portId: string): Position2D {
  const geo = PORT_GEO_COORDINATES[portId]
  if (!geo) return getFallbackPortPosition()

  const projected = projectGeoToWorld(geo)
  const [x, y] = anchorPortPointToCoast([projected.x, projected.y])
  return { x, y }
}
