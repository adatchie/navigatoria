import { SaveManager } from './SaveManager.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { useEconomyStore } from '@/stores/useEconomyStore.ts'
import { useQuestStore } from '@/stores/useQuestStore.ts'
import { useEncounterStore } from '@/stores/useEncounterStore.ts'

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
}

export function captureGameState(): GameSnapshot | null {
  const game = useGameStore.getState()
  const player = usePlayerStore.getState()
  if (!player.player) return null

  const normalizedPhase: GameSnapshot['phase'] = game.phase === 'paused' ? 'paused' : game.phase === 'port' ? 'port' : 'playing'

  return {
    version: 1,
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
  }
}

export async function saveCurrentGame(name: string): Promise<number | null> {
  const snapshot = captureGameState()
  if (!snapshot || !snapshot.player.player) return null
  return SaveManager.save(name, { ...snapshot, playerName: snapshot.player.player.name, gameTime: snapshot.gameTime })
}

export async function loadLatestSave(): Promise<GameSnapshot | null> {
  const saves = await SaveManager.listSaves()
  const latest = saves[0]
  if (!latest?.id) return null
  const loaded = await SaveManager.load(latest.id)
  return loaded as GameSnapshot | null
}

export function restoreGameState(snapshot: GameSnapshot): void {
  const gameStore = useGameStore.getState()
  gameStore.gameTime.deserialize(snapshot.gameTime)
  gameStore.gameTime.speed = snapshot.speed
  gameStore.gameTime.paused = snapshot.paused

  useGameStore.setState({ speed: snapshot.speed, paused: snapshot.paused, phase: snapshot.phase, timeState: gameStore.gameTime.getState() })
  useNavigationStore.setState(snapshot.navigation)
  usePlayerStore.setState(snapshot.player)
  useWorldStore.setState(snapshot.world)
  useEconomyStore.setState(snapshot.economy)
  useQuestStore.setState(snapshot.quest)
  useEncounterStore.setState(snapshot.encounter)
}

