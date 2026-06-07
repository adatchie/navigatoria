import type { CharacterStats, Player, ProfessionType } from '@/types/character.ts'

export type ExperienceTrack = 'adventure' | 'trade' | 'combat'

export interface ExperienceTrackDefinition {
  id: ExperienceTrack
  levelKey: 'adventureLevel' | 'tradeLevel' | 'combatLevel'
  expKey: 'adventureExp' | 'tradeExp' | 'combatExp'
  label: string
  profession: ProfessionType
}

export interface LevelUpEntry {
  track: ExperienceTrack
  label: string
  fromLevel: number
  toLevel: number
}

export interface ExperienceGrantResult {
  player: Player
  levelUps: LevelUpEntry[]
  appliedExp: Partial<Record<ExperienceTrack, number>>
}

export const MAX_PLAYER_LEVEL = 50

export const EXPERIENCE_TRACKS: ExperienceTrackDefinition[] = [
  { id: 'adventure', levelKey: 'adventureLevel', expKey: 'adventureExp', label: '冒険', profession: 'adventurer' },
  { id: 'trade', levelKey: 'tradeLevel', expKey: 'tradeExp', label: '交易', profession: 'trader' },
  { id: 'combat', levelKey: 'combatLevel', expKey: 'combatExp', label: '戦闘', profession: 'soldier' },
]

const TRACK_BY_ID = new Map(EXPERIENCE_TRACKS.map((track) => [track.id, track]))

function getTrackDefinition(track: ExperienceTrack): ExperienceTrackDefinition {
  return TRACK_BY_ID.get(track) ?? EXPERIENCE_TRACKS[0]!
}

function clampLevel(level: number): number {
  return Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.floor(level) || 1))
}

export function getExperienceForNextLevel(currentLevel: number): number {
  if (currentLevel >= MAX_PLAYER_LEVEL) return 0
  return (clampLevel(currentLevel) + 1) ** 2 * 10
}

export function getTotalExperienceForLevel(level: number): number {
  const normalizedLevel = clampLevel(level)
  let total = 0
  for (let currentLevel = 1; currentLevel < normalizedLevel; currentLevel++) {
    total += getExperienceForNextLevel(currentLevel)
  }
  return total
}

export function getTrackLevel(stats: CharacterStats, track: ExperienceTrack): number {
  return clampLevel(stats[getTrackDefinition(track).levelKey])
}

export function getTrackExp(stats: CharacterStats, track: ExperienceTrack): number {
  const rawExp = Math.max(0, Math.floor(stats[getTrackDefinition(track).expKey] ?? 0))
  const levelFloorExp = getTotalExperienceForLevel(getTrackLevel(stats, track))
  return rawExp < levelFloorExp ? levelFloorExp + rawExp : rawExp
}

export function getTrackProgress(stats: CharacterStats, track: ExperienceTrack): { current: number; required: number; total: number } {
  const level = getTrackLevel(stats, track)
  const total = getTrackExp(stats, track)
  const levelFloorExp = getTotalExperienceForLevel(level)
  return {
    current: Math.max(0, total - levelFloorExp),
    required: getExperienceForNextLevel(level),
    total,
  }
}

function getProfessionAdjustedExp(amount: number, track: ExperienceTrack, profession: ProfessionType, applyProfessionModifier: boolean): number {
  if (amount <= 0) return 0
  const trackDef = getTrackDefinition(track)
  const factor = applyProfessionModifier && profession !== trackDef.profession ? 0.5 : 1
  return Math.max(1, Math.round(amount * factor))
}

function normalizeTrack(stats: CharacterStats, track: ExperienceTrack): { stats: CharacterStats; levelUp?: LevelUpEntry } {
  const trackDef = getTrackDefinition(track)
  const fromLevel = getTrackLevel(stats, track)
  let level = 1
  const exp = getTrackExp(stats, track)

  while (level < MAX_PLAYER_LEVEL) {
    const nextLevelExp = getTotalExperienceForLevel(level + 1)
    if (exp < nextLevelExp) break
    level += 1
  }

  level = Math.max(fromLevel, level)

  const nextStats = {
    ...stats,
    [trackDef.levelKey]: level,
    [trackDef.expKey]: exp,
  }

  return {
    stats: nextStats,
    levelUp: level > fromLevel ? { track, label: trackDef.label, fromLevel, toLevel: level } : undefined,
  }
}

export function normalizeStatsProgression(stats: CharacterStats): { stats: CharacterStats; levelUps: LevelUpEntry[] } {
  return EXPERIENCE_TRACKS.reduce(
    (current, track) => {
      const result = normalizeTrack(current.stats, track.id)
      return {
        stats: result.stats,
        levelUps: result.levelUp ? [...current.levelUps, result.levelUp] : current.levelUps,
      }
    },
    { stats, levelUps: [] as LevelUpEntry[] },
  )
}

export function applyExperienceToPlayer(
  player: Player,
  gains: Partial<Record<ExperienceTrack, number>>,
  options: { applyProfessionModifier?: boolean } = {},
): ExperienceGrantResult {
  const applyProfessionModifier = options.applyProfessionModifier ?? false
  let stats = player.stats
  const levelUps: LevelUpEntry[] = []
  const appliedExp: Partial<Record<ExperienceTrack, number>> = {}

  for (const trackDef of EXPERIENCE_TRACKS) {
    const rawAmount = gains[trackDef.id] ?? 0
    const amount = getProfessionAdjustedExp(rawAmount, trackDef.id, player.profession, applyProfessionModifier)
    if (amount <= 0) continue

    stats = {
      ...stats,
      [trackDef.expKey]: getTrackExp(stats, trackDef.id) + amount,
    }
    appliedExp[trackDef.id] = amount

    const normalized = normalizeTrack(stats, trackDef.id)
    stats = normalized.stats
    if (normalized.levelUp) levelUps.push(normalized.levelUp)
  }

  return {
    player: { ...player, stats },
    levelUps,
    appliedExp,
  }
}

export function normalizePlayerProgression(player: Player): Player {
  return { ...player, stats: normalizeStatsProgression(player.stats).stats }
}

export function formatLevelUpNotice(levelUps: LevelUpEntry[]): string | null {
  if (levelUps.length === 0) return null
  return levelUps.map((entry) => `${entry.label}Lv ${entry.fromLevel} -> ${entry.toLevel}`).join(' / ')
}
