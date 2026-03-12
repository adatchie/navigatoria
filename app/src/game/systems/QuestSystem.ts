// ============================================================
// QuestSystem — 期限切れクエストの失敗判定
// ============================================================

import type { GameSystem } from '@/game/GameLoop.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useQuestStore } from '@/stores/useQuestStore.ts'

export class QuestSystem implements GameSystem {
  name = 'QuestSystem'
  priority = 21

  update(): void {
    const totalDays = Math.floor(useGameStore.getState().timeState.totalDays)
    useQuestStore.getState().failExpiredQuests(totalDays)
  }
}
