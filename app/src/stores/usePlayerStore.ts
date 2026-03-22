// ============================================================
// usePlayerStore — プレイヤーデータ管理
// ============================================================

import { create } from 'zustand'
import type { Player } from '@/types/character.ts'
import type { WeatherType } from '@/types/common.ts'
import type { CargoSlot, ShipInstance, ShipSupplies, ShipType } from '@/types/ship.ts'
import { INITIAL_PLAYER, VOYAGE_CONFIG } from '@/config/gameConfig.ts'
import { createShipId, type CharacterId, type Position2D } from '@/types/common.ts'
import { useDataStore } from '@/stores/useDataStore.ts'

type TavernService = 'meal' | 'rounds' | 'recruit'
type RepairMode = 'emergency' | 'standard' | 'overhaul'

const FOOD_UNIT_COST = 6
const WATER_UNIT_COST = 4
const CREW_HIRE_COST = 18
const DEFAULT_MORALE = 72

interface PortActionResult {
  ok: boolean
  message: string
}

interface PlayerStoreState {
  player: Player | null
  ships: ShipInstance[]
  activeShipId: string | null
  lastVoyageNotice: string | null
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
  updatePlayer: (partial: Partial<Player>) => void
  addInventoryItem: (itemId: string, quantity: number) => void
  sellInventoryItem: (itemId: string, quantity: number, unitPrice: number) => PortActionResult
  replaceCargo: (cargo: CargoSlot[], usedCapacity: number) => void
  consumeVoyageResources: (gameDayDelta: number) => void
  resupplyShip: (target: 'food' | 'water' | 'all', amount?: number) => PortActionResult
  hireCrew: (amount: number) => PortActionResult
  visitTavern: (service: TavernService, amount?: number, tavernLevel?: number) => PortActionResult
  repairShip: (mode?: RepairMode, amount?: number, facilityLevel?: number) => PortActionResult
  outfitShip: (option: 'rigging' | 'cargo' | 'gunnery') => PortActionResult
  resolveVoyageEvent: (currentDay: number, weatherType: WeatherType) => void
  logEncounterEvent: (message: string) => void
  clearVoyageNotice: () => void
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

function getShipyardRequirement(shipType: ShipType): number {
  if (shipType.category === 'small_sail') return 1
  if (shipType.category === 'medium_sail' || shipType.category === 'galley') return 2
  if (shipType.category === 'oriental') return 3
  return 4
}


export const usePlayerStore = create<PlayerStoreState>()((set, get) => ({
  player: null,
  ships: [],
  activeShipId: null,
  lastVoyageNotice: null,
  lastVoyageEventDay: -1,

  initPlayer: (name) => {
    const starterType = useDataStore.getState().getShip(createShipId('balsa'))
    const maxCrew = starterType?.crew.max ?? 12
    const starterShip = starterType
      ? createShipInstanceFromType(starterType, 'ship_001', starterType.name + '一号')
      : {
          instanceId: 'ship_001',
          typeId: createShipId('balsa'),
          name: 'サンタ・リスボア',
          material: 'oak' as const,
          currentDurability: 120,
          maxDurability: 120,
          currentCrew: 12,
          maxCrew,
          morale: DEFAULT_MORALE,
          parts: [],
          cargo: [],
          usedCapacity: 0,
          maxCapacity: 30,
          supplies: createInitialSupplies(maxCrew),
          reinforceCount: 0,
          maxReinforce: 5,
          upgrades: { rigging: 0, cargo: 0, gunnery: 0 },
        }

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
      currentPortId: INITIAL_PLAYER.START_PORT,
      position: { x: 195, y: 510 },
      heading: 0,
    }
    set({ player, ships: [starterShip], activeShipId: starterShip.instanceId, lastVoyageNotice: null, lastVoyageEventDay: -1 })
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
    set((state) => ({ ships: [...state.ships, ship] }))
  },

  setActiveShip: (instanceId) => {
    set((state) => state.ships.some((ship) => ship.instanceId === instanceId) ? { activeShipId: instanceId } : state)
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
    if (player.money < shipType.price) return { ok: false, message: '所持金が足りません。' }

    const instanceId = 'ship_' + String(state.ships.length + 1).padStart(3, '0')
    const ship = createShipInstanceFromType(shipType, instanceId, shipType.name + String(state.ships.length + 1) + '号')

    set((current) => ({
      player: current.player ? { ...current.player, money: current.player.money - shipType.price } : current.player,
      ships: [...current.ships, ship],
      activeShipId: current.activeShipId ?? ship.instanceId,
    }))

    return { ok: true, message: shipType.name + ' を購入しました。' }
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

    set((state) => ({
      ships: state.ships.map((ship) => {
        if (ship.instanceId !== state.activeShipId) return ship

        const supplies = getShipSupplies(ship)
        const foodUse = ship.currentCrew * VOYAGE_CONFIG.FOOD_CONSUMPTION_PER_CREW_PER_DAY * gameDayDelta
        const waterUse = ship.currentCrew * VOYAGE_CONFIG.WATER_CONSUMPTION_PER_CREW_PER_DAY * gameDayDelta
        const nextFood = Math.max(0, supplies.food - foodUse)
        const nextWater = Math.max(0, supplies.water - waterUse)
        const foodShortage = Math.max(0, foodUse - supplies.food) * VOYAGE_CONFIG.STARVATION_ATTRITION_FACTOR
        const waterShortage = Math.max(0, waterUse - supplies.water) * VOYAGE_CONFIG.DEHYDRATION_ATTRITION_FACTOR
        const shortage = foodShortage + waterShortage
        const moraleLoss = VOYAGE_CONFIG.PASSIVE_MORALE_LOSS_PER_DAY * gameDayDelta + shortage * VOYAGE_CONFIG.SHORTAGE_MORALE_DAMAGE_FACTOR

        const depleted = applyShortageEffects({
          ...ship,
          morale: clamp(getShipMorale(ship) - moraleLoss, 0, 100),
          supplies: {
            ...supplies,
            food: Math.round(nextFood * 100) / 100,
            water: Math.round(nextWater * 100) / 100,
          },
        }, shortage)

        return {
          ...depleted,
          morale: clamp(depleted.morale ?? getShipMorale(ship), 0, 100),
        }
      }),
    }))
  },

  resupplyShip: (target, amount = 0) => {
    const state = get()
    const player = state.player
    const ship = state.ships.find((entry) => entry.instanceId === state.activeShipId)
    if (!player || !ship) return { ok: false, message: '補給対象の船が見つかりません。' }

    const supplies = getShipSupplies(ship)
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
    const totalCost = Math.ceil(desiredFood) * FOOD_UNIT_COST + Math.ceil(desiredWater) * WATER_UNIT_COST
    if (desiredFood <= 0 && desiredWater <= 0) return { ok: false, message: 'これ以上補給する必要はありません。' }
    if (player.money < totalCost) return { ok: false, message: '所持金が足りません。' }

    set((current) => ({
      player: current.player ? { ...current.player, money: current.player.money - totalCost } : current.player,
      ships: current.ships.map((entry) => {
        if (entry.instanceId !== current.activeShipId) return entry
        const currentSupplies = getShipSupplies(entry)
        return {
          ...entry,
          supplies: {
            ...currentSupplies,
            food: Math.min(currentSupplies.maxFood, Math.round((currentSupplies.food + desiredFood) * 100) / 100),
            water: Math.min(currentSupplies.maxWater, Math.round((currentSupplies.water + desiredWater) * 100) / 100),
          },
        }
      }),
    }))

    return { ok: true, message: `食料 ${Math.ceil(desiredFood)}・水 ${Math.ceil(desiredWater)} を補給しました。` }
  },

  hireCrew: (amount) => {
    const state = get()
    const player = state.player
    const ship = state.ships.find((entry) => entry.instanceId === state.activeShipId)
    if (!player || !ship) return { ok: false, message: '雇用対象の船が見つかりません。' }
    if (amount <= 0) return { ok: false, message: '雇用人数を指定してください。' }

    const hireable = Math.min(amount, ship.maxCrew - ship.currentCrew)
    if (hireable <= 0) return { ok: false, message: 'これ以上船員を雇えません。' }
    const totalCost = hireable * CREW_HIRE_COST
    if (player.money < totalCost) return { ok: false, message: '所持金が足りません。' }

    set((current) => ({
      player: current.player ? { ...current.player, money: current.player.money - totalCost } : current.player,
      ships: current.ships.map((entry) => entry.instanceId !== current.activeShipId ? entry : {
        ...entry,
        currentCrew: entry.currentCrew + hireable,
      }),
    }))

    return { ok: true, message: `船員を ${hireable} 人雇用しました。` }
  },

  visitTavern: (service, amount = 0, tavernLevel = 1) => {
    const state = get()
    const player = state.player
    const ship = state.ships.find((entry) => entry.instanceId === state.activeShipId)
    if (!player || !ship) return { ok: false, message: '酒場で対応する船が見つかりません。' }

    const level = clamp(tavernLevel, 1, 5)
    const morale = getShipMorale(ship)

    if (service === 'meal') {
      const cost = Math.max(20, Math.ceil(Math.max(1, ship.currentCrew) * VOYAGE_CONFIG.TAVERN_MEAL_COST_PER_CREW * (1 - level * 0.04)))
      if (player.money < cost) return { ok: false, message: '所持金が足りません。' }
      if (morale >= 100) return { ok: false, message: '士気は十分に高いです。' }

      set((current) => ({
        player: current.player ? { ...current.player, money: current.player.money - cost } : current.player,
        ships: current.ships.map((entry) => entry.instanceId !== current.activeShipId ? entry : {
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
        ships: current.ships.map((entry) => entry.instanceId !== current.activeShipId ? entry : {
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
      ships: current.ships.map((entry) => entry.instanceId !== current.activeShipId ? entry : {
        ...entry,
        currentCrew: entry.currentCrew + hireable,
        morale: clamp(getShipMorale(entry) + 2 + level, 0, 100),
      }),
    }))
    return { ok: true, message: `酒場で ${hireable} 人の船員を集めました。` }
  },

    repairShip: (mode = 'standard', amount, facilityLevel = 1) => {
      const state = get()
      const player = state.player
      const ship = state.ships.find((entry) => entry.instanceId === state.activeShipId)
    if (!player || !ship) return { ok: false, message: '修理対象の船が見つかりません。' }

    const level = clamp(facilityLevel, 1, 5)
    const missing = ship.maxDurability - ship.currentDurability
    if (missing <= 0) return { ok: false, message: '修理の必要はありません。' }

    const supplies = getShipSupplies(ship)
    const requested = amount && amount > 0 ? Math.min(amount, missing) : missing

    let repaired: number = requested
    let costPerPoint: number = VOYAGE_CONFIG.STANDARD_REPAIR_COST_PER_POINT
    let moraleBonus: number = 0
    let nextAttrition: number = supplies.attritionProgress
    let nextDamage: number = supplies.damageProgress
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
      label = '修理'
    }

    const totalCost = repaired * costPerPoint
    if (player.money < totalCost) return { ok: false, message: '所持金が足りません。' }

    set((current) => ({
      player: current.player ? { ...current.player, money: current.player.money - totalCost } : current.player,
      ships: current.ships.map((entry) => {
        if (entry.instanceId !== current.activeShipId) return entry
        const entrySupplies = getShipSupplies(entry)
        return {
          ...entry,
          currentDurability: Math.min(entry.maxDurability, entry.currentDurability + repaired),
          morale: clamp(getShipMorale(entry) + moraleBonus, 0, 100),
          supplies: {
            ...entrySupplies,
            attritionProgress: nextAttrition,
            damageProgress: nextDamage,
          },
        }
      }),
    }))

      return { ok: true, message: `${label}で耐久を ${repaired} 回復しました。` }
    },

    outfitShip: (option = 'rigging') => {
      const state = get()
      const player = state.player
      const ship = state.ships.find((entry) => entry.instanceId === state.activeShipId)
      if (!player || !ship) return { ok: false, message: '旗艦が見つかりません。' }

      const currentLevel = ship.upgrades?.[option] ?? 0
      const maxLevel = 3
      if (currentLevel >= maxLevel) return { ok: false, message: 'これ以上装備を強化できません。' }

      const baseCost = option === 'rigging' ? 320 : option === 'cargo' ? 280 : 360
      const stepIncrease = option === 'rigging' ? 90 : option === 'cargo' ? 70 : 120
      const cost = baseCost + currentLevel * stepIncrease
      if (player.money < cost) return { ok: false, message: '資金が足りません。' }

      const nextShips = state.ships.map((entry) => {
        if (entry.instanceId !== state.activeShipId) return entry
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

  debugSetLevel: (type, level) => {
    const { player } = get()
    if (!player) return
    const key = `${type}Level` as 'adventureLevel' | 'tradeLevel' | 'combatLevel'
    set({ player: { ...player, stats: { ...player.stats, [key]: level } } })
  },
}))






