import { describe, expect, it } from 'vitest'
import portsJson from '@/data/master/ports.json'
import { generateCombatQuestsForPort } from './combatQuestGenerator.ts'
import type { Port } from '@/types/port.ts'

const ports = portsJson as Port[]
const lisbon = ports.find((port) => port.id === 'lisbon')!

describe('generateCombatQuestsForPort', () => {
  it('keeps level 1 bounty targets to one small ship even with a larger player fleet', () => {
    const quests = generateCombatQuestsForPort({
      port: lisbon,
      ports,
      day: 1,
      combatLevel: 1,
      playerFleetShipCount: 5,
    })

    const fleet = quests[0]?.metadata?.combatTargetFleet
    expect(fleet?.shipCount).toBe(1)
    expect(['barca', 'dhow']).toContain(fleet?.shipTypeId)
  })

  it('allows generated targets to scale with combat level and player fleet count', () => {
    const quests = generateCombatQuestsForPort({
      port: lisbon,
      ports,
      day: 4,
      combatLevel: 8,
      playerFleetShipCount: 3,
    })

    const fleet = quests[0]?.metadata?.combatTargetFleet
    expect(fleet?.shipCount).toBeGreaterThanOrEqual(2)
    expect(fleet?.shipCount).toBeLessThanOrEqual(3)
  })
})
