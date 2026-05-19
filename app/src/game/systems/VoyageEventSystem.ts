// ============================================================
// VoyageEventSystem — 航海中のランダムイベント処理
// ============================================================

import type { GameSystem } from '@/game/GameLoop.ts'
import { isVoyageTimeRunning } from '@/game/timeFlow.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'

export class VoyageEventSystem implements GameSystem {
  name = 'VoyageEventSystem'
  priority = 12

  update(): void {
    if (!isVoyageTimeRunning()) return

    const { timeState } = useGameStore.getState()
    const currentDay = Math.floor(timeState.totalDays)
    const weatherType = useWorldStore.getState().globalWeather.type
    usePlayerStore.getState().resolveVoyageEvent(currentDay, weatherType)
  }
}

