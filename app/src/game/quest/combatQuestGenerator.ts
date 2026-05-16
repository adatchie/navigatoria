import { NPC_FLEETS } from '@/data/master/npcFleets.ts'
import { WORLD_DISTANCE_SCALE } from '@/config/gameConfig.ts'
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
  description: string
}

const GENERATED_TARGETS: GeneratedCombatTarget[] = [
  {
    slug: 'diogo_de_silveira',
    commander: 'ディオゴ・デ・シルヴェイラ',
    nationality: 'portugal',
    role: 'naval',
    shipTypeId: 'pinnace',
    description: 'ポルトガル系船長の小艦隊。沿岸で臨検と拿捕を繰り返している。',
  },
  {
    slug: 'simao_de_andrade',
    commander: 'シモン・デ・アンドラーデ',
    nationality: 'portugal',
    role: 'privateer',
    shipTypeId: 'pinnace',
    description: '強引な交易と私掠で知られるポルトガル船長の船隊。',
  },
  {
    slug: 'alonso_de_ojeda',
    commander: 'アロンソ・デ・オヘダ',
    nationality: 'spain',
    role: 'naval',
    shipTypeId: 'caravela_latina',
    description: 'スペイン王権の名を掲げる武装小艦隊。',
  },
  {
    slug: 'guillaume_le_testu',
    commander: 'ギヨーム・ル・テステュ',
    nationality: 'france',
    role: 'privateer',
    shipTypeId: 'pinnace',
    description: '海図と奇襲に長けたフランス私掠船長の船隊。',
  },
  {
    slug: 'william_winter',
    commander: 'ウィリアム・ウィンター',
    nationality: 'england',
    role: 'naval',
    shipTypeId: 'armed_merchantman',
    description: 'イングランド海軍士官の指揮する警備艦隊。',
  },
  {
    slug: 'salih_reis',
    commander: 'サーリフ・レイス',
    nationality: 'ottoman',
    role: 'corsair',
    shipTypeId: 'galley',
    description: 'オスマン系コルセアの実戦的な小艦隊。',
  },
]

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

function pickPatrolPort(appearancePort: Port, ports: Port[], seed: number): Port | null {
  const candidates = ports
    .filter((port) => port.id !== appearancePort.id)
    .sort((a, b) => distanceKm(appearancePort, a) - distanceKm(appearancePort, b))
    .slice(0, 4)
  return candidates[seed % candidates.length] ?? null
}

function getRank(seed: number, combatLevel: number): QuestRank {
  const roll = seed % 100
  if (combatLevel >= 8 && roll > 62) return 'premium'
  if (combatLevel >= 3 && roll > 48) return 'urgent'
  return 'standard'
}

function getDeadlineOffset(rank: QuestRank, distanceKmValue: number): number {
  const routeDays = Math.ceil(distanceKmValue / (8 * 1.852 * 24) * 1.45)
  const buffer = rank === 'premium' ? 12 : rank === 'urgent' ? 10 : 14
  return Math.max(rank === 'premium' ? 18 : 14, routeDays + buffer)
}

function getRequiredLevel(rank: QuestRank, existingTarget: boolean): number | undefined {
  if (!existingTarget && rank === 'standard') return undefined
  if (existingTarget) return rank === 'premium' ? 8 : 6
  return rank === 'premium' ? 5 : 3
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
  const money = Math.round((420 + params.combatLevel * 80 + params.distanceKmValue * 0.035) * rankMultiplier * targetMultiplier)
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

function pickFamousFleet(port: Port, ports: Port[], seed: number): NpcFleetDefinition | null {
  const portById = new Map(ports.map((entry) => [entry.id, entry]))
  const candidates = NPC_FLEETS
    .filter((fleet) => fleet.interactionTags.includes('battle'))
    .map((fleet) => {
      const appearancePort = portById.get(fleet.appearancePortId ?? fleet.routePortIds[0])
      return { fleet, appearancePort, distance: appearancePort ? distanceKm(port, appearancePort) : Number.POSITIVE_INFINITY }
    })
    .filter((entry) => Number.isFinite(entry.distance))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6)
  return candidates[seed % candidates.length]?.fleet ?? null
}

function buildCombatQuest(params: {
  port: Port
  ports: Port[]
  day: number
  combatLevel: number
  index: number
  existingFleet?: NpcFleetDefinition
}): Quest | null {
  const { port, ports, day, combatLevel, index, existingFleet } = params
  const seed = hashSeed(`${port.id}:${day}:combat:${index}`)
  const rank = getRank(seed, combatLevel)
  const portById = new Map(ports.map((entry) => [entry.id, entry]))
  const appearancePort = existingFleet
    ? portById.get(existingFleet.appearancePortId ?? existingFleet.routePortIds[0])
    : port
  if (!appearancePort) return null

  const patrolPort = existingFleet
    ? portById.get(existingFleet.patrolPortId ?? existingFleet.routePortIds[1])
    : pickPatrolPort(appearancePort, ports, seed + 17)
  if (!patrolPort || appearancePort.id === patrolPort.id) return null

  const target = GENERATED_TARGETS[(seed + index) % GENERATED_TARGETS.length]!
  const questId = existingFleet
    ? `combat_famous_${existingFleet.id}_${port.id}_${day}_${index}`
    : `combat_bounty_${port.id}_${day}_${index}`
  const generatedFleet = existingFleet
    ? undefined
    : buildGeneratedFleet({ questId, target, appearancePort, patrolPort, seed, rank })
  const targetFleet = existingFleet ?? generatedFleet
  if (!targetFleet) return null

  const targetName = targetFleet.commander
  const distanceKmValue = distanceKm(appearancePort, patrolPort) * 2
  const deadlineDay = day + getDeadlineOffset(rank, distanceKmValue)
  const existingTarget = Boolean(existingFleet)
  const appearancePortName = getPortName(ports, appearancePort.id)

  return {
    id: questId,
    title: `${targetName} 討伐依頼`,
    description: `${port.name} の海事ギルドより。${appearancePortName}付近に出没する ${targetName} の艦隊を捕捉し、撃破してください。報酬は討伐確認後ただちに支払われます。`,
    type: 'combat',
    giver: `${port.name} 海事ギルド`,
    giverPort: port.id,
    status: 'available',
    rank,
    deadlineDay,
    requiredLevel: getRequiredLevel(rank, existingTarget),
    requiredFame: existingTarget ? 18 : rank === 'premium' ? 8 : 0,
    rewards: buildRewards({ rank, combatLevel, distanceKmValue, reportPortId: port.id, existingTarget }),
    objectives: [
      {
        type: 'defeat_enemy',
        target: targetFleet.id,
        count: 1,
        current: 0,
        description: `${targetName} の艦隊を撃破する`,
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
}): Quest[] {
  const { port, ports, day, combatLevel } = params
  const quests: Quest[] = []
  const seed = hashSeed(`${port.id}:${day}:combat`)
  const shouldOfferFamous = combatLevel >= 6 && seed % 3 === 0
  const famousFleet = shouldOfferFamous ? pickFamousFleet(port, ports, seed + 29) : null

  const first = buildCombatQuest({ port, ports, day, combatLevel, index: 0, existingFleet: famousFleet ?? undefined })
  if (first) quests.push(first)

  if (combatLevel >= 4) {
    const second = buildCombatQuest({ port, ports, day, combatLevel, index: 1 })
    if (second) quests.push(second)
  }

  return quests
}
