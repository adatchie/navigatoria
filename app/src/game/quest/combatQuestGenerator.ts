import { NPC_FLEETS } from '@/data/master/npcFleets.ts'
import { WORLD_DISTANCE_SCALE } from '@/config/gameConfig.ts'
import {
  getDistanceRequiredLevel,
  getQuestDistanceFitScore,
  getQuestDistanceRewardMultiplier,
  isQuestDistanceAllowedForLevel,
  scaleQuestDeadlineDays,
} from '@/game/quest/questBalance.ts'
import { createShipId } from '@/types/common.ts'
import type { NpcFleetDefinition, NpcFleetRole } from '@/types/npcFleet.ts'
import type { Port } from '@/types/port.ts'
import type { Nationality } from '@/types/character.ts'
import type { Quest, QuestRank, QuestReward } from '@/types/quest.ts'

interface GeneratedCombatTarget {
  slug: string
  commander: string
  nationality: Nationality
  role: NpcFleetRole
  shipTypeId: string
  shipCount: number
  description: string
}

interface GeneratedCombatProfile {
  nationality: Nationality
  role: NpcFleetRole
  shipTypeId: string
  description: string
}

const GENERATED_EPITHETS = [
  '豪胆',
  '赤髭',
  '鋭眼',
  '冷静',
  '俊敏',
  '黒衣',
  '寡黙',
  '老練',
  '若鷹',
  '鉄腕',
  '陽気',
  '短気',
]

const GENERATED_GIVEN_NAMES = [
  'マルコ',
  'ルカ',
  'トマス',
  'ピエール',
  'ハンス',
  'イヴァン',
  'ニコロ',
  'ミゲル',
  'ジャン',
  'アンドレ',
  'ヤン',
  'ロレンソ',
]

const GENERATED_TARGET_PROFILES: GeneratedCombatProfile[] = [
  {
    nationality: 'portugal',
    role: 'naval',
    shipTypeId: 'pinnace',
    description: '恐れを知らない船長が率いる小艦隊。沿岸で臨検と拿捕を繰り返している。',
  },
  {
    nationality: 'portugal',
    role: 'privateer',
    shipTypeId: 'pinnace',
    description: '素性の曖昧な私掠船長の船隊。強引な交易と奇襲を得意とする。',
  },
  {
    nationality: 'spain',
    role: 'naval',
    shipTypeId: 'caravela_latina',
    description: '遠目の帆影を逃さない哨戒船長の武装小艦隊。',
  },
  {
    nationality: 'france',
    role: 'privateer',
    shipTypeId: 'pinnace',
    description: '冷静な判断で逃げ道を塞ぐ私掠船長の船隊。',
  },
  {
    nationality: 'england',
    role: 'naval',
    shipTypeId: 'armed_merchantman',
    description: '軽快な操船で商船を追い回す警備艦隊。',
  },
  {
    nationality: 'ottoman',
    role: 'corsair',
    shipTypeId: 'galley',
    description: '周辺航路で恐れられるコルセアの実戦的な小艦隊。',
  },
]

const DEFAULT_QUEST_SHIP_SPEED_KNOTS = 8
const QUEST_SUSTAINED_SPEED_FACTOR = 0.7
const QUEST_ROUTE_DISTANCE_FACTOR = 1.45

function hashSeed(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) % 2147483647
  }
  return hash
}

function distanceKm(a: Port, b: Port): number {
  return Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y) * WORLD_DISTANCE_SCALE
}

function getPortName(ports: Port[], portId?: string): string {
  return ports.find((port) => port.id === portId)?.name ?? '不明港'
}

function pickPatrolPort(appearancePort: Port, ports: Port[], seed: number, combatLevel: number): Port | null {
  const baseCandidates = ports
    .filter((port) => port.id !== appearancePort.id)
  const allowed = baseCandidates.filter((port) => isQuestDistanceAllowedForLevel(distanceKm(appearancePort, port) * 2, combatLevel))
  const candidates = (allowed.length > 0 ? allowed : baseCandidates)
    .map((port) => ({ port, distance: distanceKm(appearancePort, port) * 2 }))
    .sort((a, b) => {
      const scoreDelta = getQuestDistanceFitScore(b.distance, combatLevel) - getQuestDistanceFitScore(a.distance, combatLevel)
      if (Math.abs(scoreDelta) > 0.01) return scoreDelta
      return a.distance - b.distance
    })
    .slice(0, 6)
    .map((entry) => entry.port)
  return candidates[seed % candidates.length] ?? null
}

