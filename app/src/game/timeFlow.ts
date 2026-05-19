import { useEncounterStore } from '@/stores/useEncounterStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useNpcFleetStore } from '@/stores/useNpcFleetStore.ts'
import { useUIStore } from '@/stores/useUIStore.ts'

export function isVoyageGloballySuspended(): boolean {
  const game = useGameStore.getState()
  if (game.phase !== 'playing' || game.paused || game.speed === 0) return true

  const encounter = useEncounterStore.getState()
  if (encounter.activeEncounter || encounter.combatState) return true

  return Boolean(useNpcFleetStore.getState().pendingAttackFleetId)
}

export function canUpdateVoyageNavigation(): boolean {
  if (isVoyageGloballySuspended()) return false

  const navigation = useNavigationStore.getState()
  if (navigation.mode === 'docked' || navigation.mode === 'combat') return false

  return !useUIStore.getState().isStopped
}

export function isVoyageTimeRunning(): boolean {
  if (!canUpdateVoyageNavigation()) return false
  return useNavigationStore.getState().mode === 'sailing'
}

export function useVoyageTimeRunning(): boolean {
  const phase = useGameStore((s) => s.phase)
  const paused = useGameStore((s) => s.paused)
  const speed = useGameStore((s) => s.speed)
  const navigationMode = useNavigationStore((s) => s.mode)
  const isStopped = useUIStore((s) => s.isStopped)
  const activeEncounter = useEncounterStore((s) => s.activeEncounter)
  const combatState = useEncounterStore((s) => s.combatState)
  const pendingAttackFleetId = useNpcFleetStore((s) => s.pendingAttackFleetId)

  return (
    phase === 'playing' &&
    !paused &&
    speed !== 0 &&
    navigationMode === 'sailing' &&
    !isStopped &&
    !activeEncounter &&
    !combatState &&
    !pendingAttackFleetId
  )
}
