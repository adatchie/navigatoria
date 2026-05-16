import type { Port } from '@/types/port.ts'
import type { Quest, QuestRank, QuestReward, TradeQuestCategory } from '@/types/quest.ts'
import type { TradeGood } from '@/types/trade.ts'
import { WORLD_DISTANCE_SCALE } from '@/config/gameConfig.ts'
import { getTradeCatalog } from '@/game/trade/tradeCatalog.ts'

type GeneratedTradeQuestCategory = Extract<TradeQuestCategory, 'trade_delivery' | 'trade_procurement'>

const DELIVERY_REWARD_BASE = 220
const DEFAULT_QUEST_SHIP_SPEED_KNOTS = 8
const QUEST_SUSTAINED_SPEED_FACTOR = 0.72
const QUEST_ROUTE_DISTANCE_FACTOR = 1.35
const QUEST_RANK_BUFFER_DAYS: Record<QuestRank, number> = {
  standard: 5,
  urgent: 3,
  premium: 2,
}
const QUEST_MIN_DEADLINE_DAYS: Record<QuestRank, number> = {
  standard: 8,
  urgent: 6,
  premium: 7,
}
const QUEST_CATEGORY_BUFFER_DAYS: Record<TradeQuestCategory, number> = {
  trade_delivery: 1,
  trade_procurement: 2,
  trade_sales: 1,
}
const QUEST_DEADLINE_MULTIPLIER = 1.5

function hashSeed(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) % 2147483647
  }
  return hash
}

function hasGuild(port: Port): boolean {
  return port.facilities.some((facility) => facility.type === 'guild' && facility.available)
}

function hasMarket(port: Port): boolean {
  return port.facilities.some((facility) => facility.type === 'market' && facility.available)
}

function pickDeliveryDestination(sourcePort: Port, ports: Port[], seed: number): Port | null {
  const nonSourcePorts = ports.filter((port) => port.id !== sourcePort.id)
  const guildPorts = nonSourcePorts.filter((port) => hasGuild(port))
  const candidates = guildPorts.length > 0 ? guildPorts : nonSourcePorts
  return candidates[seed % candidates.length] ?? null
}

function pickProcurementSource(giverPort: Port, ports: Port[], goods: TradeGood[], seed: number): Port | null {
  const candidates = ports.filter((port) => port.id !== giverPort.id && hasMarket(port) && getTradeCatalog(port, goods).length > 0)
  return candidates[seed % candidates.length] ?? null
}

function pickGoodForPort(sourcePort: Port, goods: TradeGood[], seed: number): TradeGood | null {
  const catalog = getTradeCatalog(sourcePort, goods)
  const preferred = catalog.filter((good) => sourcePort.specialProducts.includes(good.id) || good.origins.includes(sourcePort.id))
  const pool = preferred.length > 0 ? preferred : catalog
  return pool[seed % pool.length] ?? null
}

function pickProcurementGood(sourcePort: Port, giverPort: Port, goods: TradeGood[], seed: number): TradeGood | null {
  const sourceCatalog = getTradeCatalog(sourcePort, goods)
  const giverGoodIds = new Set(getTradeCatalog(giverPort, goods).map((good) => good.id))
  const preferred = sourceCatalog.filter((good) => !giverGoodIds.has(good.id))
  const pool = preferred.length > 0 ? preferred : sourceCatalog
  return pool[seed % pool.length] ?? null
}

function getQuestRank(seed: number, quantity: number): QuestRank {
  const roll = seed % 100
  if (roll > 84 || quantity >= 14) return 'premium'
  if (roll > 52) return 'urgent'
  return 'standard'
}

function getQuestCategory(seed: number): GeneratedTradeQuestCategory {
  return seed % 2 === 0 ? 'trade_delivery' : 'trade_procurement'
}

function getRouteDistanceKm(sourcePort: Port, destination: Port): number {
  return Math.hypot(
    destination.position.x - sourcePort.position.x,
    destination.position.y - sourcePort.position.y,
  ) * WORLD_DISTANCE_SCALE
}

function getTravelDays(distanceKm: number, shipSpeedKnots = DEFAULT_QUEST_SHIP_SPEED_KNOTS): number {
  const sustainedSpeedKnots = Math.max(3, shipSpeedKnots * QUEST_SUSTAINED_SPEED_FACTOR)
  const kmPerDay = sustainedSpeedKnots * 1.852 * 24
  return Math.ceil((distanceKm * QUEST_ROUTE_DISTANCE_FACTOR) / kmPerDay)
}

