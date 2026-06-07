import { SaveManager } from './SaveManager.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { ensureUniqueShipInstanceIds, usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { useEconomyStore } from '@/stores/useEconomyStore.ts'
import { useQuestStore } from '@/stores/useQuestStore.ts'
import { useEncounterStore } from '@/stores/useEncounterStore.ts'
import { useNpcFleetStore } from '@/stores/useNpcFleetStore.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { localizeOfficerName } from '@/game/officers/officerGenerator.ts'
import { normalizePlayerProgression } from '@/game/player/progression.ts'
import { getNearestPort } from '@/game/world/queries.ts'
import type { Port } from '@/types/port.ts'
import { DEFAULT_GAME_SPEED } from '@/config/gameConfig.ts'

const CURRENT_SAVE_VERSION = 2
export const SAVE_SLOT_COUNT = 10
const SLOT_SAVE_NAME_PREFIX = 'SLOT:'

export interface SaveSlotSummary {
  slot: number
  saveId: number | null
  isEmpty: boolean
  updatedAt: number | null
  playerName: string | null
  levelSummary: string | null
  locationName: string | null
}

export interface GameSnapshot {
  version: number
  gameTime: number
  speed: 0 | 0.5 | 1 | 2 | 4
  paused: boolean
  phase: 'playing' | 'paused' | 'port'
  navigation: ReturnType<typeof useNavigationStore.getState>
  player: ReturnType<typeof usePlayerStore.getState>
  world: ReturnType<typeof useWorldStore.getState>
  economy: ReturnType<typeof useEconomyStore.getState>
  quest: ReturnType<typeof useQuestStore.getState>
  encounter: ReturnType<typeof useEncounterStore.getState>
  npcFleet?: ReturnType<typeof useNpcFleetStore.getState>
}

function normalizeSnapshotSpeed(snapshot: GameSnapshot): GameSnapshot['speed'] {
  const speed = snapshot.speed ?? DEFAULT_GAME_SPEED
  const version = snapshot.version ?? 1
  if (version >= CURRENT_SAVE_VERSION) return speed
  if (speed === 4) return 1
  if (speed === 2) return 0.5
  return speed
}

export function captureGameState(): GameSnapshot | null {
  const game = useGameStore.getState()
  const player = usePlayerStore.getState()
  if (!player.player) return null

  const normalizedPhase: GameSnapshot['phase'] = game.phase === 'paused' ? 'paused' : game.phase === 'port' ? 'port' : 'playing'

  return {
    version: CURRENT_SAVE_VERSION,
    gameTime: game.gameTime.serialize(),
    speed: game.speed,
    paused: game.paused,
    phase: normalizedPhase,
    navigation: useNavigationStore.getState(),
    player,
    world: useWorldStore.getState(),
    economy: useEconomyStore.getState(),
    quest: useQuestStore.getState(),
    encounter: useEncounterStore.getState(),
    npcFleet: useNpcFleetStore.getState(),
  }
}

export async function saveCurrentGame(name: string): Promise<number | null> {
  const snapshot = captureGameState()
  if (!snapshot || !snapshot.player.player) return null
  return SaveManager.save(name, { ...snapshot, playerName: snapshot.player.player.name, gameTime: snapshot.gameTime })
}

export async function saveCurrentGameToSlot(slot: number): Promise<number | null> {
  const normalizedSlot = normalizeSaveSlot(slot)
  const snapshot = captureGameState()
  if (!snapshot || !snapshot.player.player) return null
  return SaveManager.saveNamed(getSlotSaveName(normalizedSlot), { ...snapshot, playerName: snapshot.player.player.name, gameTime: snapshot.gameTime })
}

export async function listSaveSlots(): Promise<SaveSlotSummary[]> {
  const slots: SaveSlotSummary[] = []
  for (let slot = 1; slot <= SAVE_SLOT_COUNT; slot++) {
    const entry = await SaveManager.getSaveByName(getSlotSaveName(slot))
    slots.push(buildSaveSlotSummary(slot, entry))
  }
  return slots
}

export async function loadSaveSlot(slot: number): Promise<GameSnapshot | null> {
  const entry = await SaveManager.getSaveByName(getSlotSaveName(normalizeSaveSlot(slot)))
  if (!entry?.id) return null
  const loaded = await SaveManager.load(entry.id)
  return loaded as GameSnapshot | null
}

export async function loadLatestSave(): Promise<GameSnapshot | null> {
  const saves = await SaveManager.listSaves()
  const latest = saves[0]
  if (!latest?.id) return null
  const loaded = await SaveManager.load(latest.id)
  return loaded as GameSnapshot | null
}

function normalizeSaveSlot(slot: number): number {
  return Math.max(1, Math.min(SAVE_SLOT_COUNT, Math.floor(slot) || 1))
}

function getSlotSaveName(slot: number): string {
  return `${SLOT_SAVE_NAME_PREFIX}${slot}`
}

function buildSaveSlotSummary(slot: number, entry: Awaited<ReturnType<typeof SaveManager.getSaveByName>>): SaveSlotSummary {
  if (!entry) {
    return {
      slot,
      saveId: null,
      isEmpty: true,
      updatedAt: null,
      playerName: null,
      levelSummary: null,
      locationName: null,
    }
  }

  const snapshot = safeParseSnapshot(entry.data)
  const player = snapshot?.player.player
  return {
    slot,
    saveId: entry.id ?? null,
    isEmpty: false,
    updatedAt: entry.updatedAt,
    playerName: entry.playerName,
    levelSummary: player ? `冒${player.stats.adventureLevel} / 交${player.stats.tradeLevel} / 戦${player.stats.combatLevel}` : null,
    locationName: snapshot ? getSnapshotLocationName(snapshot) : null,
  }
}

