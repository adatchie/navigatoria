// ============================================================
// useGameStore — ゲーム全体状態管理
// ============================================================

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { GamePhase, GameSpeed, GameTimeState } from '@/types/common.ts'
import { GameTime } from '@/game/GameTime.ts'
import type { FrameStats } from '@/game/GameLoop.ts'

interface GameStoreState {
  /** ゲームフェーズ */
  phase: GamePhase
  /** ゲーム速度 */
  speed: GameSpeed
  /** ポーズ中か */
  paused: boolean
  /** ゲーム時間インスタンス */
  gameTime: GameTime
  /** 現在のゲーム時間状態 (毎フレーム更新) */
  timeState: GameTimeState
  /** フレーム統計 */
  frameStats: FrameStats

  // アクション
  setPhase: (phase: GamePhase) => void
  setSpeed: (speed: GameSpeed) => void
  togglePause: () => void
  setPaused: (paused: boolean) => void
  updateTime: (realDeltaSeconds: number) => void
  setFrameStats: (stats: FrameStats) => void
  skipDays: (days: number) => void
  setHour: (hour: number) => void
}

export const useGameStore = create<GameStoreState>()(
  subscribeWithSelector((set, get) => {
    const gameTime = new GameTime()

    return {
      phase: 'loading',
      speed: 1,
      paused: false,
      gameTime,
      timeState: gameTime.getState(),
      frameStats: { fps: 0, frameTime: 0, updateCount: 0, drawTime: 0 },

      setPhase: (phase) => set({ phase }),

      setSpeed: (speed) => {
        gameTime.speed = speed
        set({ speed })
      },

      togglePause: () => {
        const paused = !get().paused
        gameTime.paused = paused
        set({ paused })
      },

      setPaused: (paused) => {
        gameTime.paused = paused
        set({ paused })
      },

      updateTime: (realDeltaSeconds) => {
        gameTime.update(realDeltaSeconds)
        set({ timeState: gameTime.getState() })
      },

      setFrameStats: (frameStats) => set({ frameStats }),

      skipDays: (days) => {
        gameTime.skipDays(days)
        set({ timeState: gameTime.getState() })
      },

      setHour: (hour) => {
        gameTime.setHour(hour)
        set({ timeState: gameTime.getState() })
      },
    }
  }),
)
