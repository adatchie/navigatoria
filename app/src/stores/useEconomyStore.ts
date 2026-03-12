import { create } from 'zustand'
import { calculateBuyQuote, calculateSellQuote, type TradeQuote } from '@/game/trade/PriceEngine.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { useQuestStore } from '@/stores/useQuestStore.ts'
import type { Port } from '@/types/port.ts'
import type { CargoSlot } from '@/types/ship.ts'
import type { PriceTrend, TradeGood } from '@/types/trade.ts'

export interface MarketItemState {
  goodId: string
  basePrice: number
  currentPrice: number
  stock: number
  maxStock: number
  restockRate: number
  trend: PriceTrend
}

export interface PortMarketState {
  portId: string
  items: MarketItemState[]
  lastUpdated: number
}

export interface PurchaseHistoryEntry {
  day: number
  bought: number
}

export interface TradeActionResult {
  ok: boolean
  message: string
  totalPrice?: number
}

interface EconomyStoreState {
  markets: Record<string, PortMarketState>
  purchaseHistory: Record<string, Record<string, PurchaseHistoryEntry>>
  initialized: boolean
  lastSimulatedDay: number
  lastBankInterestDay: number
  depositInterestRate: number
  debtInterestRate: number

  initializeMarkets: () => void
  simulateToDay: (currentDay: number) => void
  buyGood: (portId: string, goodId: string, quantity: number) => TradeActionResult
  sellGood: (portId: string, goodId: string, quantity: number) => TradeActionResult
  getBuyQuote: (portId: string, goodId: string, quantity?: number) => TradeQuote | null
  getSellQuote: (portId: string, goodId: string, quantity?: number) => TradeQuote | null
  getPurchaseLimit: (portId: string, goodId: string) => number
  investInPort: (portId: string, amount: number) => TradeActionResult
  depositMoney: (amount: number) => TradeActionResult
  withdrawMoney: (amount: number) => TradeActionResult
  borrowMoney: (amount: number) => TradeActionResult
  repayDebt: (amount: number) => TradeActionResult
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function hashSeed(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) % 2147483647
  }
  return hash
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function getTrendDirection(value: number): PriceTrend {
  if (value >= 0.18) return 'boom'
  if (value >= 0.06) return 'rising'
  if (value <= -0.18) return 'crash'
  if (value <= -0.06) return 'falling'
  return 'stable'
}

function buildMarketItem(port: Port, good: TradeGood): MarketItemState {
  const isLocal = good.origins.includes(port.id) || port.specialProducts.includes(good.id)
  const maxStock = Math.max(12, Math.round((isLocal ? 46 : 18) + port.prosperity / 3 + (6 - good.rarity) * 4))
  const stock = Math.round(maxStock * (isLocal ? 0.78 : 0.45))
  const restockRate = Math.max(2, Math.round(maxStock * (isLocal ? 0.16 : 0.11)))

  return {
    goodId: good.id,
    basePrice: good.basePrice,
    currentPrice: good.basePrice,
    stock,
    maxStock,
    restockRate,
    trend: isLocal ? 'falling' : 'stable',
  }
}

function getTradeCatalog(port: Port, goods: TradeGood[]): TradeGood[] {
  const seen = new Set<string>()
  const catalog: TradeGood[] = []

  const addGoods = (items: TradeGood[]) => {
    for (const item of items) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      catalog.push(item)
    }
  }

  addGoods(goods.filter((good) => good.origins.includes(port.id) || port.specialProducts.includes(good.id)))
  addGoods(goods.filter((good) => good.rarity <= 2))
  addGoods(goods.filter((good) => good.category === 'food' || good.category === 'fiber' || good.category === 'metal'))

  return catalog
}

function recalculateItemPrice(item: MarketItemState, port: Port, good: TradeGood): MarketItemState {
  const player = usePlayerStore.getState().player
  if (!player) return item

  const quote = calculateBuyQuote({ good, port, player, stock: item.stock, maxStock: item.maxStock, trend: item.trend })
  return { ...item, currentPrice: quote.unitPrice }
}

