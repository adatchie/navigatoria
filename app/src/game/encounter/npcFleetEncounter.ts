import { WORLD_DISTANCE_SCALE } from '@/config/gameConfig.ts'
import type { EncounterState, EncounterType } from '@/types/encounter.ts'
import type { Position2D, WeatherType } from '@/types/common.ts'
import type { NpcFleetRole, NpcFleetSnapshot } from '@/types/npcFleet.ts'
import type { ShipType } from '@/types/ship.ts'

const ROLE_THREAT: Record<NpcFleetRole, number> = {
  merchant: 2,
  explorer: 2,
  smuggler: 3,
  privateer: 4,
  corsair: 5,
  naval: 5,
}

const ROLE_CREW_FACTOR: Record<NpcFleetRole, number> = {
  merchant: 0.68,
  explorer: 0.62,
  smuggler: 0.74,
  privateer: 0.84,
  corsair: 0.9,
  naval: 0.92,
}

function getEncounterType(role: NpcFleetRole): EncounterType {
  if (role === 'naval') return 'navy'
  if (role === 'privateer' || role === 'corsair' || role === 'smuggler') return 'pirate'
  return 'merchant'
}

function getLootHint(role: NpcFleetRole): string {
  if (role === 'merchant') return '交易品と現金'
  if (role === 'explorer') return '航海日誌と物資'
  if (role === 'naval') return '軍用物資'
  return '私掠船の戦利品'
}

function distanceKm(a: Position2D, b: Position2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y) * WORLD_DISTANCE_SCALE
}

export function createNpcFleetEncounter(params: {
  snapshot: NpcFleetSnapshot
  playerPosition: Position2D
  currentDay: number
  weatherType: WeatherType
  getShip: (typeId: string) => ShipType | undefined
}): EncounterState {
  const { snapshot, playerPosition, currentDay, weatherType, getShip } = params
  const fleet = snapshot.definition
  const ship = getShip(fleet.shipTypeId)
  const roleThreat = ROLE_THREAT[fleet.role] ?? 3
  const shipThreat = ship ? Math.max(1, Math.round(ship.requiredLevel / 5)) : 2
  const threat = Math.max(1, Math.min(10, roleThreat + shipThreat))
  const crewMax = ship?.crew.max ?? 42
  const durabilityMax = ship?.durability.max ?? 180
  const crewFactor = ROLE_CREW_FACTOR[fleet.role] ?? 0.78

  return {
    id: `npc_fleet_${fleet.id}_${Math.floor(currentDay * 1000)}`,
    type: getEncounterType(fleet.role),
    title: `${fleet.commander}の艦隊`,
    description: `${fleet.description} ${fleet.commander}の艦隊に戦闘を仕掛けます。`,
    shipName: fleet.name,
    shipClass: ship?.name,
    enemyShipTypeId: fleet.shipTypeId,
    threat,
    enemyCrew: Math.max(6, Math.round(crewMax * crewFactor)),
    enemyDurability: Math.max(30, Math.round(durabilityMax * (0.72 + roleThreat * 0.045))),
    enemyCannonSlots: Math.max(1, ship?.cannonSlots ?? 4),
    enemySpeed: ship?.speed ?? fleet.speedKnots,
    enemyTurnRate: ship?.turnRate ?? 42,
    distanceKm: distanceKm(snapshot.position, playerPosition),
    weatherType,
    recommendedAction: 'engage',
    lootHint: getLootHint(fleet.role),
    startedAtDay: currentDay,
    source: fleet.questOnly ? 'quest' : 'npc_fleet',
    npcFleetId: fleet.id,
    npcFleetName: fleet.name,
    npcCommander: fleet.commander,
  }
}