function pickGeneratedShipType(seed: number, combatLevel: number): string {
  const pool = combatLevel <= 2
    ? ['barca', 'dhow']
    : combatLevel <= 4
      ? ['barca', 'dhow', 'pinnace']
      : combatLevel <= 7
        ? ['pinnace', 'caravela_latina', 'sambuk']
        : combatLevel <= 11
          ? ['caravela_latina', 'caravel_redonda', 'sambuk', 'galley']
          : ['caravel_redonda', 'sambuk', 'galley', 'armed_merchantman']

  return pool[seed % pool.length]!
}

function pickGeneratedShipCount(seed: number, rank: QuestRank, combatLevel: number, playerFleetShipCount: number): number {
  const levelCap = combatLevel <= 2 ? 1 : combatLevel <= 4 ? 2 : combatLevel <= 8 ? 3 : combatLevel <= 14 ? 4 : 5
  const rankBonus = rank === 'premium' ? 1 : 0
  const fleetCap = Math.max(1, Math.min(5, playerFleetShipCount + rankBonus))
  const maxCount = Math.max(1, Math.min(levelCap, fleetCap))
  if (maxCount <= 1) return 1
  return Math.max(1, maxCount - (seed % 3 === 0 ? 1 : 0))
}

function createGeneratedTarget(seed: number, index: number, combatLevel: number, playerFleetShipCount: number, rank: QuestRank): GeneratedCombatTarget {
  const epithetIndex = (seed + index * 5) % GENERATED_EPITHETS.length
  const nameIndex = (Math.floor(seed / 7) + index * 3) % GENERATED_GIVEN_NAMES.length
  const profileIndex = (Math.floor(seed / 13) + index) % GENERATED_TARGET_PROFILES.length
  const epithet = GENERATED_EPITHETS[epithetIndex]!
  const givenName = GENERATED_GIVEN_NAMES[nameIndex]!
  const profile = GENERATED_TARGET_PROFILES[profileIndex]!
  const shipCount = pickGeneratedShipCount(seed + index * 11, rank, combatLevel, playerFleetShipCount)

  return {
    slug: `generated_${epithetIndex}_${nameIndex}_${profileIndex}`,
    commander: `${epithet}の${givenName}`,
    nationality: profile.nationality,
    role: profile.role,
    shipTypeId: pickGeneratedShipType(seed + profileIndex * 17, combatLevel),
    shipCount,
    description: profile.description,
  }
}

function getRank(seed: number, combatLevel: number): QuestRank {
  const roll = seed % 100
  if (combatLevel >= 8 && roll > 62) return 'premium'
  if (combatLevel >= 3 && roll > 48) return 'urgent'
  return 'standard'
}

function getTravelDays(distanceKmValue: number, shipSpeedKnots = DEFAULT_QUEST_SHIP_SPEED_KNOTS): number {
  const sustainedSpeedKnots = Math.max(3, shipSpeedKnots * QUEST_SUSTAINED_SPEED_FACTOR)
  const kmPerDay = sustainedSpeedKnots * 1.852 * 24
  return Math.ceil((distanceKmValue * QUEST_ROUTE_DISTANCE_FACTOR) / kmPerDay)
}

function getDeadlineOffset(rank: QuestRank, distanceKmValue: number, shipSpeedKnots?: number): number {
  const routeDays = getTravelDays(distanceKmValue, shipSpeedKnots)
  const buffer = rank === 'premium' ? 12 : rank === 'urgent' ? 10 : 14
  return scaleQuestDeadlineDays(Math.max(rank === 'premium' ? 18 : 14, routeDays + buffer))
}

function getRequiredLevel(rank: QuestRank, existingTarget: boolean, distanceKmValue: number): number | undefined {
  const distanceGate = getDistanceRequiredLevel(distanceKmValue)
  if (!existingTarget && rank === 'standard') return distanceGate
  if (existingTarget) return Math.max(rank === 'premium' ? 8 : 6, distanceGate ?? 0)
  return Math.max(rank === 'premium' ? 5 : 3, distanceGate ?? 0)
}