function getRewardMultiplier(rank: QuestRank, category: TradeQuestCategory): number {
  const rankBonus = rank === 'premium' ? 1.45 : rank === 'urgent' ? 1.2 : 1
  const categoryBonus = category === 'trade_procurement' ? 1.15 : category === 'trade_sales' ? 1.1 : 1
  return rankBonus * categoryBonus
}

function getDeadlineOffset(rank: QuestRank, category: TradeQuestCategory, distanceKm: number, shipSpeedKnots?: number): number {
  const travelDays = getTravelDays(distanceKm, shipSpeedKnots)
  const deadline = travelDays + QUEST_RANK_BUFFER_DAYS[rank] + QUEST_CATEGORY_BUFFER_DAYS[category]
  return Math.ceil(Math.max(QUEST_MIN_DEADLINE_DAYS[rank], deadline) * QUEST_DEADLINE_MULTIPLIER)
}

function isHighDifficultyQuest(rank: QuestRank, quantity: number, distanceKm: number): boolean {
  return rank === 'premium' && (quantity >= 14 || distanceKm >= 4500)
}

function getRequiredLevel(rank: QuestRank, quantity: number, distanceKm: number): number | undefined {
  if (!isHighDifficultyQuest(rank, quantity, distanceKm)) return undefined

  const distanceGate = distanceKm >= 12000 ? 8 : distanceKm >= 8000 ? 6 : distanceKm >= 4500 ? 4 : 0
  const cargoGate = quantity >= 16 ? 5 : quantity >= 14 ? 3 : 0
  return Math.max(3, distanceGate, cargoGate)
}

function getRequiredFame(rank: QuestRank, category: TradeQuestCategory, quantity: number, distanceKm: number): number {
  if (!isHighDifficultyQuest(rank, quantity, distanceKm)) return 0

  const distanceFame = distanceKm >= 12000 ? 18 : distanceKm >= 8000 ? 14 : 10
  const categoryExtra = category === 'trade_sales' ? 3 : category === 'trade_procurement' ? 2 : 0
  const cargoExtra = quantity >= 16 ? 2 : 0
  return distanceFame + categoryExtra + cargoExtra
}

function buildRewards(params: {
  moneyReward: number
  expReward: number
  fameReward: number
  reportPortId: string
  rank: QuestRank
  seed: number
}): QuestReward[] {
  const { moneyReward, expReward, fameReward, reportPortId, rank, seed } = params
  const rewards: QuestReward[] = [
    { type: 'money', amount: moneyReward },
    { type: 'exp', amount: expReward },
    { type: 'fame', amount: fameReward },
    { type: 'influence', amount: rank === 'premium' ? 5 : rank === 'urgent' ? 3 : 2, portId: reportPortId },
  ]

  if (rank !== 'standard') {
    rewards.push({ type: 'item', itemId: seed % 2 === 0 ? 'guild_token' : 'supply_crate', amount: rank === 'premium' ? 2 : 1 })
  }

  return rewards
}

