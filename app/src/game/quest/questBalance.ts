import type { QuestRank } from '@/types/quest.ts'

interface QuestDistanceProfile {
  maxLevel: number
  preferredMinKm: number
  preferredMaxKm: number
  absoluteMaxKm: number
}

const DISTANCE_PROFILES: QuestDistanceProfile[] = [
  { maxLevel: 1, preferredMinKm: 120, preferredMaxKm: 1800, absoluteMaxKm: 2600 },
  { maxLevel: 3, preferredMinKm: 350, preferredMaxKm: 2800, absoluteMaxKm: 4200 },
  { maxLevel: 5, preferredMinKm: 700, preferredMaxKm: 4200, absoluteMaxKm: 6200 },
  { maxLevel: 8, preferredMinKm: 1200, preferredMaxKm: 6500, absoluteMaxKm: 9000 },
  { maxLevel: 12, preferredMinKm: 2200, preferredMaxKm: 9500, absoluteMaxKm: 12500 },
  { maxLevel: 16, preferredMinKm: 3800, preferredMaxKm: 13500, absoluteMaxKm: 17000 },
  { maxLevel: 22, preferredMinKm: 6000, preferredMaxKm: 18500, absoluteMaxKm: 22000 },
  { maxLevel: Number.POSITIVE_INFINITY, preferredMinKm: 8500, preferredMaxKm: 25000, absoluteMaxKm: 32000 },
]

export const QUEST_DEADLINE_SAFETY_MULTIPLIER = 2

export function getQuestDistanceProfile(level: number): QuestDistanceProfile {
  const normalizedLevel = Math.max(1, Math.floor(level))
  return DISTANCE_PROFILES.find((profile) => normalizedLevel <= profile.maxLevel) ?? DISTANCE_PROFILES[DISTANCE_PROFILES.length - 1]!
}

export function isQuestDistanceAllowedForLevel(distanceKm: number, level: number): boolean {
  return distanceKm <= getQuestDistanceProfile(level).absoluteMaxKm
}

export function getQuestDistanceFitScore(distanceKm: number, level: number): number {
  const profile = getQuestDistanceProfile(level)
  if (distanceKm > profile.absoluteMaxKm) return -8

  if (distanceKm >= profile.preferredMinKm && distanceKm <= profile.preferredMaxKm) {
    const center = (profile.preferredMinKm + profile.preferredMaxKm) / 2
    const halfWidth = Math.max(1, (profile.preferredMaxKm - profile.preferredMinKm) / 2)
    return 2 - Math.abs(distanceKm - center) / halfWidth
  }

  if (distanceKm < profile.preferredMinKm) {
    const shortfall = (profile.preferredMinKm - distanceKm) / Math.max(1, profile.preferredMinKm)
    return 1 - shortfall * 0.7
  }

  const overPreferred = distanceKm - profile.preferredMaxKm
  const outerBand = Math.max(1, profile.absoluteMaxKm - profile.preferredMaxKm)
  return 0.65 - (overPreferred / outerBand) * 1.5
}

export function getQuestDistanceRewardMultiplier(distanceKm: number): number {
  const distanceBonus = Math.min(4.2, Math.max(0, distanceKm) / 5500)
  return Math.round((1 + distanceBonus) * 100) / 100
}

export function scaleQuestDeadlineDays(days: number): number {
  return Math.ceil(days * QUEST_DEADLINE_SAFETY_MULTIPLIER)
}

export function getDistanceRequiredLevel(distanceKm: number): number | undefined {
  if (distanceKm >= 22000) return 23
  if (distanceKm >= 17000) return 17
  if (distanceKm >= 12500) return 13
  if (distanceKm >= 9000) return 9
  if (distanceKm >= 6200) return 6
  if (distanceKm >= 4200) return 4
  if (distanceKm >= 2600) return 2
  return undefined
}

export function getRankRewardMultiplier(rank: QuestRank): number {
  if (rank === 'premium') return 1.45
  if (rank === 'urgent') return 1.2
  return 1
}
