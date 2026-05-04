import type { Heading, Position2D } from './common.ts'

export type TacticalBattlePhase =
  | 'player_targeting'
  | 'enemy_targeting'
  | 'action'
  | 'resolved'

export type TacticalShipSide = 'player' | 'enemy'
export type TacticalShipStatus = 'active' | 'disabled' | 'sunk'
export type TacticalOrderType = 'anchor' | 'move' | 'pursue'

export interface TacticalShipState {
  id: string
  side: TacticalShipSide
  name: string
  position: Position2D
  heading: Heading
  durability: number
  maxDurability: number
  crew: number
  maxCrew: number
  speed: number
  turnRate: number
  cannonSlots: number
  status: TacticalShipStatus
}

export interface TacticalShipOrder {
  shipId: string
  type: TacticalOrderType
  targetPosition?: Position2D
  targetShipId?: string
  confirmed: boolean
}

export interface TacticalWindState {
  direction: Heading
  speed: number
}

export interface TacticalBattleState {
  phase: TacticalBattlePhase
  turn: number
  elapsedSeconds: number
  wind: TacticalWindState
  ships: TacticalShipState[]
  orders: TacticalShipOrder[]
  selectedShipId?: string
}
