// ============================================================
// 発見物型定義 [STUB] — Phase 2以降で実装
// ============================================================

import type { Position2D, SkillId } from './common.ts'

/** 発見物カテゴリ */
export type DiscoveryCategory =
  | 'geography' // 地理
  | 'biology' // 生物
  | 'archaeology' // 考古学
  | 'religion' // 宗教遺物
  | 'art' // 美術品
  | 'treasure' // 財宝

/** 発見物マスタデータ */
export interface DiscoveryItem {
  id: string
  name: string
  category: DiscoveryCategory
  description: string
  position: Position2D // 発見地点
  difficulty: number // 発見難度 (1-10)
  requiredSkill: SkillId // 必要スキル
  requiredRank: number // 必要スキルランク
  fame: number // 発見時名声
  cardPrice: number // カード売却額
}

/** 発見済み記録 */
export interface DiscoveryRecord {
  itemId: string
  discoveredAt: number // ゲーム内日数
  reportedTo?: string // 報告先ギルド
}
