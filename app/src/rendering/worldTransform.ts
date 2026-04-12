import type { Position2D } from '@/types/common.ts'
import { WORLD_GEOMETRY_SCALE, WORLD_HEIGHT, WORLD_WIDTH } from '@/config/gameConfig.ts'

// 内部地図を拡大しても見た目のスケール感は保つ。
export const SCENE_WORLD_SCALE = 0.3 / WORLD_GEOMETRY_SCALE

export function worldToScene(position: Position2D): [number, number, number] {
  const centeredX = WORLD_WIDTH / 2 - position.x
  const centeredZ = position.y - WORLD_HEIGHT / 2

  return [centeredX * SCENE_WORLD_SCALE, 0, centeredZ * SCENE_WORLD_SCALE]
}

/** シーン座標 → ワールド座標 (worldToSceneの逆変換) */
export function sceneToWorld(sceneX: number, sceneZ: number): Position2D {
  return {
    x: WORLD_WIDTH / 2 - sceneX / SCENE_WORLD_SCALE,
    y: sceneZ / SCENE_WORLD_SCALE + WORLD_HEIGHT / 2,
  }
}
