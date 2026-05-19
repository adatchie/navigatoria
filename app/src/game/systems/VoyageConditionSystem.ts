// ============================================================
// VoyageConditionSystem — 航海中の補給消耗と船体劣化
// ============================================================

import type { GameSystem } from '@/game/GameLoop.ts'
import { TIME_CONFIG } from '@/config/gameConfig.ts'
import { isVoyageTimeRunning } from '@/game/timeFlow.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'

export class VoyageConditionSystem implements GameSystem {
  name = 'VoyageConditionSystem'
  priority = 11

  update(deltaTime: number): void {
    if (!isVoyageTimeRunning()) return

    const { speed } = useGameStore.getState()
    const gameDayDelta = (deltaTime * speed) / TIME_CONFIG.REAL_SECONDS_PER_GAME_DAY
    usePlayerStore.getState().consumeVoyageResources(gameDayDelta)
  }
}

