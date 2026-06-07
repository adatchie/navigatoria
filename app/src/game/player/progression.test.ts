import { describe, expect, it } from 'vitest'
import {
  applyExperienceToPlayer,
  getTotalExperienceForLevel,
  normalizeStatsProgression,
  type ExperienceTrack,
} from './progression.ts'
import { createCharacterId } from '@/types/common.ts'
import type { CharacterStats, Player } from '@/types/character.ts'

function createStats(overrides: Partial<CharacterStats> = {}): CharacterStats {
  return {
    adventureLevel: 1,
    tradeLevel: 1,
    combatLevel: 1,
    adventureExp: 0,
    tradeExp: 0,
    combatExp: 0,
    hp: 100,
    maxHp: 100,
    fame: 0,
    notoriety: 0,
    ...overrides,
  }
}

function createPlayer(stats: CharacterStats): Player {
  return {
    id: createCharacterId('player_001'),
    name: '航海者',
    nationality: 'portugal',
    profession: 'trader',
    stats,
    skills: [],
    money: 1000,
    deposit: 0,
    debt: 0,
    inventory: [],
    position: { x: 0, y: 0 },
    heading: 0,
  }
}

describe('player progression', () => {
  it('stores experience as cumulative total after level up', () => {
    const player = createPlayer(createStats())
    const result = applyExperienceToPlayer(player, { trade: 140 })

    expect(result.player.stats.tradeLevel).toBe(3)
    expect(result.player.stats.tradeExp).toBe(140)
    expect(result.levelUps).toEqual([{ track: 'trade' satisfies ExperienceTrack, label: '交易', fromLevel: 1, toLevel: 3 }])
  })

  it('migrates legacy in-level exp without lowering the stored level', () => {
    const stats = createStats({ tradeLevel: 4, tradeExp: 20 })
    const normalized = normalizeStatsProgression(stats)

    expect(normalized.stats.tradeLevel).toBe(4)
    expect(normalized.stats.tradeExp).toBe(getTotalExperienceForLevel(4) + 20)
  })

  it('uses the stored level as the level-up notice origin for legacy saves', () => {
    const player = createPlayer(createStats({ tradeLevel: 4, tradeExp: 20 }))
    const result = applyExperienceToPlayer(player, { trade: 300 })

    expect(result.player.stats.tradeLevel).toBe(5)
    expect(result.player.stats.tradeExp).toBe(getTotalExperienceForLevel(4) + 320)
    expect(result.levelUps).toEqual([{ track: 'trade' satisfies ExperienceTrack, label: '交易', fromLevel: 4, toLevel: 5 }])
  })
})
