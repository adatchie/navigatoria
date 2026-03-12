import type { WeatherType } from './common.ts'

export type EncounterType = 'pirate' | 'navy' | 'merchant' | 'derelict'
export type EncounterAction = 'engage' | 'evade' | 'ignore'

export interface EncounterState {
  id: string
  type: EncounterType
  title: string
  description: string
  shipName: string
  threat: number
  enemyCrew: number
  enemyDurability: number
  distanceKm: number
  zoneName?: string
  weatherType: WeatherType
  recommendedAction: EncounterAction
  lootHint?: string
  startedAtDay: number
}
