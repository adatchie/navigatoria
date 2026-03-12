// ============================================================
// キャラクター型定義 — プレイヤー、NPC、スキル、職業
// ============================================================

import type { CharacterId, SkillId, Position2D } from './common.ts'

export type ProfessionType = 'adventurer' | 'trader' | 'soldier'

export interface Profession {
  id: string
  name: string
  type: ProfessionType
  description: string
  bonusSkills: SkillId[]
}

export type SkillCategory = 'adventure' | 'trade' | 'combat' | 'language' | 'life'

export interface Skill {
  id: SkillId
  name: string
  category: SkillCategory
  description: string
  maxRank: number
}

export interface SkillInstance {
  skillId: SkillId
  rank: number
  experience: number
  maxExperience: number
}

export interface CharacterStats {
  adventureLevel: number
  tradeLevel: number
  combatLevel: number
  adventureExp: number
  tradeExp: number
  combatExp: number
  hp: number
  maxHp: number
  fame: number
  notoriety: number
}

export interface PlayerItemStack {
  itemId: string
  quantity: number
}

export interface Player {
  id: CharacterId
  name: string
  nationality: Nationality
  profession: ProfessionType
  stats: CharacterStats
  skills: SkillInstance[]
  money: number
  deposit: number
  debt: number
  inventory: PlayerItemStack[]
  currentPortId?: string
  position: Position2D
  heading: number
}

export interface NPC {
  id: CharacterId
  name: string
  type: NPCType
  nationality?: Nationality
  stats?: Partial<CharacterStats>
  dialogue?: string[]
}

export type NPCType =
  | 'crew'
  | 'merchant'
  | 'guild_master'
  | 'barkeep'
  | 'shipwright'
  | 'port_official'
  | 'companion'

export type Nationality =
  | 'portugal'
  | 'spain'
  | 'england'
  | 'netherlands'
  | 'france'
  | 'venice'
  | 'ottoman'
