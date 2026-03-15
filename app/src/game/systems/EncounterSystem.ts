import type { GameSystem } from '@/game/GameLoop.ts'
import type { EncounterAction, EncounterState, EncounterType } from '@/types/encounter.ts'
import type { ShipType } from '@/types/ship.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { useEncounterStore } from '@/stores/useEncounterStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { getNearestPort, getZoneAtPosition } from '@/game/world/queries.ts'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function createEncounterType(roll: number): EncounterType {
  if (roll < 0.45) return 'pirate'
  if (roll < 0.65) return 'merchant'
  if (roll < 0.83) return 'navy'
  return 'derelict'
}

function getRecommendedAction(type: EncounterType): EncounterAction {
  if (type === 'pirate') return 'evade'
  if (type === 'merchant') return 'ignore'
  if (type === 'derelict') return 'engage'
  return 'evade'
}

function getEncounterShipPool(type: EncounterType, ships: ShipType[]): ShipType[] {
  const preferredIds: Record<EncounterType, string[]> = {
    pirate: ['xebec', 'pinnace', 'brig', 'caravel_redonda', 'sambuk', 'frigate'],
    navy: ['brig', 'galley', 'galleass', 'galleon', 'frigate', 'turtle_ship', 'atakebune'],
    merchant: ['dhow', 'sambuk', 'fluyt', 'nao', 'merchant_galleon', 'junk', 'carrack'],
    derelict: ['balsa', 'caravel', 'dhow', 'junk', 'nao', 'fluyt'],
  }

  const ids = new Set(preferredIds[type])
  const pool = ships.filter((ship) => ids.has(ship.id))
  return pool.length ? pool : ships
}

function pickEncounterShip(type: EncounterType, danger: number, ships: ShipType[]): ShipType | undefined {
  if (ships.length === 0) return undefined
  const pool = getEncounterShipPool(type, ships)
  const targetLevel = clamp(1 + danger * 4, 1, 35)
  const ranked = [...pool].sort((a, b) => {
    const aScore = Math.abs(a.requiredLevel - targetLevel)
    const bScore = Math.abs(b.requiredLevel - targetLevel)
    if (aScore !== bScore) return aScore - bScore
    return a.requiredLevel - b.requiredLevel
  })
  const head = ranked.slice(0, Math.min(3, ranked.length))
  return head[Math.floor(Math.random() * head.length)]
}

function createEncounter(id: string, type: EncounterType, danger: number, currentDay: number, zoneName: string | undefined, weatherType: EncounterState['weatherType'], portDistance: number, ships: ShipType[]): EncounterState {
  const definitions: Record<EncounterType, { title: string; description: string; shipName: string; lootHint?: string }> = {
    pirate: {
      title: '海賊船団',
      description: '黒旗を掲げた高速船が接近しています。',
      shipName: 'Black Gull',
      lootHint: '銀貨と雑貨',
    },
    navy: {
      title: '武装哨戒船',
      description: '沿岸警備の武装船が進路を横切っています。',
      shipName: 'St. Elmo',
      lootHint: 'なし',
    },
    merchant: {
      title: '不審な交易船',
      description: 'こちらを警戒しながら並走する商船です。',
      shipName: 'Golden Reed',
      lootHint: '交易情報',
    },
    derelict: {
      title: '漂流船',
      description: '乗員の見えない漂流船が波間に揺れています。',
      shipName: 'Nameless Hulk',
      lootHint: '補給品と現金',
    },
  }

  const definition = definitions[type]
  const ship = pickEncounterShip(type, danger, ships)
  const enemyCrew =
    type === 'derelict'
      ? 0
      : ship
        ? clamp(Math.round(ship.crew.min + (ship.crew.max - ship.crew.min) * (0.35 + danger * 0.06)), ship.crew.min, ship.crew.max)
        : 10 + danger * 3
  const enemyDurability =
    type === 'derelict'
      ? ship
        ? clamp(Math.round(ship.durability.min * 0.45), 18, ship.durability.max)
        : 20 + danger * 4
      : ship
        ? clamp(Math.round(ship.durability.min + (ship.durability.max - ship.durability.min) * (0.3 + danger * 0.05)), ship.durability.min, ship.durability.max)
        : 45 + danger * 8

  return {
    id,
    type,
    title: definition.title,
    description: definition.description,
    shipName: ship?.name ?? definition.shipName,
    shipClass: ship?.category,
    enemyShipTypeId: ship?.id,
    threat: danger,
    enemyCrew,
    enemyDurability,
    enemyCannonSlots: ship?.cannonSlots ?? Math.max(2, 2 + danger * 2),
    enemySpeed: ship?.speed ?? 8 + Math.floor(danger / 2),
    enemyTurnRate: ship?.turnRate ?? 32 + danger * 2,
    distanceKm: Math.round(portDistance * 10) / 10,
    zoneName,
    weatherType,
    recommendedAction: getRecommendedAction(type),
    lootHint: definition.lootHint,
    startedAtDay: currentDay,
  }
}

export class EncounterSystem implements GameSystem {
  name = 'EncounterSystem'
  priority = 13
  private nextCheckDay = 0.15

  update(): void {
    const { paused, timeState } = useGameStore.getState()
    const navigation = useNavigationStore.getState()
    const encounterStore = useEncounterStore.getState()
    if (paused || navigation.mode !== 'sailing' || encounterStore.activeEncounter) return

    const currentDay = timeState.totalDays
    if (currentDay < this.nextCheckDay) return

    this.nextCheckDay = currentDay + 0.18

    const ports = useWorldStore.getState().ports
    const zones = useWorldStore.getState().zones
    const nearest = getNearestPort(navigation.position, ports)
    const zone = getZoneAtPosition(navigation.position, zones)
    const player = usePlayerStore.getState().player
    const activeShip = usePlayerStore.getState().ships.find((ship) => ship.instanceId === usePlayerStore.getState().activeShipId)
    if (!nearest || !player || !activeShip) return

    const portDistanceFactor = clamp((nearest.distanceKm - 12) / 60, 0, 1)
    const weatherFactor = navigation.weather.type === 'storm' ? 0.18 : navigation.weather.type === 'rain' ? 0.08 : navigation.weather.type === 'fog' ? 0.12 : 0
    const notorietyFactor = clamp(player.stats.notoriety / 100, 0, 0.2)
    const chance = 0.08 + portDistanceFactor * 0.18 + weatherFactor + notorietyFactor
    if (Math.random() > chance) return

    const ships = useDataStore.getState().masterData.ships
    const zoneDanger = zone?.dangerLevel ?? 2
    const moralePenalty = activeShip.morale < 45 ? 1 : 0
    const type = createEncounterType(Math.random())
    const danger = clamp(Math.round(zoneDanger + portDistanceFactor * 3 + moralePenalty), 1, 8)
    const encounter = createEncounter(`enc_${Math.floor(currentDay * 1000)}`, type, danger, currentDay, zone?.name, navigation.weather.type, nearest.distanceKm, ships)
    const triggered = encounterStore.triggerEncounter(encounter)
    if (triggered) {
      const distanceLabel = nearest.distanceKm.toFixed(1)
      const notice = `${encounter.shipName} (${encounter.type}) が ${nearest.port.name} 沖 ${distanceLabel} km 付近で確認されました。`
      usePlayerStore.getState().logEncounterEvent(notice)
    }
  }
}
