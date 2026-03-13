import type { GameSystem } from '@/game/GameLoop.ts'
import type { EncounterAction, EncounterState, EncounterType } from '@/types/encounter.ts'
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

function createEncounter(id: string, type: EncounterType, danger: number, currentDay: number, zoneName: string | undefined, weatherType: EncounterState['weatherType'], portDistance: number): EncounterState {
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

  const baseCrew = type === 'derelict' ? 0 : 10 + danger * 3
  const baseDurability = type === 'derelict' ? 20 + danger * 4 : 45 + danger * 8
  const definition = definitions[type]

  return {
    id,
    type,
    title: definition.title,
    description: definition.description,
    shipName: definition.shipName,
    threat: danger,
    enemyCrew: baseCrew,
    enemyDurability: baseDurability,
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

    const zoneDanger = zone?.dangerLevel ?? 2
    const moralePenalty = activeShip.morale < 45 ? 1 : 0
    const type = createEncounterType(Math.random())
    const danger = clamp(Math.round(zoneDanger + portDistanceFactor * 3 + moralePenalty), 1, 8)
    const encounter = createEncounter(`enc_${Math.floor(currentDay * 1000)}`, type, danger, currentDay, zone?.name, navigation.weather.type, nearest.distanceKm)
    const triggered = encounterStore.triggerEncounter(encounter)
    if (triggered) {
      const distanceLabel = nearest.distanceKm.toFixed(1)
      const notice = `${encounter.shipName} (${encounter.type}) が ${nearest.port.name} 沖 ${distanceLabel} km 付近で確認されました。`
      usePlayerStore.getState().logEncounterEvent(notice)
    }
  }
}
