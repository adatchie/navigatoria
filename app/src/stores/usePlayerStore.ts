// ============================================================
// usePlayerStore — プレイヤーデータ管理
// ============================================================

import { create } from 'zustand'
import type { Officer, Player } from '@/types/character.ts'
import type { WeatherType } from '@/types/common.ts'
import type { CargoSlot, OfficerRoleSlot, ShipInstance, ShipOfficerAssignments, ShipSupplies, ShipType } from '@/types/ship.ts'
import { INITIAL_PLAYER, VOYAGE_CONFIG } from '@/config/gameConfig.ts'
import { createShipId, type CharacterId, type Position2D } from '@/types/common.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { getPortWorldPosition } from '@/data/master/portWorldPosition.ts'
import { getOfficerShipEffects } from '@/game/officers/officerEffects.ts'
import { localizeOfficerName } from '@/game/officers/officerGenerator.ts'
import { applyExperienceToPlayer, formatLevelUpNotice, normalizePlayerProgression, type ExperienceTrack, type LevelUpEntry } from '@/game/player/progression.ts'

type TavernService = 'meal' | 'rounds' | 'recruit'
type RepairMode = 'emergency' | 'standard' | 'overhaul'

export const SUPPLY_UNIT_COSTS = {
  food: 3,
  water: 2,
} as const
const FOOD_UNIT_COST = SUPPLY_UNIT_COSTS.food
const WATER_UNIT_COST = SUPPLY_UNIT_COSTS.water
const CREW_HIRE_COST = 18
const DEFAULT_MORALE = 72
const MAX_FLEET_SHIPS = 5
const START_PORT_POSITION = getPortWorldPosition(INITIAL_PLAYER.START_PORT)

interface PortActionResult {
  ok: boolean
  message: string
}

interface PlayerStoreState {
  player: Player | null
  ships: ShipInstance[]
  officers: Officer[]
  officerSalaryProgress: number
  activeShipId: string | null
  lastVoyageNotice: string | null
  lastProgressionNotice: string | null
  lastVoyageEventDay: number