function buildQuestDetails(params: {
  category: TradeQuestCategory
  sourcePort: Port
  destination: Port
  good: TradeGood
  quantity: number
}): Pick<Quest, 'title' | 'description' | 'objectives'> & { reportPortId: string } {
  const { category, sourcePort, destination, good, quantity } = params

  if (category === 'trade_procurement') {
    return {
      title: `${good.name} 仕入依頼`,
      description: `${destination.name} の交易ギルドより。${sourcePort.name} で販売されている ${good.name} を ${quantity} 個買い付け、${destination.name} へ持ち帰って納品してください。`,
      reportPortId: destination.id,
      objectives: [
        {
          type: 'buy_item',
          target: good.id,
          count: quantity,
          current: 0,
          description: `${sourcePort.name} で ${good.name} を ${quantity} 個購入する`,
        },
        {
          type: 'deliver_item',
          target: good.id,
          count: quantity,
          current: 0,
          description: `${destination.name} のギルドへ ${good.name} を ${quantity} 個納める`,
        },
        {
          type: 'visit_port',
          target: destination.id,
          count: 1,
          current: 0,
          description: `${destination.name} のギルドに報告する`,
        },
      ],
    }
  }

  if (category === 'trade_sales') {
    return {
      title: `${good.name} 売り込み依頼`,
      description: `${sourcePort.name} の交易ギルドより。${destination.name} で ${good.name} を ${quantity} 個売り込んでください。`,
      reportPortId: destination.id,
      objectives: [
        {
          type: 'sell_item',
          target: good.id,
          count: quantity,
          current: 0,
          description: `${destination.name} で ${good.name} を ${quantity} 個売却する`,
        },
        {
          type: 'visit_port',
          target: destination.id,
          count: 1,
          current: 0,
          description: `${destination.name} のギルドに報告する`,
        },
      ],
    }
  }

  return {
    title: `${good.name} 納品依頼`,
    description: `${sourcePort.name} の交易ギルドより。${sourcePort.name} で販売されている ${good.name} を ${quantity} 個仕入れ、${destination.name} へ納品してください。`,
    reportPortId: destination.id,
    objectives: [
      {
        type: 'deliver_item',
        target: good.id,
        count: quantity,
        current: 0,
        description: `${sourcePort.name} で仕入れた ${good.name} を ${destination.name} へ ${quantity} 個納品する`,
      },
      {
        type: 'visit_port',
        target: destination.id,
        count: 1,
        current: 0,
        description: `${destination.name} のギルドに報告する`,
      },
    ],
  }
}

export function generateTradeQuestsForPort(params: {
  port: Port
  ports: Port[]
  goods: TradeGood[]
  day: number
  tradeLevel: number
  shipSpeedKnots?: number
}): Quest[] {
  const { port, ports, goods, day, tradeLevel, shipSpeedKnots } = params
  const questCount = Math.max(2, Math.min(4, 2 + Math.floor(tradeLevel / 3)))
  const quests: Quest[] = []

  for (let index = 0; index < questCount; index++) {
    const seed = hashSeed(`${port.id}:${day}:${index}`)
    const category = getQuestCategory(index)
    const sourcePort = category === 'trade_procurement' ? pickProcurementSource(port, ports, goods, seed + 11) : port
    const destination = category === 'trade_procurement' ? port : pickDeliveryDestination(port, ports, seed + 7)
    if (!sourcePort || !destination || sourcePort.id === destination.id) continue

    const good = category === 'trade_procurement'
      ? pickProcurementGood(sourcePort, port, goods, seed)
      : pickGoodForPort(sourcePort, goods, seed)
    if (!good) continue

    const quantity = Math.max(3, Math.min(18, 4 + (seed % 5) * 2 + tradeLevel))
    const sameCulture = destination.culture === sourcePort.culture
    const rank = getQuestRank(seed, quantity)
    const distanceKm = category === 'trade_procurement'
      ? getRouteDistanceKm(port, sourcePort) + getRouteDistanceKm(sourcePort, port)
      : getRouteDistanceKm(sourcePort, destination)
    const deadlineDay = day + getDeadlineOffset(rank, category, distanceKm, shipSpeedKnots)
    const rewardMultiplier = getRewardMultiplier(rank, category)
    const moneyReward = Math.round((DELIVERY_REWARD_BASE + good.basePrice * quantity * 0.22) * (sameCulture ? 1 : 1.25) * rewardMultiplier)
    const expReward = Math.max(15, Math.round(moneyReward / 5))
    const fameReward = Math.max(1, Math.round(moneyReward / 140))
    const details = buildQuestDetails({ category, sourcePort, destination, good, quantity })
    const requiredLevel = getRequiredLevel(rank, quantity, distanceKm)
    const requiredFame = getRequiredFame(rank, category, quantity, distanceKm)

    quests.push({
      id: `trade_${category}_${port.id}_${day}_${index}`,
      title: details.title,
      description: details.description,
      type: 'delivery',
      giver: `${port.name} 交易ギルド`,
      giverPort: port.id,
      status: 'available',
      rank,
      deadlineDay,
      requiredLevel,
      requiredFame,
      rewards: buildRewards({ moneyReward, expReward, fameReward, reportPortId: details.reportPortId, rank, seed }),
      objectives: details.objectives,
      metadata: {
        sourcePortId: sourcePort.id,
        destinationPortId: destination.id,
        reportPortId: details.reportPortId,
        goodId: good.id,
        quantity,
        category,
        delivered: false,
        purchased: false,
        soldQuantity: 0,
      },
    })
  }

  return quests
}
