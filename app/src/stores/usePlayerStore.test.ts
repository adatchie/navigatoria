import { describe, expect, it, vi } from 'vitest'
import { createShipId } from '@/types/common.ts'
import type { ShipInstance } from '@/types/ship.ts'

function ship(instanceId: string, typeId: string): ShipInstance {
  return {
    instanceId,
    typeId: createShipId(typeId),
    name: typeId,
    material: 'oak',
    currentDurability: 100,
    maxDurability: 100,
    currentCrew: 10,
    maxCrew: 20,
    morale: 72,
    parts: [],
    cargo: [],
    usedCapacity: 0,
    maxCapacity: 40,
    supplies: { food: 10, water: 10, maxFood: 20, maxWater: 20, attritionProgress: 0, damageProgress: 0 },
    reinforceCount: 0,
    maxReinforce: 5,
  }
}

describe('ensureUniqueShipInstanceIds', () => {
  it('renames duplicated ship ids while preserving the first active flagship id', async () => {
    vi.stubGlobal('window', {})
    const { ensureUniqueShipInstanceIds } = await import('./usePlayerStore.ts')
    const result = ensureUniqueShipInstanceIds([
      ship('ship_001', 'caravela_latina'),
      ship('ship_005', 'galley'),
      ship('ship_005', 'xebec'),
    ], 'ship_005')

    expect(result.activeShipId).toBe('ship_005')
    expect(result.ships.map((entry) => entry.instanceId)).toEqual(['ship_001', 'ship_005', 'ship_006'])
    expect(result.ships.map((entry) => entry.typeId)).toEqual(['caravela_latina', 'galley', 'xebec'])
  })
})
