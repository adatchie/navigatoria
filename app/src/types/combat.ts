// ============================================================
// 戦闘型定義 [STUB] — Phase 1以降で実装
// ============================================================

import type { Position2D, CharacterId } from './common.ts'

/** 戦闘タイプ */
export type CombatType = 'artillery' | 'boarding' | 'flee'

/** 戦闘状態 */
export interface CombatState {
  type: CombatType
  playerShipId: string
  enemyShipId: string
  playerPosition: Position2D
  enemyPosition: Position2D
  turn: number
  phase: CombatPhase
}

/** 戦闘フェーズ */
export type CombatPhase = 'approach' | 'engage' | 'result'

/** 戦闘結果 */
export interface BattleResult {
  winner: CharacterId
  loser: CharacterId
  loot: BattleLoot[]
  experienceGained: number
  fameGained: number
}

/** 戦利品 */
export interface BattleLoot {
  type: 'money' | 'cargo' | 'ship'
  itemId?: string
  quantity?: number
  money?: number
}

/** 砲撃データ (マスタ) */
export interface CannonType {
  id: string
  name: string
  damage: number
  range: number // 射程 (グリッド)
  reload: number // リロード時間 (秒)
  weight: number // 重量
  price: number
}
