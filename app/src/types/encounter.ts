import type { WeatherType } from './common.ts'

export type EncounterType = 'pirate' | 'navy' | 'merchant' | 'derelict'

export interface EncounterLoot {
  itemId: string
  quantity: number
}
export type EncounterAction = 'engage' | 'evade' | 'ignore'
export type CombatAction = 'cannon' | 'board' | 'withdraw'
export type CombatDistance = 'long' | 'close' | 'boarded'
export type CombatPhase = 'battle' | 'resolved'

export interface EncounterOutcome {
  message: string
  moneyDelta: number
  fameDelta: number
  tradeExpDelta: number
  combatExpDelta: number
  adventureExpDelta: number
  notorietyDelta: number
  loot?: EncounterLoot[]
}

export interface CombatRoundLog {
  round: number
  action: CombatAction
  summary: string
  playerDamage: number
  enemyDamage: number
  playerCrewLoss: number
  enemyCrewLoss: number
}

export interface EncounterCombatState {
  phase: CombatPhase
  round: number
  distance: CombatDistance
  playerStartDurability: number
  playerStartCrew: number
  playerStartMorale: number
  playerDurability: number
  playerMaxDurability: number
  playerCrew: number
  playerMaxCrew: number
  playerMorale: number
  enemyDurability: number
  enemyMaxDurability: number
  enemyCrew: number
  enemyMaxCrew: number
  log: CombatRoundLog[]
  result?: EncounterOutcome
}

export interface EncounterState {
  id: string
  type: EncounterType
  title: string
  description: string
  shipName: string
  shipClass?: string
  enemyShipTypeId?: string
  threat: number
  enemyCrew: number
  enemyDurability: number
  enemyCannonSlots: number
  enemySpeed: number
  enemyTurnRate: number
  distanceKm: number
  zoneName?: string
  weatherType: WeatherType
  recommendedAction: EncounterAction
  lootHint?: string
  startedAtDay: number
}
