import { WORLD_DISTANCE_SCALE } from '@/config/gameConfig.ts'
import {
  getDistanceRequiredLevel,
  getQuestDistanceFitScore,
  getQuestDistanceRewardMultiplier,
  getRankRewardMultiplier,
  isQuestDistanceAllowedForLevel,
  scaleQuestDeadlineDays,
} from '@/game/quest/questBalance.ts'
import type { Discovery } from '@/types/discovery.ts'
import type { Port } from '@/types/port.ts'
import type { Quest, QuestRank, QuestReward } from '@/types/quest.ts'

const DEFAULT_QUEST_SHIP_SPEED_KNOTS = 8
const QUEST_ROUTE_DISTANCE_FACTOR = 1.25

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

function distanceKm(port: Port, discovery: Discovery): number {
  return Math.hypot(discovery.position.x - port.position.x, discovery.position.y - port.position.y) * WORLD_DISTANCE_SCALE
}

function getTravelDays(distanceKmValue: number, shipSpeedKnots = DEFAULT_QUEST_SHIP_SPEED_KNOTS): number {
  const kmPerDay = Math.max(3, shipSpeedKnots * 0.7) * 1.852 * 24
  return Math.ceil((distanceKmValue * QUEST_ROUTE_DISTANCE_FACTOR) / kmPerDay)
}

function getRank(discovery: Discovery): QuestRank {
  if (discovery.rank >= 3) return 'premium'
  if (discovery.rank >= 2) return 'urgent'
  return 'standard'
}

function getMethodLabel(discovery: Discovery): string {
  return discovery.method === 'search' ? '探索' : '視認'
}

function getCategoryLabel(discovery: Discovery): string {
  if (discovery.category === 'geography') return '地理'
  if (discovery.category === 'ruins') return '遺構'
  if (discovery.category === 'treasure') return '財宝'
  if (discovery.category === 'natural') return '自然'
  return '伝承'
}

function getMaxDiscoveryRank(adventureLevel: number): number {
  if (adventureLevel >= 8) return 3
  if (adventureLevel >= 3) return 2
  return 1
}

function buildRewards(discovery: Discovery, reportPortId: string, distanceKmValue: number): QuestReward[] {
  const rankMultiplier = getRankRewardMultiplier(discovery.rank >= 3 ? 'premium' : discovery.rank >= 2 ? 'urgent' : 'standard')
  const distanceMultiplier = getQuestDistanceRewardMultiplier(distanceKmValue)
  const money = Math.round((180 + discovery.exp * 5) * rankMultiplier * distanceMultiplier)
  const exp = Math.round(discovery.exp * distanceMultiplier * 1.35)
  const fame = Math.max(discovery.fame, Math.round(discovery.fame * Math.min(2.6, distanceMultiplier)))
  return [
    { type: 'money', amount: money },
    { type: 'exp', amount: exp },
    { type: 'fame', amount: fame },
    { type: 'influence', amount: discovery.rank >= 3 ? 4 : discovery.rank >= 2 ? 3 : 2, portId: reportPortId },
  ]
}

export function generateAdventureQuestsForPort(params: {
  port: Port
  ports: Port[]
  discoveries: Discovery[]
  day: number
  adventureLevel: number
  completedDiscoveryIds: string[]
  activeDiscoveryIds: string[]
  shipSpeedKnots?: number
}): Quest[] {
  const { port, ports, discoveries, day, adventureLevel, completedDiscoveryIds, activeDiscoveryIds, shipSpeedKnots } = params
  if (!hasGuild(port)) return []

  const completed = new Set(completedDiscoveryIds)
  const active = new Set(activeDiscoveryIds)
  const portById = new Map(ports.map((entry) => [entry.id, entry]))
  const baseSeed = hashSeed(`${port.id}:${day}:adventure`)
  const questCount = Math.max(1, Math.min(3, 1 + Math.floor(adventureLevel / 4)))
  const candidates = discoveries
    .filter((discovery) => !completed.has(discovery.id) && !active.has(discovery.id))
    .filter((discovery) => portById.has(discovery.reportPortId))
    .map((discovery) => ({ discovery, reportPort: portById.get(discovery.reportPortId)!, distance: distanceKm(port, discovery) }))
    .filter((entry) => entry.discovery.rank <= getMaxDiscoveryRank(adventureLevel))
    .filter((entry) => isQuestDistanceAllowedForLevel(entry.distance, adventureLevel))
    .sort((a, b) => {
      const reportBiasA = a.discovery.reportPortId === port.id ? 0.3 : 0
      const reportBiasB = b.discovery.reportPortId === port.id ? 0.3 : 0
      return (getQuestDistanceFitScore(b.distance, adventureLevel) + reportBiasB) - (getQuestDistanceFitScore(a.distance, adventureLevel) + reportBiasA)
    })
    .slice(0, 8)

  const quests: Quest[] = []
  for (let index = 0; index < Math.min(questCount, candidates.length); index++) {
    const candidateIndex = (baseSeed + index * 3) % candidates.length
    const { discovery, reportPort, distance } = candidates[candidateIndex]!
    if (quests.some((quest) => quest.metadata?.discoveryId === discovery.id)) continue

    const rank = getRank(discovery)
    const baseDeadline = Math.max(12, getTravelDays(distance, shipSpeedKnots) + 8 + discovery.rank * 2)
    const deadlineDay = day + scaleQuestDeadlineDays(baseDeadline)
    const methodLabel = getMethodLabel(discovery)
    const hint = discovery.hints[(baseSeed + index) % discovery.hints.length] ?? discovery.hints[0] ?? '海図と噂を頼りに周辺を調べる。'
    const requiredLevel = Math.max(Math.max(1, discovery.rank - 1), getDistanceRequiredLevel(distance) ?? 0)

    quests.push({
      id: `adventure_discovery_${discovery.id}_${port.id}_${day}_${index}`,
      title: `${getCategoryLabel(discovery)}発見の手がかり`,
      description: `${port.name} の冒険者ギルドより。${hint} 目標周辺で${methodLabel}を行い、発見後は ${reportPort.name} のギルドへ報告してください。`,
      type: 'discovery',
      giver: `${port.name} 冒険者ギルド`,
      giverPort: port.id,
      status: 'available',
      rank,
      deadlineDay,
      requiredLevel,
      requiredSkill: discovery.requiredSkill,
      rewards: buildRewards(discovery, reportPort.id, distance),
      objectives: [
        {
          type: 'discover',
          target: discovery.id,
          count: 1,
          current: 0,
          description: `手がかりの示す発見物を${methodLabel}で発見する`,
        },
        {
          type: 'visit_port',
          target: reportPort.id,
          count: 1,
          current: 0,
          description: `${reportPort.name} のギルドに報告する`,
        },
      ],
      metadata: {
        category: 'adventure_discovery',
        reportPortId: reportPort.id,
        discoveryId: discovery.id,
        discoveryName: discovery.name,
        discoveryMethod: discovery.method,
        discoveryHint: hint,
        discoveryRadiusKm: discovery.radiusKm,
        discoverySkillId: discovery.requiredSkill.skillId,
      },
    })
  }

  return quests
}
