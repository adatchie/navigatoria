import type { Heading, PortId, Position2D, ShipId } from './common.ts'
import type { Nationality } from './character.ts'

export type NpcFleetRole =
  | 'merchant'
  | 'naval'
  | 'privateer'
  | 'corsair'
  | 'explorer'
  | 'smuggler'

export type NpcFleetInteractionTag =
  | 'battle'
  | 'letter_delivery'
  | 'trade_tip'
  | 'escort'
  | 'rumor'

export interface NpcFleetDefinition {
  id: string
  name: string
  commander: string
  nationality: Nationality
  role: NpcFleetRole
  shipTypeId: ShipId
  shipCount?: number
  routePortIds: PortId[]
  appearancePortId?: PortId
  patrolPortId?: PortId
  speedKnots: number
  departureOffsetDays: number
  dwellDays: number
  laneOffsetKm: number
  description: string
  interactionTags: NpcFleetInteractionTag[]
  questOnly?: boolean
}

export interface NpcFleetSnapshot {
  definition: NpcFleetDefinition
  position: Position2D
  heading: Heading
  fromPortId: PortId
  toPortId: PortId
  segmentProgress: number
  cycleProgress: number
  distanceKm: number
  inPort: boolean
}
