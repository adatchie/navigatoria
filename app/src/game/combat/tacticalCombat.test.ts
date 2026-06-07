import { describe, expect, it } from 'vitest'
import shipsJson from '@/data/master/ships.json'
import { buildInitialTacticalBattle } from './tacticalCombat.ts'
import type { EncounterState } from '@/types/encounter.ts'
import { createShipId } from '@/types/common.ts'
import type { ShipInstance, ShipType } from '@/types/ship.ts'

const ships = shipsJson as ShipType[]
const shipById = new Map(ships.map((ship) => [ship.id, ship]))

function getShip(typeId: string): ShipType | undefined {
  return shipById.get(typeId as ShipType['id'])
}

function createPlayerShip(overrides: Partial<ShipInstance> = {}): ShipInstance {
  return {
    instanceId: 'ship_001',
    typeId: createShipId('barca'),
    name: 'バルカ号',
    material: 'oak',
    currentDurability: 42,
    maxDurability: 42,
    currentCrew: 12,
    maxCrew: 12,
    morale: 70,
    parts: [],
    cargo: [],
    usedCapacity: 0,
    maxCapacity: 28,
    supplies: { food: 20, water: 20, maxFood: 20, maxWater: 20, attritionProgress: 0, damageProgress: 0 },
    reinforceCount: 0,
    maxReinforce: 2,
    upgrades: { rigging: 0, cargo: 0, gunnery: 0 },
    ...overrides,
  }
}

function createEncounter(overrides: Partial<EncounterState> = {}): EncounterState {
  return {
    id: 'encounter_test',
    type: 'pirate',
    title: '討伐対象',
    description: 'テスト艦隊',
    shipName: '討伐艦隊',
    enemyShipTypeId: createShipId('dhow'),
    threat: 3,
    enemyCrew: 36,
    enemyDurability: 120,
    enemyCannonSlots: 6,
    enemySpeed: 8,
    enemyTurnRate: 42,
    distanceKm: 1,
    weatherType: 'clear',
    recommendedAction: 'engage',
    startedAtDay: 1,
    ...overrides,
  }
}

describe('buildInitialTacticalBattle', () => {
  it('expands quest fleet enemy ship count into separate tactical ships', () => {
    const battle = buildInitialTacticalBattle({
      encounter: createEncounter({ enemyShipCount: 3 }),
      playerShips: [createPlayerShip()],
      getShipType: getShip,
      wind: { direction: 0, speed: 10 },
    })

    const enemies = battle.ships.filter((ship) => ship.side === 'enemy')
    expect(enemies).toHaveLength(3)
    expect(enemies.map((ship) => ship.id)).toEqual([
      'encounter_test:enemy-1',
      'encounter_test:enemy-2',
      'encounter_test:enemy-3',
    ])
    expect(enemies.every((ship) => ship.durability === 40)).toBe(true)
    expect(enemies.every((ship) => ship.crew === 12)).toBe(true)
    expect(enemies.every((ship) => ship.cannonSlots === 2)).toBe(true)
  })
})