function buildRewards(params: {
  rank: QuestRank
  combatLevel: number
  distanceKmValue: number
  reportPortId: string
  existingTarget: boolean
}): QuestReward[] {
  const rankMultiplier = params.rank === 'premium' ? 1.75 : params.rank === 'urgent' ? 1.3 : 1
  const targetMultiplier = params.existingTarget ? 1.55 : 1
  const distanceMultiplier = getQuestDistanceRewardMultiplier(params.distanceKmValue)
  const money = Math.round((420 + params.combatLevel * 80 + params.distanceKmValue * 0.035) * rankMultiplier * targetMultiplier * distanceMultiplier)
  const exp = Math.max(24, Math.round((money / 6) * (params.existingTarget ? 1.15 : 1)))
  const fame = Math.max(1, Math.round(money / 180))
  return [
    { type: 'money', amount: money },
    { type: 'exp', amount: exp },
    { type: 'fame', amount: fame },
    { type: 'influence', amount: params.rank === 'premium' ? 4 : params.rank === 'urgent' ? 3 : 2, portId: params.reportPortId },
  ]
}

function buildGeneratedFleet(params: {
  questId: string
  target: GeneratedCombatTarget
  appearancePort: Port
  patrolPort: Port
  seed: number
  rank: QuestRank
}): NpcFleetDefinition {
  const { questId, target, appearancePort, patrolPort, seed, rank } = params
  const speedBonus = rank === 'premium' ? 0.6 : rank === 'urgent' ? 0.3 : 0
  return {
    id: `quest_target_${questId}`,
    name: `${target.commander}艦隊`,
    commander: target.commander,
    nationality: target.nationality,
    role: target.role,
    shipTypeId: createShipId(target.shipTypeId),
    shipCount: target.shipCount,
    routePortIds: [appearancePort.id, patrolPort.id],
    appearancePortId: appearancePort.id,
    patrolPortId: patrolPort.id,
    speedKnots: 7.2 + (seed % 8) * 0.16 + speedBonus,
    departureOffsetDays: seed % 9,
    dwellDays: 0.7,
    laneOffsetKm: ((seed % 7) - 3) * 7,
    description: target.description,
    interactionTags: ['battle'],
    questOnly: true,
  }
}

function pickFamousFleet(port: Port, ports: Port[], seed: number, combatLevel: number): NpcFleetDefinition | null {
  const portById = new Map(ports.map((entry) => [entry.id, entry]))
  const candidates = NPC_FLEETS
    .filter((fleet) => fleet.interactionTags.includes('battle'))
    .map((fleet) => {
      const appearancePort = portById.get(fleet.appearancePortId ?? fleet.routePortIds[0])
      const patrolPort = portById.get(fleet.patrolPortId ?? fleet.routePortIds[1])
      const distance = appearancePort && patrolPort
        ? distanceKm(port, appearancePort) + distanceKm(appearancePort, patrolPort)
        : Number.POSITIVE_INFINITY
      return { fleet, appearancePort, distance }
    })
    .filter((entry) => Number.isFinite(entry.distance))
    .filter((entry) => isQuestDistanceAllowedForLevel(entry.distance, combatLevel))
    .sort((a, b) => {
      const scoreDelta = getQuestDistanceFitScore(b.distance, combatLevel) - getQuestDistanceFitScore(a.distance, combatLevel)
      if (Math.abs(scoreDelta) > 0.01) return scoreDelta
      return a.distance - b.distance
    })
    .slice(0, 6)
  return candidates[seed % candidates.length]?.fleet ?? null
}

