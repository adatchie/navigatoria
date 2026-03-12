import type { Position2D } from '@/types/common.ts'
import { WORLD_HEIGHT, WORLD_WIDTH } from '@/config/gameConfig.ts'

export const SCENE_WORLD_SCALE = 0.25

export function worldToScene(position: Position2D): [number, number, number] {
  const centeredX = position.x - WORLD_WIDTH / 2
  const centeredZ = position.y - WORLD_HEIGHT / 2

  return [centeredX * SCENE_WORLD_SCALE, 0, centeredZ * SCENE_WORLD_SCALE]
}