function mutateCargo(cargo: CargoSlot[], goodId: string, quantity: number, unitPrice: number): CargoSlot[] {
  const nextCargo = [...cargo]
  const existingIndex = nextCargo.findIndex((slot) => slot.goodId === goodId)

  if (existingIndex === -1) {
    nextCargo.push({ goodId, quantity, buyPrice: unitPrice })
    return nextCargo
  }

  const existing = nextCargo[existingIndex]!
  const totalQuantity = existing.quantity + quantity
  const averagedBuyPrice = Math.round(((existing.buyPrice * existing.quantity) + (unitPrice * quantity)) / totalQuantity)
  nextCargo[existingIndex] = { ...existing, quantity: totalQuantity, buyPrice: averagedBuyPrice }
  return nextCargo
}

function getPlayerBorrowLimit(): number {
  const player = usePlayerStore.getState().player
  if (!player) return 0
  return 2000 + player.stats.tradeLevel * 2500 + player.stats.fame * 12
}

function calculateTradeRewards(gross: number, profit: number): { tradeExp: number; fame: number } {
  const tradeExp = Math.max(1, Math.round(gross / 22 + Math.max(0, profit) / 10))
  const fame = Math.max(0, Math.round(Math.max(0, profit) / 140))
  return { tradeExp, fame }
}

