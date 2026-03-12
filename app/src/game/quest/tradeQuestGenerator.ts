import type { Port } from '@/types/port.ts'
import type { Quest, QuestRank, QuestReward, TradeQuestCategory } from '@/types/quest.ts'
import type { TradeGood } from '@/types/trade.ts'

const DELIVERY_REWARD_BASE = 220

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

function pickDestination(sourcePort: Port, ports: Port[], seed: number): Port {
  const nonSourcePorts = ports.filter((port) => port.id !== sourcePort.id)
  const guildPorts = nonSourcePorts.filter((port) => hasGuild(port))
  const candidates = guildPorts.length > 0 ? guildPorts : nonSourcePorts
  return candidates[seed % candidates.length] ?? sourcePort
}

function pickGood(sourcePort: Port, goods: TradeGood[], seed: number): TradeGood {
  const preferred = goods.filter((good) => sourcePort.specialProducts.includes(good.id) || good.origins.includes(sourcePort.id))
  const pool = preferred.length > 0 ? preferred : goods
  return pool[seed % pool.length]!
}

function getQuestRank(seed: number, quantity: number): QuestRank {
  const roll = seed % 100
  if (roll > 84 || quantity >= 14) return 'premium'
  if (roll > 52) return 'urgent'
  return 'standard'
}

function getQuestCategory(seed: number): TradeQuestCategory {
  const roll = seed % 3
  if (roll === 0) return 'trade_delivery'
  if (roll === 1) return 'trade_procurement'
  return 'trade_sales'
}

function getDeadlineOffset(rank: QuestRank, sameCulture: boolean, category: TradeQuestCategory): number {
  const categoryPenalty = category === 'trade_procurement' ? 1 : 0
  if (rank === 'premium') return (sameCulture ? 4 : 6) + categoryPenalty
  if (rank === 'urgent') return (sameCulture ? 3 : 5) + categoryPenalty
  return (sameCulture ? 6 : 8) + categoryPenalty
}

function getRewardMultiplier(rank: QuestRank, category: TradeQuestCategory): number {
  const rankBonus = rank === 'premium' ? 1.45 : rank === 'urgent' ? 1.2 : 1
  const categoryBonus = category === 'trade_procurement' ? 1.15 : category === 'trade_sales' ? 1.1 : 1
  return rankBonus * categoryBonus
}

function getRequiredFame(rank: QuestRank, category: TradeQuestCategory): number {
  const rankBase = rank === 'premium' ? 20 : rank === 'urgent' ? 8 : 0
  return category === 'trade_sales' ? rankBase + 4 : rankBase
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
      title: `${good.name} 買い出し依頼`,
      description: `${sourcePort.name} の交易ギルドより。${sourcePort.name} で ${good.name} を ${quantity} 個買い付け、${destination.name} へ届けてください。`,
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
    title: `${good.name} 輸送依頼`,
    description: `${sourcePort.name} の交易ギルドより。${destination.name} まで ${good.name} を ${quantity} 個届けてください。`,
    reportPortId: destination.id,
    objectives: [
      {
        type: 'deliver_item',
        target: good.id,
        count: quantity,
        current: 0,
        description: `${destination.name} へ ${good.name} を ${quantity} 個運ぶ`,
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
}): Quest[] {
  const { port, ports, goods, day, tradeLevel } = params
  const questCount = Math.max(2, Math.min(4, 2 + Math.floor(tradeLevel / 3)))

  return Array.from({ length: questCount }, (_, index) => {
    const seed = hashSeed(`${port.id}:${day}:${index}`)
    const good = pickGood(port, goods, seed)
    const destination = pickDestination(port, ports, seed + 7)
    const quantity = Math.max(3, Math.min(18, 4 + (seed % 5) * 2 + tradeLevel))
    const sameCulture = destination.culture === port.culture
    const rank = getQuestRank(seed, quantity)
    const category = getQuestCategory(seed)
    const resolvedCategory = destination.id === port.id ? 'trade_delivery' : category
    const deadlineDay = day + getDeadlineOffset(rank, sameCulture, resolvedCategory)
    const rewardMultiplier = getRewardMultiplier(rank, resolvedCategory)
    const moneyReward = Math.round((DELIVERY_REWARD_BASE + good.basePrice * quantity * 0.22) * (sameCulture ? 1 : 1.25) * rewardMultiplier)
    const expReward = Math.max(15, Math.round(moneyReward / 5))
    const fameReward = Math.max(1, Math.round(moneyReward / 140))
    const details = buildQuestDetails({ category: resolvedCategory, sourcePort: port, destination, good, quantity })
    const requiredFame = getRequiredFame(rank, resolvedCategory)

    return {
      id: `trade_${resolvedCategory}_${port.id}_${day}_${index}`,
      title: details.title,
      description: details.description,
      type: 'delivery',
      giver: `${port.name} 交易ギルド`,
      giverPort: port.id,
      status: 'available',
      rank,
      deadlineDay,
      requiredLevel: Math.max(1, tradeLevel > 0 ? tradeLevel - 1 : 1),
      requiredFame,
      rewards: buildRewards({ moneyReward, expReward, fameReward, reportPortId: details.reportPortId, rank, seed }),
      objectives: details.objectives,
      metadata: {
        sourcePortId: port.id,
        destinationPortId: destination.id,
        reportPortId: details.reportPortId,
        goodId: good.id,
        quantity,
        category: resolvedCategory,
        delivered: false,
        purchased: false,
        soldQuantity: 0,
      },
    }
  })
}