function buildCombatQuest(params: {
  port: Port
  ports: Port[]
  day: number
  combatLevel: number
  shipSpeedKnots?: number
  playerFleetShipCount: number
  index: number
  existingFleet?: NpcFleetDefinition
}): Quest | null {
  const { port, ports, day, combatLevel, shipSpeedKnots, playerFleetShipCount, index, existingFleet } = params
  const seed = hashSeed(`${port.id}:${day}:combat:${index}`)
  const rank = getRank(seed, combatLevel)
  const portById = new Map(ports.map((entry) => [entry.id, entry]))
  const appearancePort = existingFleet
    ? portById.get(existingFleet.appearancePortId ?? existingFleet.routePortIds[0])
    : port
  if (!appearancePort) return null

  const patrolPort = existingFleet
    ? portById.get(existingFleet.patrolPortId ?? existingFleet.routePortIds[1])
    : pickPatrolPort(appearancePort, ports, seed + 17, combatLevel)
  if (!patrolPort || appearancePort.id === patrolPort.id) return null

  const target = createGeneratedTarget(seed, index, combatLevel, playerFleetShipCount, rank)
  const questId = existingFleet
    ? `combat_famous_${existingFleet.id}_${port.id}_${day}_${index}`
    : `combat_bounty_${port.id}_${day}_${index}`
  const generatedFleet = existingFleet
    ? undefined
    : buildGeneratedFleet({ questId, target, appearancePort, patrolPort, seed, rank })
  const targetFleet = existingFleet ?? generatedFleet
  if (!targetFleet) return null

  const targetName = targetFleet.commander
  const patrolDistance = distanceKm(appearancePort, patrolPort)
  const distanceKmValue = existingFleet ? distanceKm(port, appearancePort) + patrolDistance : patrolDistance * 2
  if (!isQuestDistanceAllowedForLevel(distanceKmValue, combatLevel)) return null
  const deadlineDay = day + getDeadlineOffset(rank, distanceKmValue, shipSpeedKnots)
  const existingTarget = Boolean(existingFleet)
  const appearancePortName = getPortName(ports, appearancePort.id)

  return {
    id: questId,
    title: `${targetName} 討伐依頼`,
    description: `${port.name} の海事ギルドより。${appearancePortName}付近に出没する ${targetName} の艦隊を捕捉し、撃破してください。対象は ${targetFleet.shipCount ?? 1} 隻規模です。報酬は討伐確認後ただちに支払われます。`,
    type: 'combat',
    giver: `${port.name} 海事ギルド`,
    giverPort: port.id,
    status: 'available',
    rank,
    deadlineDay,
    requiredLevel: getRequiredLevel(rank, existingTarget, distanceKmValue),
    requiredFame: existingTarget ? 18 : rank === 'premium' ? 8 : 0,
    rewards: buildRewards({ rank, combatLevel, distanceKmValue, reportPortId: port.id, existingTarget }),
    objectives: [
      {
        type: 'defeat_enemy',
        target: targetFleet.id,
        count: 1,
        current: 0,
        description: `${targetName} の艦隊を撃破する（${targetFleet.shipCount ?? 1} 隻規模）`,
      },
    ],
    metadata: {
      category: 'combat_bounty',
      reportPortId: port.id,
      combatTargetFleetId: targetFleet.id,
      combatTargetName: targetName,
      combatTargetAppearancePortId: appearancePort.id,
      combatTargetPatrolPortId: patrolPort.id,
      combatTargetExisting: existingTarget,
      combatTargetFleet: generatedFleet,
    },
  }
}

export function generateCombatQuestsForPort(params: {
  port: Port
  ports: Port[]
  day: number
  combatLevel: number
  playerFleetShipCount?: number
  shipSpeedKnots?: number
}): Quest[] {
  const { port, ports, day, combatLevel, shipSpeedKnots } = params
  const playerFleetShipCount = Math.max(1, Math.floor(params.playerFleetShipCount ?? 1))
  const quests: Quest[] = []
  const seed = hashSeed(`${port.id}:${day}:combat`)
  const shouldOfferFamous = combatLevel >= 6 && seed % 3 === 0
  const famousFleet = shouldOfferFamous ? pickFamousFleet(port, ports, seed + 29, combatLevel) : null

  const first = buildCombatQuest({ port, ports, day, combatLevel, shipSpeedKnots, playerFleetShipCount, index: 0 })
  if (first) quests.push(first)

  if (famousFleet) {
    const second = buildCombatQuest({ port, ports, day, combatLevel, shipSpeedKnots, playerFleetShipCount, index: 1, existingFleet: famousFleet })
    if (second) quests.push(second)
  } else if (combatLevel >= 4) {
    const second = buildCombatQuest({ port, ports, day, combatLevel, shipSpeedKnots, playerFleetShipCount, index: 1 })
    if (second) quests.push(second)
  }

  return quests
}
