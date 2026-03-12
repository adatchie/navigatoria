// ============================================================
// EconomySystem — 市場在庫と相場の日次更新
// ============================================================

import type { GameSystem } from '@/game/GameLoop.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useEconomyStore } from '@/stores/useEconomyStore.ts'

export class EconomySystem implements GameSystem {
  name = 'EconomySystem'
  priority = 20

  update(): void {
    const totalDays = Math.floor(useGameStore.getState().timeState.totalDays)
    useEconomyStore.getState().simulateToDay(totalDays)
  }
}