function safeParseSnapshot(data: string): GameSnapshot | null {
  try {
    return JSON.parse(data) as GameSnapshot
  } catch {
    return null
  }
}

function getSnapshotLocationName(snapshot: GameSnapshot): string {
  const ports = snapshot.world.ports ?? []
  const dockedPortId = snapshot.navigation.dockedPortId ?? snapshot.player.player?.currentPortId
  const dockedPort = dockedPortId ? ports.find((port) => port.id === dockedPortId) : undefined
  if (dockedPort) return dockedPort.name

  const nearest = getNearestPort(snapshot.navigation.position, ports)
  if (nearest) return `${nearest.port.name}沖`
  return '洋上'
}

export function restoreGameState(snapshot: GameSnapshot): void {
  const gameStore = useGameStore.getState()
  const restoredSpeed = normalizeSnapshotSpeed(snapshot)
  gameStore.gameTime.deserialize(snapshot.gameTime)
  gameStore.gameTime.speed = restoredSpeed
  gameStore.gameTime.paused = snapshot.paused

  const ports = useDataStore.getState().masterData.ports
  const portsById = new Map(ports.map((port) => [port.id, port]))
  const normalizedWorldPorts = snapshot.world.ports.map((savedPort) => {
    const masterPort = portsById.get(savedPort.id)
    if (!masterPort) return savedPort
    return {
      ...savedPort,
      position: masterPort.position,
      zoneId: masterPort.zoneId,
      name: masterPort.name,
      nameEn: masterPort.nameEn,
      size: masterPort.size,
      culture: masterPort.culture,
      nationality: savedPort.nationality ?? masterPort.nationality,
      facilities: savedPort.facilities?.length ? savedPort.facilities : masterPort.facilities,
      specialProducts: savedPort.specialProducts?.length ? savedPort.specialProducts : masterPort.specialProducts,
      taxRate: savedPort.taxRate ?? masterPort.taxRate,
      prosperity: savedPort.prosperity ?? masterPort.prosperity,
      influence: savedPort.influence ?? masterPort.influence,
    } satisfies Port
  })
  const dockedPortId = snapshot.navigation.dockedPortId ?? snapshot.player.player?.currentPortId
  const dockedPort = dockedPortId ? normalizedWorldPorts.find((port) => port.id === dockedPortId) : undefined
  const navigationState = dockedPort
    ? { ...snapshot.navigation, position: dockedPort.position }
    : snapshot.navigation
  const normalizedFleet = ensureUniqueShipInstanceIds(snapshot.player.ships, snapshot.player.activeShipId)
  const playerState = {
    ...snapshot.player,
    activeShipId: normalizedFleet.activeShipId,
    officers: (snapshot.player.officers ?? []).map((officer, index) => ({
      ...officer,
      name: localizeOfficerName(officer.name, index),
    })),
    officerSalaryProgress: snapshot.player.officerSalaryProgress ?? 0,
    ships: normalizedFleet.ships.map((ship) => {
      const officerAssignments = {
        ...(ship.officerAssignments ?? {}),
        ...(ship.captainOfficerId ? { captain: ship.captainOfficerId } : {}),
      }
      if (ship.instanceId === normalizedFleet.activeShipId) delete officerAssignments.captain
      return {
        ...ship,
        officerAssignments: Object.keys(officerAssignments).length > 0 ? officerAssignments : undefined,
        captainOfficerId: ship.instanceId === normalizedFleet.activeShipId ? undefined : officerAssignments.captain,
      }
    }),
    player: dockedPort && snapshot.player.player
      ? normalizePlayerProgression({
        ...snapshot.player.player,
        discoveredDiscoveryIds: snapshot.player.player.discoveredDiscoveryIds ?? [],
        currentPortId: dockedPort.id,
        position: dockedPort.position,
      })
      : snapshot.player.player
        ? normalizePlayerProgression({ ...snapshot.player.player, discoveredDiscoveryIds: snapshot.player.player.discoveredDiscoveryIds ?? [] })
        : snapshot.player.player,
  }

  const worldState = {
    ...snapshot.world,
    ports: normalizedWorldPorts,
  }

  useGameStore.setState({ speed: restoredSpeed, paused: snapshot.paused, phase: snapshot.phase, timeState: gameStore.gameTime.getState() })
  useNavigationStore.setState(navigationState)
  usePlayerStore.setState(playerState)
  useWorldStore.setState(worldState)
  useEconomyStore.setState(snapshot.economy)
  useQuestStore.setState({
    ...snapshot.quest,
    activeQuests: snapshot.quest.activeQuests?.length
      ? snapshot.quest.activeQuests
      : snapshot.quest.activeQuest
        ? [snapshot.quest.activeQuest]
        : [],
    activeQuest: snapshot.quest.activeQuest ?? snapshot.quest.activeQuests?.[0] ?? null,
  })
  useEncounterStore.setState(snapshot.encounter)
  if (snapshot.npcFleet) useNpcFleetStore.setState(snapshot.npcFleet)
}

