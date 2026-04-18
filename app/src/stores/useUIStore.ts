// ============================================================
// useUIStore — UI状態管理
// ============================================================

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { StopReason } from '@/game/systems/NavigationSystem.ts'

interface UIStoreState {
  /** 航行不能状態かどうか */
  isStopped: boolean
  /** 停止理由 */
  stopReason: StopReason | null
  /** 停止開始時刻（performance.now） */
  stopStartTime: number
  /** 停止継続時間（ms）表示用 */
  stopDuration: number
  /** 通知メッセージ */
  notificationMessage: string
  /** 通知継続時間（ms） */
  notificationDuration: number
  /** 通知を設定（duration経過で自動クリア） */
  setNotification: (message: string, duration: number) => void
  /** 停止状態を設定 */
  setStopped: (reason: StopReason, duration?: number) => void
  /** 停止解除 */
  setResumed: () => void
}

let notificationTimeoutId: number | null = null

export const useUIStore = create<UIStoreState>()(
  subscribeWithSelector((set, get) => ({
    isStopped: false,
    stopReason: null,
    stopStartTime: 0,
    stopDuration: 0,
    notificationMessage: '',
    notificationDuration: 0,

    setNotification: (message, duration) => {
      set({ notificationMessage: message, notificationDuration: duration })
      // 既存のタイマーをクリア
      if (notificationTimeoutId) {
        try {
          window.clearTimeout(notificationTimeoutId)
        } catch {
          // ignore
        }
        notificationTimeoutId = null
      }
      // 新しいタイマー設定
      if (duration > 0) {
        notificationTimeoutId = window.setTimeout(() => {
          set({ notificationMessage: '' })
          notificationTimeoutId = null
        }, duration) as unknown as number
      }
    },

    setStopped: (reason, duration = 5000) =>
      set({
        isStopped: true,
        stopReason: reason,
        stopStartTime: performance.now(),
        stopDuration: duration,
      }),

    setResumed: () =>
      set({
        isStopped: false,
        stopReason: null,
        stopDuration: 0,
      }),
  })),
)

// 継続時間の経過を更新する副作用（ループ側から呼ぶ）
export function updateStopTimer(): void {
  useUIStore.setState((state) => {
    if (state.isStopped) {
      const elapsed = performance.now() - state.stopStartTime
      return { stopDuration: elapsed }
    }
    // 通知が表示中なら残り時間を減らす（setNotificationで自動クリアされるためここは軽減）
    return {}
  })
}

// 通知を自動でクリア（duration経過で）
export function clearNotificationIfExpired(): void {
  const { notificationDuration, notificationMessage } = useUIStore.getState()
  if (notificationDuration <= 0 && notificationMessage) {
    useUIStore.getState().setNotification('', 0)
  }
}