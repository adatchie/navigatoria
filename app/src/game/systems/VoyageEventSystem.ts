// ============================================================
// VoyageEventSystem — 航海中のランダムイベント処理
// ============================================================

import type { GameSystem } from '@/game/GameLoop.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'

export class VoyageEventSystem implements GameSystem {
  name = 'VoyageEventSystem'
  priority = 12

  update(): void {
    const { paused, timeState } = useGameStore.getState()
    const navigation = useNavigationStore.getState()
    if (paused || navigation.mode !== 'sailing') return

    const currentDay = Math.floor(timeState.totalDays)
    const weatherType = useWorldStore.getState().globalWeather.type
    usePlayerStore.getState().resolveVoyageEvent(currentDay, weatherType)
  }
}

