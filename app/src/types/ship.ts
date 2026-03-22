// ============================================================
// 船型定義 — 船種マスタ、船インスタンス、パーツ構造
// ============================================================

import type { ShipId, Range } from './common.ts'

export type ShipCategory = 'small_sail' | 'medium_sail' | 'large_sail' | 'galley' | 'oriental'

export interface ShipType {
  id: ShipId
  name: string
  nameEn: string
  category: ShipCategory
  description: string
  capacity: number
  durability: Range
  crew: Range
  cannonSlots: number
  speed: number
  turnRate: number
  verticalSails: number
  horizontalSails: number
  requiredLevel: number
  price: number
  modelId?: string
  modelPrompt?: string
}

export type ShipPartSlot =
  | 'hull'
  | 'sail_main'
  | 'sail_fore'
  | 'sail_mizzen'
  | 'cannon_left'
  | 'cannon_right'
  | 'figurehead'
  | 'flag'

export interface ShipPart {
  slot: ShipPartSlot
  name: string
  effect: Partial<ShipModifiers>
}

export interface ShipModifiers {
  speedBonus: number
  turnBonus: number
  durabilityBonus: number
  capacityBonus: number
  cannonPowerBonus: number
}

export type ShipMaterial =
  | 'redpine'
  | 'cedar'
  | 'oak'
  | 'teak'
  | 'mahogany'
  | 'rosewood'
  | 'ironwood'
  | 'steel'
  | 'iron'

export interface ShipSupplies {
  food: number
  water: number
  maxFood: number
  maxWater: number
  attritionProgress: number
  damageProgress: number
}

export interface ShipInstance {
  instanceId: string
  typeId: ShipId
  name: string
  material: ShipMaterial
  currentDurability: number
  maxDurability: number
  currentCrew: number
  maxCrew: number
  morale: number
  parts: ShipPart[]
  cargo: CargoSlot[]
  usedCapacity: number
  maxCapacity: number
  supplies: ShipSupplies
  reinforceCount: number
  maxReinforce: number
  upgrades?: {
    rigging: number
    cargo: number
    gunnery: number
  }
}

export interface CargoSlot {
  goodId: string
  quantity: number
  buyPrice: number
}
