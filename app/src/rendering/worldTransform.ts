import type { Position2D } from '@/types/common.ts'
import { WORLD_HEIGHT, WORLD_WIDTH } from '@/config/gameConfig.ts'

// 3Dシーンでの1マップ単位のサイズ
// 大きいほど港同士が離れて見え、一画面で見渡せる範囲が狭くなる
// ※デバッグ用に縮小中 (本番: 3.0)
export const SCENE_WORLD_SCALE = 0.3

export function worldToScene(position: Position2D): [number, number, number] {
  const centeredX = position.x - WORLD_WIDTH / 2
  const centeredZ = position.y - WORLD_HEIGHT / 2

  return [centeredX * SCENE_WORLD_SCALE, 0, centeredZ * SCENE_WORLD_SCALE]
}

/** シーン座標 → ワールド座標 (worldToSceneの逆変換) */
export function sceneToWorld(sceneX: number, sceneZ: number): Position2D {
  return {
    x: sceneX / SCENE_WORLD_SCALE + WORLD_WIDTH / 2,
    y: sceneZ / SCENE_WORLD_SCALE + WORLD_HEIGHT / 2,
  }
}