  initPlayer: (name: string) => void
  setPosition: (position: Position2D) => void
  setHeading: (heading: number) => void
  addMoney: (amount: number) => void
  setMoney: (amount: number) => void
  addFame: (amount: number) => void
  addShip: (ship: ShipInstance) => void
  setActiveShip: (instanceId: string) => void
  purchaseShip: (shipTypeId: string, facilityLevel?: number) => PortActionResult
  sellShip: (instanceId: string) => PortActionResult
  updatePlayer: (partial: Partial<Player>) => void
  addInventoryItem: (itemId: string, quantity: number) => void
  sellInventoryItem: (itemId: string, quantity: number, unitPrice: number) => PortActionResult
  replaceCargo: (cargo: CargoSlot[], usedCapacity: number) => void
  consumeVoyageResources: (gameDayDelta: number) => void
  resupplyShip: (target: 'food' | 'water' | 'all', amount?: number) => PortActionResult
  hireCrew: (amount: number, targetShipId?: string) => PortActionResult
  hireOfficer: (officer: Officer) => PortActionResult
  assignOfficerToShip: (officerId: string, targetShipId: string) => PortActionResult
  unassignOfficer: (officerId: string) => PortActionResult
  assignOfficerToRole: (officerId: string, role: OfficerRoleSlot, targetShipId?: string) => PortActionResult
  unassignOfficerRole: (role: OfficerRoleSlot, targetShipId?: string) => PortActionResult
  visitTavern: (service: TavernService, amount?: number, tavernLevel?: number, targetShipId?: string) => PortActionResult
  repairShip: (mode?: RepairMode, amount?: number, facilityLevel?: number, targetShipId?: string) => PortActionResult
  repairFleet: (mode?: RepairMode, amount?: number, facilityLevel?: number) => PortActionResult
  outfitShip: (option: 'rigging' | 'cargo' | 'gunnery', targetShipId?: string) => PortActionResult
  resolveVoyageEvent: (currentDay: number, weatherType: WeatherType) => void
  logEncounterEvent: (message: string) => void
  clearVoyageNotice: () => void
  grantExperience: (gains: Partial<Record<ExperienceTrack, number>>, options?: { applyProfessionModifier?: boolean }) => LevelUpEntry[]
  clearProgressionNotice: () => void
  debugSetLevel: (type: 'adventure' | 'trade' | 'combat', level: number) => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function createInitialSupplies(maxCrew: number): ShipSupplies {
  const maxFood = Math.max(24, maxCrew * 3)
  const maxWater = Math.max(24, maxCrew * 3)
  return {
    food: Math.round(maxFood * 0.75),
    water: Math.round(maxWater * 0.75),
    maxFood,
    maxWater,
    attritionProgress: 0,
    damageProgress: 0,
  }
}

function getShipSupplies(ship: ShipInstance): ShipSupplies {
  return ship.supplies ?? createInitialSupplies(ship.maxCrew)
}

function getShipMorale(ship: ShipInstance): number {
  return clamp(ship.morale ?? DEFAULT_MORALE, 0, 100)
}

interface ShipRepairPlan {
  repaired: number
  totalCost: number
  moraleBonus: number
  nextAttrition: number
  nextDamage: number
  label: string
}

function planShipRepair(ship: ShipInstance, officers: Officer[], mode: RepairMode, amount: number | undefined, facilityLevel: number): ShipRepairPlan | null {
  const level = clamp(facilityLevel, 1, 5)
  const missing = ship.maxDurability - ship.currentDurability
  if (missing <= 0) return null

  const supplies = getShipSupplies(ship)
  const requested = amount && amount > 0 ? Math.min(amount, missing) : missing

  let repaired = requested
  let costPerPoint: number = VOYAGE_CONFIG.STANDARD_REPAIR_COST_PER_POINT
  let moraleBonus = 0
  let nextAttrition = supplies.attritionProgress
  let nextDamage = supplies.damageProgress
  let label = '修理'

  if (mode === 'emergency') {
    repaired = Math.min(missing, Math.max(4, Math.floor(requested * (VOYAGE_CONFIG.EMERGENCY_REPAIR_EFFICIENCY + level * 0.03))))
    costPerPoint = Math.max(2, VOYAGE_CONFIG.EMERGENCY_REPAIR_COST_PER_POINT - Math.floor(level / 2))
    moraleBonus = -2
    label = '応急修理'
  } else if (mode === 'overhaul') {
    repaired = missing
    costPerPoint = Math.max(VOYAGE_CONFIG.STANDARD_REPAIR_COST_PER_POINT, VOYAGE_CONFIG.OVERHAUL_COST_PER_POINT - Math.floor(level / 2))
    moraleBonus = 8 + level
    nextAttrition = Math.max(0, supplies.attritionProgress - 1.2 * level)
    nextDamage = 0
    label = 'オーバーホール'
  } else {
    costPerPoint = Math.max(2, VOYAGE_CONFIG.STANDARD_REPAIR_COST_PER_POINT - Math.floor(level / 2))
    moraleBonus = level >= 3 ? 2 : 0
  }

  const officerEffects = getOfficerShipEffects(ship, officers)
  repaired = Math.min(missing, Math.max(1, Math.floor(repaired * officerEffects.repairFactor)))

  return {
    repaired,
    totalCost: repaired * costPerPoint,
    moraleBonus,
    nextAttrition,
    nextDamage,
    label,
  }
}

function applyShipRepair(ship: ShipInstance, plan: ShipRepairPlan): ShipInstance {
  const supplies = getShipSupplies(ship)
  return {
    ...ship,
    currentDurability: Math.min(ship.maxDurability, ship.currentDurability + plan.repaired),
    morale: clamp(getShipMorale(ship) + plan.moraleBonus, 0, 100),
    supplies: {
      ...supplies,
      attritionProgress: plan.nextAttrition,
      damageProgress: plan.nextDamage,
    },
  }
}

function getFleetSupplyTotals(ships: ShipInstance[]): ShipSupplies {
  return ships.reduce(
    (total, ship) => {
      const supplies = getShipSupplies(ship)
      return {
        food: total.food + supplies.food,
        water: total.water + supplies.water,
        maxFood: total.maxFood + supplies.maxFood,
        maxWater: total.maxWater + supplies.maxWater,
        attritionProgress: total.attritionProgress + supplies.attritionProgress,
        damageProgress: total.damageProgress + supplies.damageProgress,
      }
    },
    { food: 0, water: 0, maxFood: 0, maxWater: 0, attritionProgress: 0, damageProgress: 0 },
  )
}

function consumeFleetSupply(
  ships: ShipInstance[],
  resource: 'food' | 'water',
  amount: number,
): { ships: ShipInstance[]; shortage: number } {
  let remaining = Math.max(0, amount)
  const nextShips = ships.map((ship) => {
    if (remaining <= 0) return ship
    const supplies = getShipSupplies(ship)
    const available = supplies[resource]
    const consumed = Math.min(available, remaining)
    remaining -= consumed
    return {
      ...ship,
      supplies: {
        ...supplies,
        [resource]: Math.round((available - consumed) * 100) / 100,
      },
    }
  })

  return { ships: nextShips, shortage: remaining }
}

function addFleetSupply(
  ships: ShipInstance[],
  resource: 'food' | 'water',
  amount: number,
): { ships: ShipInstance[]; added: number } {
  let remaining = Math.max(0, amount)
  let added = 0
  const maxKey = resource === 'food' ? 'maxFood' : 'maxWater'
  const nextShips = ships.map((ship) => {
    if (remaining <= 0) return ship
    const supplies = getShipSupplies(ship)
    const missing = Math.max(0, supplies[maxKey] - supplies[resource])
    const take = Math.min(missing, remaining)
    remaining -= take
    added += take
    return {
      ...ship,
      supplies: {
        ...supplies,
        [resource]: Math.round((supplies[resource] + take) * 100) / 100,
      },
    }
  })

  return { ships: nextShips, added }
}

function applyShortageEffects(ship: ShipInstance, shortage: number): ShipInstance {
  const supplies = getShipSupplies(ship)
  if (shortage <= 0) {
    return {
      ...ship,
      morale: clamp(getShipMorale(ship), 0, 100),
      supplies: {
        ...supplies,
        attritionProgress: Math.max(0, supplies.attritionProgress * 0.5),
        damageProgress: Math.max(0, supplies.damageProgress * 0.5),
      },
    }
  }

  const nextAttrition = supplies.attritionProgress + shortage
  const nextDamage = supplies.damageProgress + shortage * VOYAGE_CONFIG.SHORTAGE_DURABILITY_DAMAGE_FACTOR
  const crewLoss = Math.min(ship.currentCrew, Math.floor(nextAttrition))
  const durabilityLoss = Math.min(ship.currentDurability, Math.floor(nextDamage))

  return {
    ...ship,
    currentCrew: Math.max(0, ship.currentCrew - crewLoss),
    currentDurability: Math.max(1, ship.currentDurability - durabilityLoss),
    supplies: {
      ...supplies,
      attritionProgress: nextAttrition - crewLoss,
      damageProgress: nextDamage - durabilityLoss,
    },
  }
}

function createShipInstanceFromType(shipType: ShipType, instanceId: string, name?: string): ShipInstance {
  const maxCrew = shipType.crew.max
  return {
    instanceId,
    typeId: shipType.id,
    name: name ?? shipType.name,
    material: 'oak',
    currentDurability: shipType.durability.max,
    maxDurability: shipType.durability.max,
    currentCrew: shipType.crew.min,
    maxCrew,
    morale: DEFAULT_MORALE,
    parts: [],
    cargo: [],
    usedCapacity: 0,
    maxCapacity: shipType.capacity,
    supplies: createInitialSupplies(maxCrew),
    reinforceCount: 0,
    maxReinforce: 5,
    upgrades: { rigging: 0, cargo: 0, gunnery: 0 },
  }
}

function createNextShipInstanceId(ships: ShipInstance[]): string {
  const usedIds = new Set(ships.map((ship) => ship.instanceId))
  const maxNumber = ships.reduce((max, ship) => {
    const match = /^ship_(\d+)$/.exec(ship.instanceId)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  let nextNumber = maxNumber + 1
  let nextId = 'ship_' + String(nextNumber).padStart(3, '0')
  while (usedIds.has(nextId)) {
    nextNumber += 1
    nextId = 'ship_' + String(nextNumber).padStart(3, '0')
  }
  return nextId
}

export function ensureUniqueShipInstanceIds(ships: ShipInstance[], activeShipId: string | null): { ships: ShipInstance[]; activeShipId: string | null } {
  const seen = new Set<string>()
  const usedIds = new Set(ships.map((ship) => ship.instanceId))
  let nextNumber = ships.reduce((max, ship) => {
    const match = /^ship_(\d+)$/.exec(ship.instanceId)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0) + 1
  let activeAlreadyKept = false

  function takeFreshId(): string {
    let nextId = 'ship_' + String(nextNumber).padStart(3, '0')
    while (usedIds.has(nextId) || seen.has(nextId)) {
      nextNumber += 1
      nextId = 'ship_' + String(nextNumber).padStart(3, '0')
    }
    usedIds.add(nextId)
    nextNumber += 1
    return nextId
  }

  const nextShips = ships.map((ship) => {
    const isDuplicate = seen.has(ship.instanceId)
    const shouldKeepActiveId = ship.instanceId === activeShipId && !activeAlreadyKept && !isDuplicate
    if (ship.instanceId === activeShipId && !activeAlreadyKept && !isDuplicate) activeAlreadyKept = true
    if (!isDuplicate || shouldKeepActiveId) {
      seen.add(ship.instanceId)
      return ship
    }

    const nextId = takeFreshId()
    seen.add(nextId)
    return { ...ship, instanceId: nextId }
  })

  const resolvedActiveShipId = nextShips.some((ship) => ship.instanceId === activeShipId)
    ? activeShipId
    : nextShips[0]?.instanceId ?? null
  return { ships: nextShips, activeShipId: resolvedActiveShipId }
}

function getShipyardRequirement(shipType: ShipType): number {
  if (shipType.category === 'small_sail') return 1
  if (shipType.category === 'medium_sail' || shipType.category === 'galley') return 2
  if (shipType.category === 'oriental') return 3
  return 4
}

function getShipSalePrice(ship: ShipInstance, shipType: ShipType): number {
  const durabilityRatio = ship.currentDurability / Math.max(1, ship.maxDurability)
  const upgradeValue = (ship.upgrades?.rigging ?? 0) * 1200 + (ship.upgrades?.cargo ?? 0) * 1400 + (ship.upgrades?.gunnery ?? 0) * 1600
  return Math.max(250, Math.round((shipType.price * 0.48 + upgradeValue) * (0.72 + durabilityRatio * 0.28)))
}

function getShipAssignments(ship: ShipInstance): ShipOfficerAssignments {
  return {
    ...(ship.officerAssignments ?? {}),
    ...(ship.captainOfficerId ? { captain: ship.captainOfficerId } : {}),
  }
}

function withShipAssignments(ship: ShipInstance, assignments: ShipOfficerAssignments): ShipInstance {
  const nextAssignments = { ...assignments }
  const captainOfficerId = nextAssignments.captain
  if (!captainOfficerId) delete nextAssignments.captain
  return {
    ...ship,
    captainOfficerId,
    officerAssignments: Object.keys(nextAssignments).length > 0 ? nextAssignments : undefined,
  }
}

function removeOfficerFromShipAssignments(ship: ShipInstance, officerId: string): ShipInstance {
  const assignments = getShipAssignments(ship)
  for (const [role, assignedOfficerId] of Object.entries(assignments) as [OfficerRoleSlot, string][]) {
    if (assignedOfficerId === officerId) delete assignments[role]
  }
  return withShipAssignments(ship, assignments)
}

function assignOfficerRoleToShip(ship: ShipInstance, role: OfficerRoleSlot, officerId: string): ShipInstance {
  return withShipAssignments(ship, { ...getShipAssignments(ship), [role]: officerId })
}

function unassignOfficerRoleFromShip(ship: ShipInstance, role: OfficerRoleSlot): ShipInstance {
  const assignments = getShipAssignments(ship)
  delete assignments[role]
  return withShipAssignments(ship, assignments)
}

function getRoleLabel(role: OfficerRoleSlot): string {
  if (role === 'captain') return '船長'
  if (role === 'navigator') return '航海長'
  if (role === 'quartermaster') return '主計長'
  if (role === 'gunner') return '砲術長'
  if (role === 'shipwright') return '船大工'
  return '副官'
}

function preserveLevelFloor(previous: Player, next: Player): Player {
  return {
    ...next,
    stats: {
      ...next.stats,
      adventureLevel: Math.max(previous.stats.adventureLevel, next.stats.adventureLevel),
      tradeLevel: Math.max(previous.stats.tradeLevel, next.stats.tradeLevel),
      combatLevel: Math.max(previous.stats.combatLevel, next.stats.combatLevel),
    },
  }
}


export const usePlayerStore = create<PlayerStoreState>()((set, get) => ({
  player: null,
  ships: [],
  officers: [],
  officerSalaryProgress: 0,
  activeShipId: null,
  lastVoyageNotice: null,
  lastProgressionNotice: null,
  lastVoyageEventDay: -1,

  initPlayer: (name) => {
    const dataStore = useDataStore.getState()
    const starterType = dataStore.getShip(createShipId('barca'))
    const starterTypes = ['barca', 'caravela_latina', 'pinnace', 'dhow', 'galley']
      .map((id) => dataStore.getShip(createShipId(id)))
      .filter((shipType): shipType is ShipType => Boolean(shipType))
      .slice(0, MAX_FLEET_SHIPS)
    const fallbackMaxCrew = starterType?.crew.max ?? 12
    const fallbackShip: ShipInstance = {
      instanceId: 'ship_001',
      typeId: createShipId('barca'),
      name: 'サンタ・リスボア',
      material: 'oak' as const,
      currentDurability: 120,
      maxDurability: 120,
      currentCrew: 12,
      maxCrew: fallbackMaxCrew,
      morale: DEFAULT_MORALE,
      parts: [],
      cargo: [],
      usedCapacity: 0,
      maxCapacity: 30,
      supplies: createInitialSupplies(fallbackMaxCrew),
      reinforceCount: 0,
      maxReinforce: 5,
      upgrades: { rigging: 0, cargo: 0, gunnery: 0 },
    }
    const starterShips = starterTypes.length > 0
      ? starterTypes.map((shipType, index) => createShipInstanceFromType(
          shipType,
          'ship_' + String(index + 1).padStart(3, '0'),
          index === 0 ? shipType.name + '一号' : shipType.name + String(index + 1) + '号',
        ))
      : [fallbackShip]

    const player: Player = {
      id: 'player_001' as CharacterId,
      name,
      nationality: INITIAL_PLAYER.START_NATIONALITY,
      profession: 'adventurer',
      stats: {
        adventureLevel: INITIAL_PLAYER.ADVENTURE_LEVEL,
        tradeLevel: INITIAL_PLAYER.TRADE_LEVEL,
        combatLevel: INITIAL_PLAYER.COMBAT_LEVEL,
        adventureExp: 0,
        tradeExp: 0,
        combatExp: 0,
        hp: INITIAL_PLAYER.HP,
        maxHp: INITIAL_PLAYER.HP,
        fame: 0,
        notoriety: 0,
      },
      skills: [],
      money: INITIAL_PLAYER.MONEY,
      deposit: 0,
      debt: 0,
      inventory: [],
      discoveredDiscoveryIds: [],
      currentPortId: INITIAL_PLAYER.START_PORT,
      position: START_PORT_POSITION,
      heading: 0,
    }
    set({ player, ships: starterShips, officers: [], officerSalaryProgress: 0, activeShipId: starterShips[0].instanceId, lastVoyageNotice: null, lastProgressionNotice: null, lastVoyageEventDay: -1 })
  },

  setPosition: (position) => {
    const { player } = get()
    if (!player) return
    set({ player: { ...player, position } })
  },

  setHeading: (heading) => {
    const { player } = get()
    if (!player) return
    set({ player: { ...player, heading } })
  },

  addMoney: (amount) => {
    const { player } = get()
    if (!player) return
    set({ player: { ...player, money: player.money + amount } })
  },

  setMoney: (amount) => {
    const { player } = get()
    if (!player) return
    set({ player: { ...player, money: amount } })
  },

  addFame: (amount) => {
    const { player } = get()
    if (!player) return
    set({ player: { ...player, stats: { ...player.stats, fame: player.stats.fame + amount } } })
  },

  addShip: (ship) => {
    set((state) => {
      if (state.ships.length >= MAX_FLEET_SHIPS) return state
      return { ships: [...state.ships, ship] }
    })
  },

  setActiveShip: (instanceId) => {
    set((state) => {
      const normalizedFleet = ensureUniqueShipInstanceIds(state.ships, state.activeShipId)
      if (!normalizedFleet.ships.some((ship) => ship.instanceId === instanceId)) {
        return { ...state, ...normalizedFleet }
      }
      return {
        ...normalizedFleet,
        activeShipId: instanceId,
        ships: normalizedFleet.ships.map((ship) => ship.instanceId === instanceId ? unassignOfficerRoleFromShip(ship, 'captain') : ship),
      }
    })
  },

  purchaseShip: (shipTypeId, facilityLevel = 1) => {
    const state = get()
    const player = state.player
    if (!player) return { ok: false, message: '船を購入できる状態ではありません。' }

    const shipType = useDataStore.getState().getShip(shipTypeId)
    if (!shipType) return { ok: false, message: '船種データが見つかりません。' }

    const availableLevel = Math.max(player.stats.tradeLevel, player.stats.combatLevel, player.stats.adventureLevel)
    if (availableLevel < shipType.requiredLevel) return { ok: false, message: shipType.name + ' の購入にはレベル ' + shipType.requiredLevel + ' が必要です。' }

    const requiredFacilityLevel = getShipyardRequirement(shipType)
    if (facilityLevel < requiredFacilityLevel) return { ok: false, message: shipType.name + ' は造船所 Lv.' + requiredFacilityLevel + ' 以上でないと建造できません。' }

    if (state.ships.some((ship) => ship.typeId === shipType.id)) return { ok: false, message: shipType.name + ' はすでに保有しています。' }
    if (state.ships.length >= MAX_FLEET_SHIPS) return { ok: false, message: `艦隊に加えられる船は最大 ${MAX_FLEET_SHIPS} 隻までです。` }
    if (player.money < shipType.price) return { ok: false, message: '所持金が足りません。' }

    const normalizedFleet = ensureUniqueShipInstanceIds(state.ships, state.activeShipId)
    const instanceId = createNextShipInstanceId(normalizedFleet.ships)
    const ship = createShipInstanceFromType(shipType, instanceId, shipType.name + String(normalizedFleet.ships.length + 1) + '号')

    set((current) => {
      const normalizedCurrentFleet = ensureUniqueShipInstanceIds(current.ships, current.activeShipId)
      return {
        player: current.player ? { ...current.player, money: current.player.money - shipType.price } : current.player,
        ships: [...normalizedCurrentFleet.ships, ship],
        activeShipId: normalizedCurrentFleet.activeShipId ?? ship.instanceId,
      }
    })

    return { ok: true, message: shipType.name + ' を購入しました。' }
  },

  sellShip: (instanceId) => {
    const currentState = get()
    const normalizedFleet = ensureUniqueShipInstanceIds(currentState.ships, currentState.activeShipId)
    if (normalizedFleet.ships !== currentState.ships || normalizedFleet.activeShipId !== currentState.activeShipId) {
      set({ ships: normalizedFleet.ships, activeShipId: normalizedFleet.activeShipId })
    }
    const state = { ...get(), ships: normalizedFleet.ships, activeShipId: normalizedFleet.activeShipId }
    const player = state.player
    if (!player) return { ok: false, message: '船を売却できる状態ではありません。' }
    if (state.ships.length <= 1) return { ok: false, message: '最後の1隻は売却できません。' }
    if (instanceId === state.activeShipId) return { ok: false, message: '旗艦は売却できません。先に別の船を旗艦にしてください。' }

    const ship = state.ships.find((entry) => entry.instanceId === instanceId)
    if (!ship) return { ok: false, message: '売却する船が見つかりません。' }
    if (ship.cargo.length > 0 || ship.usedCapacity > 0) return { ok: false, message: '積荷が残っている船は売却できません。先に積荷を売却してください。' }

    const shipType = useDataStore.getState().getShip(ship.typeId)
    if (!shipType) return { ok: false, message: '船種データが見つかりません。' }

    const salePrice = getShipSalePrice(ship, shipType)
    const assignedOfficerIds = new Set(Object.values(getShipAssignments(ship)).filter(Boolean))
    set((current) => ({
      player: current.player ? { ...current.player, money: current.player.money + salePrice } : current.player,
      ships: current.ships.filter((entry) => entry.instanceId !== instanceId),
      officers: current.officers.map((officer) => assignedOfficerIds.has(officer.id) ? { ...officer, assignedShipId: undefined, role: undefined } : officer),
    }))

    return { ok: true, message: `${shipType.name} を ${salePrice} d で売却しました。` }
  },

  updatePlayer: (partial) => {
    const { player } = get()
    if (!player) return
    set({ player: { ...player, ...partial } })
  },

  addInventoryItem: (itemId, quantity) => {
    if (quantity <= 0) return
    set((state) => {
      if (!state.player) return state
      const existing = state.player.inventory.find((item) => item.itemId === itemId)
      const inventory = existing
        ? state.player.inventory.map((item) => item.itemId === itemId ? { ...item, quantity: item.quantity + quantity } : item)
        : [...state.player.inventory, { itemId, quantity }]
      return { player: { ...state.player, inventory } }
    })
  },
  sellInventoryItem: (itemId, quantity, unitPrice) => {
    if (quantity <= 0 || unitPrice <= 0) {
      return { ok: false, message: '数量または価格が不正です。' }
    }
    let soldAmount = 0
    set((state) => {
      if (!state.player) return state
      const existing = state.player.inventory.find((item) => item.itemId === itemId)
      if (!existing) return state
      const take = Math.min(existing.quantity, quantity)
      if (take <= 0) return state
      soldAmount = take
      const nextInventory = existing.quantity === take
        ? state.player.inventory.filter((item) => item.itemId !== itemId)
        : state.player.inventory.map((item) => (item.itemId === itemId ? { ...item, quantity: item.quantity - take } : item))
      return {
        player: {
          ...state.player,
          money: state.player.money + take * unitPrice,
          inventory: nextInventory,
        },
      }
    })
    if (soldAmount <= 0) {
      return { ok: false, message: 'アイテムが在庫にありません。' }
    }
    const tradeGood = useDataStore.getState().getTradeGood(itemId)
    const name = tradeGood?.name ?? itemId
    return { ok: true, message: `${name} x${soldAmount} を売却し、${soldAmount * unitPrice} d を獲得しました。` }
  },

  replaceCargo: (cargo, usedCapacity) => {
    set((state) => ({
      ships: state.ships.map((ship) => ship.instanceId !== state.activeShipId ? ship : { ...ship, cargo, usedCapacity }),
    }))
  },

  consumeVoyageResources: (gameDayDelta) => {
    if (gameDayDelta <= 0) return

    set((state) => {
      const totalCrew = state.ships.reduce((sum, ship) => sum + ship.currentCrew, 0)
      const foodUse = totalCrew * VOYAGE_CONFIG.FOOD_CONSUMPTION_PER_CREW_PER_DAY * gameDayDelta
      const waterUse = totalCrew * VOYAGE_CONFIG.WATER_CONSUMPTION_PER_CREW_PER_DAY * gameDayDelta
      const foodResult = consumeFleetSupply(state.ships, 'food', foodUse)
      const waterResult = consumeFleetSupply(foodResult.ships, 'water', waterUse)
      const shortage =
        waterResult.shortage * VOYAGE_CONFIG.DEHYDRATION_ATTRITION_FACTOR +
        foodResult.shortage * VOYAGE_CONFIG.STARVATION_ATTRITION_FACTOR
      const monthlyOfficerSalary = state.officers.reduce((sum, officer) => sum + officer.salary, 0)
      const dailyOfficerSalary = monthlyOfficerSalary / VOYAGE_CONFIG.OFFICER_SALARY_DAYS_PER_MONTH
      const salaryDue = state.officerSalaryProgress + dailyOfficerSalary * gameDayDelta
      const payableSalary = Math.floor(salaryDue)
      const paidSalary = Math.min(state.player?.money ?? 0, payableSalary)
      const unpaidSalary = Math.max(0, payableSalary - paidSalary)
      const salaryMoraleLoss = unpaidSalary > 0 ? Math.min(6, unpaidSalary / Math.max(1, dailyOfficerSalary) * 8) : 0

      const ships = waterResult.ships.map((ship) => {
        const crewShare = totalCrew > 0 ? ship.currentCrew / totalCrew : 1 / Math.max(1, waterResult.ships.length)
        const officerEffects = getOfficerShipEffects(ship, state.officers)
        const moraleLoss = (VOYAGE_CONFIG.PASSIVE_MORALE_LOSS_PER_DAY * gameDayDelta + shortage * VOYAGE_CONFIG.SHORTAGE_MORALE_DAMAGE_FACTOR * crewShare) * officerEffects.moraleLossFactor + salaryMoraleLoss * crewShare
        const depleted = applyShortageEffects({
          ...ship,
          morale: clamp(getShipMorale(ship) - moraleLoss, 0, 100),
        }, shortage * crewShare)
        return {
          ...depleted,
          morale: clamp(depleted.morale ?? getShipMorale(ship), 0, 100),
        }
      })

      return {
        player: state.player && paidSalary > 0 ? { ...state.player, money: state.player.money - paidSalary } : state.player,
        ships,
        officerSalaryProgress: salaryDue - paidSalary,
      }
    })
  },

  resupplyShip: (target, amount = 0) => {
    const state = get()
    const player = state.player
    if (!player || state.ships.length === 0) return { ok: false, message: '補給対象の船が見つかりません。' }

    const supplies = getFleetSupplyTotals(state.ships)
    const desiredFood = target === 'water'
      ? 0
      : amount > 0
        ? Math.min(amount, supplies.maxFood - supplies.food)
        : supplies.maxFood - supplies.food
    const desiredWater = target === 'food'
      ? 0
      : amount > 0
        ? Math.min(amount, supplies.maxWater - supplies.water)
        : supplies.maxWater - supplies.water
    const foodUnits = Math.ceil(desiredFood)
    const waterUnits = Math.ceil(desiredWater)
    const totalCost = foodUnits * FOOD_UNIT_COST + waterUnits * WATER_UNIT_COST
    if (desiredFood <= 0 && desiredWater <= 0) return { ok: false, message: '食料・水はすでに満タンです。' }
    if (player.money < totalCost) {
      return {
        ok: false,
        message: `所持金が足りません。必要 ${totalCost} d / 所持 ${player.money} d / 不足 ${totalCost - player.money} d`,
      }
    }

    set((current) => ({
      player: current.player ? { ...current.player, money: current.player.money - totalCost } : current.player,
      ships: addFleetSupply(
        addFleetSupply(current.ships, 'food', desiredFood).ships,
        'water',
        desiredWater,
      ).ships,
    }))

    return { ok: true, message: `食料 ${foodUnits}・水 ${waterUnits} を補給しました。（${totalCost} d）` }
  },

  hireCrew: (amount, targetShipId) => {
    const state = get()
    const player = state.player
    const targetId = targetShipId ?? state.activeShipId
    const ship = state.ships.find((entry) => entry.instanceId === targetId)
    if (!player || !ship) return { ok: false, message: '雇用対象の船が見つかりません。' }
    if (amount <= 0) return { ok: false, message: '雇用人数を指定してください。' }

    const hireable = Math.min(amount, ship.maxCrew - ship.currentCrew)
    if (hireable <= 0) return { ok: false, message: 'これ以上船員を雇えません。' }
    const totalCost = hireable * CREW_HIRE_COST
    if (player.money < totalCost) return { ok: false, message: '所持金が足りません。' }

    set((current) => ({
      player: current.player ? { ...current.player, money: current.player.money - totalCost } : current.player,
      ships: current.ships.map((entry) => entry.instanceId !== targetId ? entry : {
        ...entry,
        currentCrew: entry.currentCrew + hireable,
      }),
    }))

    return { ok: true, message: `船員を ${hireable} 人雇用しました。` }
  },

  hireOfficer: (officer) => {
    const state = get()
    const player = state.player
    const localizedOfficer = { ...officer, name: localizeOfficerName(officer.name) }
    if (!player) return { ok: false, message: '航海士を雇用できる状態ではありません。' }
    if (state.officers.some((entry) => entry.id === officer.id)) return { ok: false, message: `${localizedOfficer.name} はすでに雇用済みです。` }
    if (player.money < officer.hireCost) return { ok: false, message: '所持金が足りません。' }

    set((current) => ({
      player: current.player ? { ...current.player, money: current.player.money - officer.hireCost } : current.player,
      officers: [...current.officers, localizedOfficer],
    }))

    return { ok: true, message: `${localizedOfficer.name} を航海士として雇用しました。` }
  },

  assignOfficerToShip: (officerId, targetShipId) => {
    const state = get()
    const officer = state.officers.find((entry) => entry.id === officerId)
    const ship = state.ships.find((entry) => entry.instanceId === targetShipId)
    if (!officer) return { ok: false, message: '航海士が見つかりません。' }
    if (!ship) return { ok: false, message: '任命先の船が見つかりません。' }
    if (ship.instanceId === state.activeShipId) return { ok: false, message: '旗艦はプレイヤーが指揮しています。航海士は僚艦に任命してください。' }
    const officerName = localizeOfficerName(officer.name)

    set((current) => ({
      ships: current.ships.map((entry) => {
        const cleared = removeOfficerFromShipAssignments(entry, officer.id)
        if (cleared.instanceId === targetShipId) return assignOfficerRoleToShip(cleared, 'captain', officer.id)
        return cleared
      }),
    }))

    return { ok: true, message: `${officerName} を ${ship.name} の船長に任命しました。` }
  },

  unassignOfficer: (officerId) => {
    const state = get()
    const officer = state.officers.find((entry) => entry.id === officerId)
    if (!officer) return { ok: false, message: '航海士が見つかりません。' }
    const assigned = state.ships.some((ship) => Object.values(getShipAssignments(ship)).some((assignedOfficerId) => assignedOfficerId === officerId))
    const officerName = localizeOfficerName(officer.name)
    if (!assigned) return { ok: false, message: `${officerName} は任命されていません。` }

    set((current) => ({
      ships: current.ships.map((ship) => removeOfficerFromShipAssignments(ship, officerId)),
    }))

    return { ok: true, message: `${officerName} の任命を解除しました。` }
  },

  assignOfficerToRole: (officerId, role, targetShipId) => {
    const state = get()
    const officer = state.officers.find((entry) => entry.id === officerId)
    const targetId = targetShipId ?? state.activeShipId
    const ship = state.ships.find((entry) => entry.instanceId === targetId)
    if (!officer) return { ok: false, message: '航海士が見つかりません。' }
    if (!ship) return { ok: false, message: '任命先の船が見つかりません。' }
    if (role === 'captain' && ship.instanceId === state.activeShipId) return { ok: false, message: '旗艦はプレイヤーが指揮しています。航海士は僚艦の船長に任命してください。' }

    const officerName = localizeOfficerName(officer.name)
    const roleLabel = getRoleLabel(role)

    set((current) => ({
      ships: current.ships.map((entry) => {
        const cleared = removeOfficerFromShipAssignments(entry, officer.id)
        if (cleared.instanceId !== ship.instanceId) return cleared
        return assignOfficerRoleToShip(cleared, role, officer.id)
      }),
    }))

    return { ok: true, message: `${officerName} を ${ship.name} の${roleLabel}に任命しました。` }
  },

  unassignOfficerRole: (role, targetShipId) => {
    const state = get()
    const targetId = targetShipId ?? state.activeShipId
    const ship = state.ships.find((entry) => entry.instanceId === targetId)
    if (!ship) return { ok: false, message: '任命先の船が見つかりません。' }
    const assignments = getShipAssignments(ship)
    if (!assignments[role]) return { ok: false, message: `${ship.name} の${getRoleLabel(role)}は未任命です。` }

    set((current) => ({
      ships: current.ships.map((entry) => entry.instanceId === ship.instanceId ? unassignOfficerRoleFromShip(entry, role) : entry),
    }))

    return { ok: true, message: `${ship.name} の${getRoleLabel(role)}任命を解除しました。` }
  },

  visitTavern: (service, amount = 0, tavernLevel = 1, targetShipId) => {
    const state = get()
    const player = state.player
    const targetId = targetShipId ?? state.activeShipId
    const ship = state.ships.find((entry) => entry.instanceId === targetId)
    if (!player || !ship) return { ok: false, message: '酒場で対応する船が見つかりません。' }

    const level = clamp(tavernLevel, 1, 5)
    const morale = getShipMorale(ship)

    if (service === 'meal') {
      const cost = Math.max(20, Math.ceil(Math.max(1, ship.currentCrew) * VOYAGE_CONFIG.TAVERN_MEAL_COST_PER_CREW * (1 - level * 0.04)))
      if (player.money < cost) return { ok: false, message: '所持金が足りません。' }
      if (morale >= 100) return { ok: false, message: '士気は十分に高いです。' }

      set((current) => ({
        player: current.player ? { ...current.player, money: current.player.money - cost } : current.player,
        ships: current.ships.map((entry) => entry.instanceId !== targetId ? entry : {
          ...entry,
          morale: clamp(getShipMorale(entry) + VOYAGE_CONFIG.TAVERN_MEAL_MORALE_RECOVERY + level * 2, 0, 100),
        }),
      }))
      return { ok: true, message: '温かい食事で船員の士気が持ち直しました。' }
    }

    if (service === 'rounds') {
      const cost = Math.max(60, Math.ceil(VOYAGE_CONFIG.TAVERN_ROUND_BASE_COST * (1 + ship.maxCrew * 0.04) * (1 - level * 0.03)))
      if (player.money < cost) return { ok: false, message: '所持金が足りません。' }
      if (morale >= 100) return { ok: false, message: 'これ以上の景気づけは不要です。' }

      set((current) => ({
        player: current.player ? { ...current.player, money: current.player.money - cost } : current.player,
        ships: current.ships.map((entry) => entry.instanceId !== targetId ? entry : {
          ...entry,
          morale: clamp(getShipMorale(entry) + VOYAGE_CONFIG.TAVERN_ROUND_MORALE_RECOVERY + level * 3, 0, 100),
          supplies: {
            ...getShipSupplies(entry),
            attritionProgress: Math.max(0, getShipSupplies(entry).attritionProgress - 0.4 * level),
          },
        }),
      }))
      return { ok: true, message: '酒場で景気づけをして、船員の空気がかなり明るくなりました。' }
    }

    const recruitCount = Math.max(1, Math.floor(amount || 1))
    const hireable = Math.min(recruitCount, ship.maxCrew - ship.currentCrew)
    if (hireable <= 0) return { ok: false, message: 'これ以上船員を雇えません。' }
    const crewUnitCost = Math.max(10, CREW_HIRE_COST - level * VOYAGE_CONFIG.TAVERN_RECRUIT_DISCOUNT_PER_LEVEL)
    const totalCost = hireable * crewUnitCost
    if (player.money < totalCost) return { ok: false, message: '所持金が足りません。' }

    set((current) => ({
      player: current.player ? { ...current.player, money: current.player.money - totalCost } : current.player,
      ships: current.ships.map((entry) => entry.instanceId !== targetId ? entry : {
        ...entry,
        currentCrew: entry.currentCrew + hireable,
        morale: clamp(getShipMorale(entry) + 2 + level, 0, 100),
      }),
    }))
    return { ok: true, message: `酒場で ${hireable} 人の船員を集めました。` }
  },

  repairShip: (mode = 'standard', amount, facilityLevel = 1, targetShipId) => {
    const state = get()
    const player = state.player
    const targetId = targetShipId ?? state.activeShipId
    const ship = state.ships.find((entry) => entry.instanceId === targetId)
    if (!player || !ship) return { ok: false, message: '修理対象の船が見つかりません。' }

    const repairPlan = planShipRepair(ship, state.officers, mode, amount, facilityLevel)
    if (!repairPlan) return { ok: false, message: '修理の必要はありません。' }
    if (player.money < repairPlan.totalCost) return { ok: false, message: '所持金が足りません。' }

    set((current) => ({
      player: current.player ? { ...current.player, money: current.player.money - repairPlan.totalCost } : current.player,
      ships: current.ships.map((entry) => entry.instanceId !== targetId ? entry : applyShipRepair(entry, repairPlan)),
    }))

    return { ok: true, message: `${repairPlan.label}で耐久を ${repairPlan.repaired} 回復しました。` }
  },

  repairFleet: (mode = 'overhaul', amount, facilityLevel = 1) => {
    const state = get()
    const player = state.player
    if (!player) return { ok: false, message: '修理する艦隊が見つかりません。' }

    const repairEntries = state.ships
      .map((ship) => ({ ship, plan: planShipRepair(ship, state.officers, mode, amount, facilityLevel) }))
      .filter((entry): entry is { ship: ShipInstance; plan: ShipRepairPlan } => Boolean(entry.plan))

    if (repairEntries.length === 0) return { ok: false, message: '修理の必要はありません。' }

    const totalCost = repairEntries.reduce((sum, entry) => sum + entry.plan.totalCost, 0)
    if (player.money < totalCost) return { ok: false, message: '所持金が足りません。' }

    const plansByShipId = new Map(repairEntries.map((entry) => [entry.ship.instanceId, entry.plan]))
    const totalRepaired = repairEntries.reduce((sum, entry) => sum + entry.plan.repaired, 0)
    const label = mode === 'emergency' ? '応急修理' : mode === 'overhaul' ? 'オーバーホール' : '修理'

    set((current) => ({
      player: current.player ? { ...current.player, money: current.player.money - totalCost } : current.player,
      ships: current.ships.map((ship) => {
        const plan = plansByShipId.get(ship.instanceId)
        return plan ? applyShipRepair(ship, plan) : ship
      }),
    }))

    return { ok: true, message: `${label}で ${repairEntries.length} 隻の耐久を合計 ${totalRepaired} 回復しました。` }
  },

    outfitShip: (option = 'rigging', targetShipId) => {
      const state = get()
      const player = state.player
      const targetId = targetShipId ?? state.activeShipId
      const ship = state.ships.find((entry) => entry.instanceId === targetId)
      if (!player || !ship) return { ok: false, message: '艤装対象の船が見つかりません。' }

      const currentLevel = ship.upgrades?.[option] ?? 0
      const maxLevel = 3
      if (currentLevel >= maxLevel) return { ok: false, message: 'これ以上装備を強化できません。' }

      const baseCost = option === 'rigging' ? 320 : option === 'cargo' ? 280 : 360
      const stepIncrease = option === 'rigging' ? 90 : option === 'cargo' ? 70 : 120
      const cost = baseCost + currentLevel * stepIncrease
      if (player.money < cost) return { ok: false, message: '資金が足りません。' }

      const nextShips = state.ships.map((entry) => {
        if (entry.instanceId !== targetId) return entry
        const nextUpgrades = {
          rigging: entry.upgrades?.rigging ?? 0,
          cargo: entry.upgrades?.cargo ?? 0,
          gunnery: entry.upgrades?.gunnery ?? 0,
          [option]: currentLevel + 1,
        }
        const nextShip = {
          ...entry,
          upgrades: nextUpgrades,
          morale: clamp(entry.morale + (option === 'rigging' ? 4 : option === 'cargo' ? 2 : 3), 0, 100),
        }
        if (option === 'rigging') {
          nextShip.maxDurability = entry.maxDurability + 4
          nextShip.currentDurability = Math.min(nextShip.maxDurability, entry.currentDurability + 5)
        } else if (option === 'cargo') {
          nextShip.maxCapacity = entry.maxCapacity + 6
        } else {
          nextShip.currentDurability = Math.min(nextShip.maxDurability, entry.currentDurability + 2)
        }
        return nextShip
      })

      set({
        player: { ...player, money: player.money - cost },
        ships: nextShips,
      })

      const label = option === 'rigging' ? 'Rigging Tune' : option === 'cargo' ? 'Cargo Rig' : 'Gunnery Drill'
      return { ok: true, message: `${label} を適用しました（Lv ${currentLevel + 1}）。` }
    },

    resolveVoyageEvent: (currentDay, weatherType) => {
      const state = get()
    if (currentDay <= state.lastVoyageEventDay) return

    const ship = state.ships.find((entry) => entry.instanceId === state.activeShipId)
    if (!ship) {
      set({ lastVoyageEventDay: currentDay })
      return
    }

    const player = state.player
    const stormBonus = weatherType === 'storm' ? 0.25 : weatherType === 'rain' ? 0.08 : 0
    const eventChance = clamp(VOYAGE_CONFIG.VOYAGE_EVENT_CHANCE_PER_DAY + stormBonus, 0, 0.95)

    if (Math.random() > eventChance) {
      set({ lastVoyageEventDay: currentDay })
      return
    }

    const supplies = getShipSupplies(ship)
    const events = [
      {
        id: 'fresh-water',
        weight: weatherType === 'rain' ? 3 : 1,
        apply: () => ({
          message: '雨水を集めて水の備蓄を少し回復しました。',
          ship: {
            ...ship,
            supplies: { ...supplies, water: Math.min(supplies.maxWater, supplies.water + 10 + ship.currentCrew * 0.2) },
          },
          player,
        }),
      },
      {
        id: 'good-catch',
        weight: 2,
        apply: () => ({
          message: '釣果に恵まれ、食料の持ちが少し良くなりました。',
          ship: {
            ...ship,
            morale: clamp(getShipMorale(ship) + 4, 0, 100),
            supplies: { ...supplies, food: Math.min(supplies.maxFood, supplies.food + 8 + ship.currentCrew * 0.25) },
          },
          player,
        }),
      },
      {
        id: 'drift-cargo',
        weight: 2,
        apply: () => ({
          message: '漂流物を回収して少しばかりの金を得ました。',
          ship: { ...ship, morale: clamp(getShipMorale(ship) + 3, 0, 100), supplies },
          player: player ? { ...player, money: player.money + 180 + player.stats.tradeLevel * 25 } : player,
        }),
      },
      {
        id: 'disciplined-watch',
        weight: 2,
        apply: () => ({
          message: '見張りと当直が引き締まり、船内の統率が少し良くなりました。',
          ship: {
            ...ship,
            morale: clamp(getShipMorale(ship) + 6, 0, 100),
            supplies: {
              ...supplies,
              attritionProgress: Math.max(0, supplies.attritionProgress - 0.8),
            },
          },
          player,
        }),
      },
      {
        id: 'calm-repair',
        weight: ship.currentDurability < ship.maxDurability ? 2 : 1,
        apply: () => ({
          message: '海が穏やかだったため、航海中に軽い補修を進められました。',
          ship: {
            ...ship,
            currentDurability: Math.min(ship.maxDurability, ship.currentDurability + 4 + Math.floor(Math.random() * 4)),
            morale: clamp(getShipMorale(ship) + 2, 0, 100),
            supplies,
          },
          player,
        }),
      },
      {
        id: 'hidden-cache',
        weight: 1,
        apply: () => ({
          message: '浮標のそばで小さな補給箱を見つけ、食料と金を少し確保しました。',
          ship: {
            ...ship,
            supplies: {
              ...supplies,
              food: Math.min(supplies.maxFood, supplies.food + 6 + ship.currentCrew * 0.2),
            },
          },
          player: player ? { ...player, money: player.money + 120 } : player,
        }),
      },
      {
        id: 'spoiled-rations',
        weight: supplies.food > 8 ? 2 : 1,
        apply: () => ({
          message: '湿気で食料の一部が傷み、備蓄と士気が少し落ちました。',
          ship: {
            ...ship,
            morale: clamp(getShipMorale(ship) - 5, 0, 100),
            supplies: {
              ...supplies,
              food: Math.max(0, supplies.food - (5 + Math.floor(Math.random() * 4))),
            },
          },
          player,
        }),
      },
      {
        id: 'crew-argument',
        weight: 2,
        apply: () => ({
          message: '船内で口論が起き、士気が下がりました。',
          ship: { ...ship, morale: clamp(getShipMorale(ship) - 10, 0, 100), supplies },
          player,
        }),
      },
      {
        id: 'rigging-wear',
        weight: 2,
        apply: () => ({
          message: '索具が傷み、船体に軽い損傷が出ました。',
          ship: { ...ship, currentDurability: Math.max(1, ship.currentDurability - (4 + Math.floor(Math.random() * 5))), supplies },
          player,
        }),
      },
      {
        id: 'sickness',
        weight: ship.currentCrew > 4 ? 2 : 1,
        apply: () => {
          const crewLoss = Math.min(ship.currentCrew, 1 + Math.floor(Math.random() * 2))
          return {
            message: '体調不良が出て、船員数が少し減りました。',
            ship: { ...ship, currentCrew: Math.max(0, ship.currentCrew - crewLoss), morale: clamp(getShipMorale(ship) - 6, 0, 100), supplies },
            player,
          }
        },
      },
      {
        id: 'squall',
        weight: weatherType === 'storm' ? 4 : 1,
        apply: () => ({
          message: 'スコールに遭い、船体と士気に打撃を受けました。',
          ship: {
            ...ship,
            currentDurability: Math.max(1, ship.currentDurability - (8 + Math.floor(Math.random() * 10))),
            morale: clamp(getShipMorale(ship) - 8, 0, 100),
            supplies,
          },
          player,
        }),
      },
    ]

    const totalWeight = events.reduce((sum, event) => sum + event.weight, 0)
    let roll = Math.random() * totalWeight
    const selected = events.find((event) => {
      roll -= event.weight
      return roll <= 0
    }) ?? events[0]

    const result = selected.apply()

      set((current) => ({
        lastVoyageEventDay: currentDay,
        lastVoyageNotice: result.message,
        player: result.player ?? current.player,
        ships: current.ships.map((entry) => entry.instanceId !== current.activeShipId ? entry : {
          ...result.ship,
          morale: clamp(result.ship.morale ?? getShipMorale(entry), 0, 100),
          supplies: {
            ...getShipSupplies(entry),
            ...result.ship.supplies,
          },
        }),
      }))
    },

    logEncounterEvent: (message) => {
      set({
        lastVoyageNotice: message,
      })
    },

  clearVoyageNotice: () => set({ lastVoyageNotice: null }),

  grantExperience: (gains, options) => {
    let levelUps: LevelUpEntry[] = []
    set((state) => {
      if (!state.player) return state
      const result = applyExperienceToPlayer(state.player, gains, options)
      const normalizedPlayer = normalizePlayerProgression(result.player)
      const notice = formatLevelUpNotice(result.levelUps)
      levelUps = result.levelUps
      return {
        player: preserveLevelFloor(state.player, normalizedPlayer),
        lastProgressionNotice: notice ? `レベルアップ: ${notice}` : state.lastProgressionNotice,
      }
    })
    return levelUps
  },

  clearProgressionNotice: () => set({ lastProgressionNotice: null }),

  debugSetLevel: (type, level) => {
    const { player } = get()
    if (!player) return
    const key = `${type}Level` as 'adventureLevel' | 'tradeLevel' | 'combatLevel'
    set({ player: { ...player, stats: { ...player.stats, [key]: level } } })
  },
}))






