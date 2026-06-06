// ============================================================
// クエスト型定義 — 発見・交易・戦闘クエスト共通
// ============================================================

import type { PortId, SkillId } from './common.ts'
import type { NpcFleetDefinition } from './npcFleet.ts'
import type { DiscoveryMethod } from './discovery.ts'

export type QuestType = 'main' | 'guild' | 'side' | 'delivery' | 'discovery' | 'combat'
export type QuestStatus = 'available' | 'active' | 'completed' | 'failed' | 'ready_to_turn_in'
export type QuestRank = 'standard' | 'urgent' | 'premium'
export type TradeQuestCategory = 'trade_delivery' | 'trade_procurement' | 'trade_sales'
export type CombatQuestCategory = 'combat_bounty'
export type AdventureQuestCategory = 'adventure_discovery'
export type QuestCategory = TradeQuestCategory | CombatQuestCategory | AdventureQuestCategory

export interface Quest {
  id: string
  title: string
  description: string
  type: QuestType
  giver: string
  giverPort: PortId
  status?: QuestStatus
  rank?: QuestRank
  deadlineDay?: number
  acceptedDay?: number
  completedDay?: number
  failedReason?: string
  requiredLevel?: number
  requiredFame?: number
  requiredSkill?: { skillId: SkillId; rank: number }
  prerequisiteQuests?: string[]
  rewards: QuestReward[]
  objectives: QuestObjective[]
  metadata?: QuestMetadata
}

export interface QuestReward {
  type: 'money' | 'fame' | 'exp' | 'item' | 'skill' | 'influence'
  amount?: number
  itemId?: string
  portId?: string
}

export interface QuestObjective {
  type: QuestObjectiveType
  target: string
  count: number
  current: number
  description: string
}

export type QuestObjectiveType =
  | 'visit_port'
  | 'deliver_item'
  | 'discover'
  | 'defeat_enemy'
  | 'trade'
  | 'talk_npc'
  | 'buy_item'
  | 'sell_item'

export interface QuestMetadata {
  category?: QuestCategory
  sourcePortId?: string
  destinationPortId?: string
  reportPortId?: string
  goodId?: string
  quantity?: number
  delivered?: boolean
  purchased?: boolean
  soldQuantity?: number
  combatTargetFleetId?: string
  combatTargetName?: string
  combatTargetAppearancePortId?: string
  combatTargetPatrolPortId?: string
  combatTargetExisting?: boolean
  combatTargetFleet?: NpcFleetDefinition
  discoveryId?: string
  discoveryName?: string
  discoveryMethod?: DiscoveryMethod
  discoveryHint?: string
  discoveryRadiusKm?: number
  discoverySkillId?: SkillId
}