export const useEconomyStore = create<EconomyStoreState>()((set, get) => ({
  markets: {},
  purchaseHistory: {},
  initialized: false,
  lastSimulatedDay: 0,
  lastBankInterestDay: 0,
  depositInterestRate: 0.0003,
  debtInterestRate: 0.0008,

  initializeMarkets: () => {
    const { masterData } = useDataStore.getState()
    if (masterData.ports.length === 0 || masterData.tradeGoods.length === 0) return

    const markets = Object.fromEntries(
      masterData.ports.map((port) => {
        const items = getTradeCatalog(port, masterData.tradeGoods)
          .map((good) => buildMarketItem(port, good))
          .map((item) => recalculateItemPrice(item, port, masterData.tradeGoods.find((good) => good.id === item.goodId)!))
        return [port.id, { portId: port.id, items, lastUpdated: 0 } satisfies PortMarketState]
      }),
    )

    set({ markets, purchaseHistory: {}, initialized: true, lastSimulatedDay: 0, lastBankInterestDay: 0 })
  },

  simulateToDay: (currentDay) => {
    const { initialized, lastSimulatedDay, lastBankInterestDay, depositInterestRate, debtInterestRate } = get()
    if (!initialized || currentDay <= lastSimulatedDay) return

    const { masterData } = useDataStore.getState()
    const portMap = new Map<string, Port>(useWorldStore.getState().ports.map((port) => [port.id, port]))
    const goodMap = new Map<string, TradeGood>(masterData.tradeGoods.map((good) => [good.id, good]))
    const nextMarkets = structuredClone(get().markets) as Record<string, PortMarketState>

    for (let day = lastSimulatedDay + 1; day <= currentDay; day++) {
      for (const market of Object.values(nextMarkets)) {
        const port = portMap.get(market.portId)
        if (!port) continue

        market.items = market.items.map((item) => {
          const good = goodMap.get(item.goodId)
          if (!good) return item

          const seed = hashSeed(`${market.portId}:${item.goodId}:${day}`)
          const noise = pseudoRandom(seed) - 0.5
          const stockDelta = Math.round(item.restockRate * (0.7 + noise * 0.6))
          const nextStock = clamp(item.stock + stockDelta, 0, item.maxStock)
          const scarcity = 1 - nextStock / item.maxStock
          const trend = getTrendDirection(noise + scarcity * 0.3 - (good.origins.includes(port.id) ? 0.08 : 0))
          return recalculateItemPrice({ ...item, stock: nextStock, trend }, port, good)
        })
        market.lastUpdated = day
      }
    }

    if (currentDay > lastBankInterestDay) {
      const dayDelta = currentDay - lastBankInterestDay
      usePlayerStore.setState((state) => {
        if (!state.player) return state
        const deposit = Math.round(state.player.deposit * Math.pow(1 + depositInterestRate, dayDelta))
        const debt = Math.round(state.player.debt * Math.pow(1 + debtInterestRate, dayDelta))
        return { player: { ...state.player, deposit, debt } }
      })
    }

    set((state) => {
      const nextHistory = { ...state.purchaseHistory }
      for (const [portId, byGood] of Object.entries(nextHistory)) {
        nextHistory[portId] = Object.fromEntries(
          Object.entries(byGood).filter(([, entry]) => entry.day >= currentDay),
        )
      }
      return { markets: nextMarkets, purchaseHistory: nextHistory, lastSimulatedDay: currentDay, lastBankInterestDay: currentDay }
    })
  },

  getPurchaseLimit: (portId, goodId) => {
    const player = usePlayerStore.getState().player
    const port = useWorldStore.getState().ports.find((entry) => entry.id === portId)
    const market = get().markets[portId]
    const item = market?.items.find((entry) => entry.goodId === goodId)
    if (!player || !port || !item) return 0

    const tradeLevel = player.stats.tradeLevel
    const influence = port.influence[player.nationality] ?? 0
    const marketLevel = port.facilities.find((facility) => facility.type === 'market')?.level ?? 1
    const history = get().purchaseHistory[portId]?.[goodId]
    const currentDay = Math.floor(useGameStore.getState().timeState.totalDays)
    const boughtToday = history?.day === currentDay ? history.bought : 0
    const baseLimit = 8 + tradeLevel * 5 + marketLevel * 6 + Math.round(influence / 8)
    const stockCap = Math.max(1, Math.round(item.stock * 0.7))
    return Math.max(1, Math.min(baseLimit - boughtToday, stockCap))
  },

  getBuyQuote: (portId, goodId, quantity = 1) => {
    const market = get().markets[portId]
    const port = useWorldStore.getState().ports.find((entry) => entry.id === portId)
    const good = useDataStore.getState().getTradeGood(goodId as never)
    const player = usePlayerStore.getState().player
    const item = market?.items.find((entry) => entry.goodId === goodId)
    if (!market || !port || !good || !player || !item) return null

    const quote = calculateBuyQuote({ good, port, player, stock: item.stock, maxStock: item.maxStock, trend: item.trend })
    return { ...quote, totalPrice: quote.unitPrice * quantity, taxAmount: quote.taxAmount * quantity }
  },

  getSellQuote: (portId, goodId, quantity = 1) => {
    const port = useWorldStore.getState().ports.find((entry) => entry.id === portId)
    const good = useDataStore.getState().getTradeGood(goodId as never)
    const ship = usePlayerStore.getState().ships.find((entry) => entry.instanceId === usePlayerStore.getState().activeShipId)
    const cargoSlot = ship?.cargo.find((slot) => slot.goodId === goodId)
    const trend = get().markets[portId]?.items.find((entry) => entry.goodId === goodId)?.trend ?? 'stable'
    if (!port || !good || !cargoSlot) return null

    const quote = calculateSellQuote({ good, port, ports: useWorldStore.getState().ports, cargoSlot, trend })
    return { ...quote, totalPrice: quote.unitPrice * quantity, taxAmount: quote.taxAmount * quantity }
  },

  buyGood: (portId, goodId, quantity) => {
    if (quantity <= 0) return { ok: false, message: '数量が不足しています。' }

    const market = get().markets[portId]
    const port = useWorldStore.getState().ports.find((entry) => entry.id === portId)
    const good = useDataStore.getState().getTradeGood(goodId as never)
    const playerState = usePlayerStore.getState()
    const player = playerState.player
    const activeShip = playerState.ships.find((ship) => ship.instanceId === playerState.activeShipId)
    const item = market?.items.find((entry) => entry.goodId === goodId)
    if (!market || !port || !good || !player || !activeShip || !item) return { ok: false, message: '市場データが見つかりません。' }

    const limit = get().getPurchaseLimit(portId, goodId)
    if (quantity > limit) return { ok: false, message: `この港での購入上限は ${limit} です。` }
    if (item.stock < quantity) return { ok: false, message: '在庫が足りません。' }

    const quote = get().getBuyQuote(portId, goodId, quantity)
    if (!quote) return { ok: false, message: '買値を計算できません。' }

    const requiredCapacity = good.weight * quantity
    const remainingCapacity = activeShip.maxCapacity - activeShip.usedCapacity
    if (requiredCapacity > remainingCapacity) return { ok: false, message: '船倉容量が足りません。' }
    if (player.money < quote.totalPrice) return { ok: false, message: '所持金が足りません。' }

    const rewards = calculateTradeRewards(quote.totalPrice, 0)
    const currentDay = Math.floor(useGameStore.getState().timeState.totalDays)

    usePlayerStore.setState((state) => ({
      player: state.player ? {
        ...state.player,
        money: state.player.money - quote.totalPrice,
        stats: { ...state.player.stats, tradeExp: state.player.stats.tradeExp + rewards.tradeExp },
      } : state.player,
      ships: state.ships.map((ship) => ship.instanceId !== state.activeShipId ? ship : {
        ...ship,
        cargo: mutateCargo(ship.cargo, goodId, quantity, quote.unitPrice),
        usedCapacity: Math.round((ship.usedCapacity + requiredCapacity) * 100) / 100,
      }),
    }))

    set((state) => ({
      purchaseHistory: {
        ...state.purchaseHistory,
        [portId]: {
          ...(state.purchaseHistory[portId] ?? {}),
          [goodId]: {
            day: currentDay,
            bought: (state.purchaseHistory[portId]?.[goodId]?.day === currentDay ? state.purchaseHistory[portId]?.[goodId]?.bought ?? 0 : 0) + quantity,
          },
        },
      },
      markets: {
        ...state.markets,
        [portId]: {
          ...market,
          items: market.items.map((entry) => entry.goodId !== goodId ? entry : recalculateItemPrice({ ...entry, stock: entry.stock - quantity }, port, good)),
        },
      },
    }))

    useQuestStore.getState().recordPurchasedGoods(portId, goodId, quantity)
    return { ok: true, message: `${good.name} を ${quantity} 個購入しました。`, totalPrice: quote.totalPrice }
  },

  sellGood: (portId, goodId, quantity) => {
    if (quantity <= 0) return { ok: false, message: '数量が不足しています。' }

    const port = useWorldStore.getState().ports.find((entry) => entry.id === portId)
    const good = useDataStore.getState().getTradeGood(goodId as never)
    const playerState = usePlayerStore.getState()
    const player = playerState.player
    const activeShip = playerState.ships.find((ship) => ship.instanceId === playerState.activeShipId)
    const cargoSlot = activeShip?.cargo.find((slot) => slot.goodId === goodId)
    if (!port || !good || !player || !activeShip || !cargoSlot) return { ok: false, message: '売却対象が見つかりません。' }
    if (cargoSlot.quantity < quantity) return { ok: false, message: '売却数量が積荷を超えています。' }

    const trend = get().markets[portId]?.items.find((entry) => entry.goodId === goodId)?.trend ?? 'stable'
    const quote = calculateSellQuote({ good, port, ports: useWorldStore.getState().ports, cargoSlot, trend })
    const totalPrice = quote.unitPrice * quantity
    const freedCapacity = good.weight * quantity
    const profit = (quote.unitPrice - cargoSlot.buyPrice) * quantity
    const rewards = calculateTradeRewards(totalPrice, profit)

    usePlayerStore.setState((state) => ({
      player: state.player ? {
        ...state.player,
        money: state.player.money + totalPrice,
        stats: {
          ...state.player.stats,
          tradeExp: state.player.stats.tradeExp + rewards.tradeExp,
          fame: state.player.stats.fame + rewards.fame,
        },
      } : state.player,
      ships: state.ships.map((ship) => {
        if (ship.instanceId !== state.activeShipId) return ship
        const nextCargo = ship.cargo.map((slot) => slot.goodId !== goodId ? slot : { ...slot, quantity: slot.quantity - quantity }).filter((slot) => slot.quantity > 0)
        return { ...ship, cargo: nextCargo, usedCapacity: Math.max(0, Math.round((ship.usedCapacity - freedCapacity) * 100) / 100) }
      }),
    }))

    set((state) => {
      const currentMarket = state.markets[portId]
      const existingItem = currentMarket?.items.find((entry) => entry.goodId === goodId)
      const baseItem = existingItem ?? buildMarketItem(port, good)
      const nextItem = recalculateItemPrice({ ...baseItem, stock: clamp(baseItem.stock + quantity, 0, baseItem.maxStock) }, port, good)
      const nextItems = currentMarket ? (currentMarket.items.some((entry) => entry.goodId === goodId) ? currentMarket.items.map((entry) => entry.goodId !== goodId ? entry : nextItem) : [...currentMarket.items, nextItem]) : [nextItem]
      return { markets: { ...state.markets, [portId]: { portId, items: nextItems, lastUpdated: currentMarket?.lastUpdated ?? state.lastSimulatedDay } } }
    })

    useQuestStore.getState().recordSoldGoods(portId, goodId, quantity)
    return { ok: true, message: `${good.name} を ${quantity} 個売却しました。`, totalPrice }
  },

  investInPort: (portId, amount) => {
    const player = usePlayerStore.getState().player
    const port = useWorldStore.getState().ports.find((entry) => entry.id === portId)
    if (!player || !port) return { ok: false, message: '投資先が見つかりません。' }
    if (amount <= 0) return { ok: false, message: '投資額が不足しています。' }
    if (player.money < amount) return { ok: false, message: '所持金が足りません。' }

    const prosperityGain = Math.max(1, Math.round(amount / 1000))
    const influenceGain = Math.max(1, Math.round(amount / 1500))

    usePlayerStore.setState((state) => state.player ? ({
      player: {
        ...state.player,
        money: state.player.money - amount,
        stats: { ...state.player.stats, tradeExp: state.player.stats.tradeExp + Math.max(2, Math.round(amount / 60)), fame: state.player.stats.fame + Math.max(1, Math.round(amount / 400)) },
      },
    }) : state)

    useWorldStore.getState().updatePort(portId, (currentPort) => ({
      ...currentPort,
      prosperity: clamp(currentPort.prosperity + prosperityGain, 0, 100),
      influence: {
        ...currentPort.influence,
        [player.nationality]: clamp((currentPort.influence[player.nationality] ?? 0) + influenceGain, 0, 100),
      },
    }))

    return { ok: true, message: `${port.name} に ${amount} ドゥカート投資しました。` }
  },

  depositMoney: (amount) => {
    const player = usePlayerStore.getState().player
    if (!player) return { ok: false, message: 'プレイヤー情報がありません。' }
    if (amount <= 0) return { ok: false, message: '預金額が不足しています。' }
    if (player.money < amount) return { ok: false, message: '所持金が足りません。' }

    usePlayerStore.setState((state) => state.player ? ({ player: { ...state.player, money: state.player.money - amount, deposit: state.player.deposit + amount } }) : state)
    return { ok: true, message: `${amount} ドゥカートを預金しました。` }
  },

  withdrawMoney: (amount) => {
    const player = usePlayerStore.getState().player
    if (!player) return { ok: false, message: 'プレイヤー情報がありません。' }
    if (amount <= 0) return { ok: false, message: '引出額が不足しています。' }
    if (player.deposit < amount) return { ok: false, message: '預金残高が足りません。' }

    usePlayerStore.setState((state) => state.player ? ({ player: { ...state.player, money: state.player.money + amount, deposit: state.player.deposit - amount } }) : state)
    return { ok: true, message: `${amount} ドゥカートを引き出しました。` }
  },

  borrowMoney: (amount) => {
    const player = usePlayerStore.getState().player
    if (!player) return { ok: false, message: 'プレイヤー情報がありません。' }
    if (amount <= 0) return { ok: false, message: '借入額が不足しています。' }
    const remaining = Math.max(0, getPlayerBorrowLimit() - player.debt)
    if (amount > remaining) return { ok: false, message: `借入上限はあと ${remaining} ドゥカートです。` }

    usePlayerStore.setState((state) => state.player ? ({ player: { ...state.player, money: state.player.money + amount, debt: state.player.debt + amount } }) : state)
    return { ok: true, message: `${amount} ドゥカートを借り入れました。` }
  },

  repayDebt: (amount) => {
    const player = usePlayerStore.getState().player
    if (!player) return { ok: false, message: 'プレイヤー情報がありません。' }
    if (amount <= 0) return { ok: false, message: '返済額が不足しています。' }
    if (player.money < amount) return { ok: false, message: '所持金が足りません。' }
    if (player.debt <= 0) return { ok: false, message: '返済する借金がありません。' }

    const paid = Math.min(amount, player.debt)
    usePlayerStore.setState((state) => state.player ? ({ player: { ...state.player, money: state.player.money - paid, debt: state.player.debt - paid } }) : state)
    return { ok: true, message: `${paid} ドゥカートを返済しました。` }
  },
}))


