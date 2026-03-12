import type { Player } from '@/types/character.ts'
import type { Port, CultureZone } from '@/types/port.ts'
import type { CargoSlot } from '@/types/ship.ts'
import type { PriceTrend, TradeGood } from '@/types/trade.ts'

export interface TradeQuote {
  unitPrice: number
  totalPrice: number
  taxRate: number
  taxAmount: number
  specialModifier: number
  distanceModifier: number
  trend: PriceTrend
}

const CULTURE_DISTANCES: Partial<Record<CultureZone, Partial<Record<CultureZone, number>>>> = {
  west_europe: { west_europe: 0, north_europe: 1, east_europe: 1, islamic: 2, africa: 2, indian: 3, southeast_asia: 4, east_asia: 5, new_world: 4 },
  north_europe: { west_europe: 1, north_europe: 0, east_europe: 2, islamic: 3, africa: 3, indian: 4, southeast_asia: 5, east_asia: 5, new_world: 4 },
  east_europe: { west_europe: 1, north_europe: 2, east_europe: 0, islamic: 2, africa: 3, indian: 3, southeast_asia: 4, east_asia: 4, new_world: 5 },
  islamic: { west_europe: 2, north_europe: 3, east_europe: 2, islamic: 0, africa: 1, indian: 2, southeast_asia: 3, east_asia: 4, new_world: 5 },
  indian: { west_europe: 3, north_europe: 4, east_europe: 3, islamic: 2, africa: 2, indian: 0, southeast_asia: 1, east_asia: 2, new_world: 5 },
  southeast_asia: { west_europe: 4, north_europe: 5, east_europe: 4, islamic: 3, africa: 3, indian: 1, southeast_asia: 0, east_asia: 1, new_world: 5 },
  east_asia: { west_europe: 5, north_europe: 5, east_europe: 4, islamic: 4, africa: 4, indian: 2, southeast_asia: 1, east_asia: 0, new_world: 5 },
  africa: { west_europe: 2, north_europe: 3, east_europe: 3, islamic: 1, africa: 0, indian: 2, southeast_asia: 3, east_asia: 4, new_world: 3 },
  new_world: { west_europe: 4, north_europe: 4, east_europe: 5, islamic: 5, africa: 3, indian: 5, southeast_asia: 5, east_asia: 5, new_world: 0 },
}

function getCultureDistance(from: CultureZone, to: CultureZone): number {
  return CULTURE_DISTANCES[from]?.[to] ?? (from === to ? 0 : 3)
}

function getAverageOriginDistance(good: TradeGood, currentPort: Port, ports: Port[]): number {
  const originPorts = ports.filter((port) => good.origins.includes(port.id))
  if (originPorts.length === 0) return 2

  const totalDistance = originPorts.reduce((sum, port) => sum + getCultureDistance(port.culture, currentPort.culture), 0)
  return totalDistance / originPorts.length
}

export function calculateBuyQuote(params: {
  good: TradeGood
  port: Port
  player: Player
  stock: number
  maxStock: number
  trend: PriceTrend
}): TradeQuote {
  const { good, port, player, stock, maxStock, trend } = params
  const localSupply = good.origins.includes(port.id) || port.specialProducts.includes(good.id)
  const stockRatio = maxStock > 0 ? stock / maxStock : 0
  const prosperityModifier = 1 + (port.prosperity - 50) / 320
  const rarityModifier = 1 + good.rarity * 0.035
  const supplyModifier = localSupply ? 0.82 : 1.04
  const stockModifier = 1 + (1 - stockRatio) * 0.24 - stockRatio * 0.08
  const trendModifier = trend === 'boom' ? 1.14 : trend === 'rising' ? 1.08 : trend === 'falling' ? 0.96 : trend === 'crash' ? 0.9 : 1
  const effectiveTaxRate = player.nationality === port.nationality ? port.taxRate * 0.4 : port.taxRate

  const baseUnitPrice = good.basePrice * prosperityModifier * rarityModifier * supplyModifier * stockModifier * trendModifier
  const taxAmount = Math.round(baseUnitPrice * effectiveTaxRate)
  const unitPrice = Math.max(1, Math.round(baseUnitPrice + taxAmount))

  return {
    unitPrice,
    totalPrice: unitPrice,
    taxRate: effectiveTaxRate,
    taxAmount,
    specialModifier: supplyModifier,
    distanceModifier: 1,
    trend,
  }
}

export function calculateSellQuote(params: {
  good: TradeGood
  port: Port
  ports: Port[]
  cargoSlot: CargoSlot
  trend: PriceTrend
}): TradeQuote {
  const { good, port, ports, cargoSlot, trend } = params
  const localSupply = good.origins.includes(port.id) || port.specialProducts.includes(good.id)
  const averageDistance = getAverageOriginDistance(good, port, ports)
  const distanceModifier = localSupply ? 0.82 : 1 + averageDistance * 0.08
  const prosperityModifier = 0.94 + port.prosperity / 220
  const rarityModifier = 1 + good.rarity * 0.03
  const trendModifier = trend === 'boom' ? 1.16 : trend === 'rising' ? 1.08 : trend === 'falling' ? 0.94 : trend === 'crash' ? 0.88 : 1

  const baseUnitPrice = good.basePrice * distanceModifier * prosperityModifier * rarityModifier * trendModifier
  const profitGuard = cargoSlot.buyPrice > 0 ? Math.max(baseUnitPrice, cargoSlot.buyPrice * 0.7) : baseUnitPrice
  const taxAmount = Math.round(profitGuard * port.taxRate * 0.15)
  const unitPrice = Math.max(1, Math.round(profitGuard - taxAmount))

  return {
    unitPrice,
    totalPrice: unitPrice,
    taxRate: port.taxRate * 0.15,
    taxAmount,
    specialModifier: localSupply ? 0.82 : 1,
    distanceModifier,
    trend,
  }
}
