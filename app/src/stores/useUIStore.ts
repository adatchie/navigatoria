// ============================================================
// useUIStore — UI状態管理
// ============================================================

import { create } from 'zustand'
import type { DebugFlags } from '@/config/debugConfig.ts'
import { loadDebugFlags, saveDebugFlags } from '@/config/debugConfig.ts'

/** UIパネルタイプ */
export type PanelType =
  | 'none'
  | 'inventory'
  | 'map'
  | 'quest'
  | 'skills'
  | 'ship'
  | 'trade'
  | 'port'
  | 'settings'

/** 通知メッセージ */
export interface Notification {
  id: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  duration: number // ms, 0 = 手動閉じ
  createdAt: number
}

interface UIStoreState {
  /** 現在開いているパネル */
  activePanel: PanelType
  /** モーダルスタック */
  modals: string[]
  /** 通知リスト */
  notifications: Notification[]
  /** デバッグフラグ */
  debugFlags: DebugFlags
  /** サイドバー開閉 */
  sidebarOpen: boolean

  // アクション
  setActivePanel: (panel: PanelType) => void
  togglePanel: (panel: PanelType) => void
  pushModal: (modalId: string) => void
  popModal: () => void
  addNotification: (message: string, type?: Notification['type'], duration?: number) => void
  removeNotification: (id: string) => void
  setDebugFlag: <K extends keyof DebugFlags>(key: K, value: DebugFlags[K]) => void
  toggleDebugFlag: (key: keyof DebugFlags) => void
  setSidebarOpen: (open: boolean) => void
}

let notificationCounter = 0

export const useUIStore = create<UIStoreState>()((set, get) => ({
  activePanel: 'none',
  modals: [],
  notifications: [],
  debugFlags: loadDebugFlags(),
  sidebarOpen: false,

  setActivePanel: (panel) => set({ activePanel: panel }),

  togglePanel: (panel) => {
    const current = get().activePanel
    set({ activePanel: current === panel ? 'none' : panel })
  },

  pushModal: (modalId) =>
    set((state) => ({ modals: [...state.modals, modalId] })),

  popModal: () =>
    set((state) => ({ modals: state.modals.slice(0, -1) })),

  addNotification: (message, type = 'info', duration = 3000) => {
    const id = `notif_${++notificationCounter}`
    const notification: Notification = {
      id,
      message,
      type,
      duration,
      createdAt: Date.now(),
    }
    set((state) => ({
      notifications: [...state.notifications, notification],
    }))

    // 自動削除
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }))
      }, duration)
    }
  },

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  setDebugFlag: (key, value) => {
    set((state) => {
      const newFlags = { ...state.debugFlags, [key]: value }
      saveDebugFlags(newFlags)
      return { debugFlags: newFlags }
    })
  },

  toggleDebugFlag: (key) => {
    set((state) => {
      const current = state.debugFlags[key]
      if (typeof current !== 'boolean') return state
      const newFlags = { ...state.debugFlags, [key]: !current }
      saveDebugFlags(newFlags)
      return { debugFlags: newFlags }
    })
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
