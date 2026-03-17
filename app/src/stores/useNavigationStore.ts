// ============================================================
// useNavigationStore — 航海状態管理（帆走モデル）
// ============================================================

import { create } from 'zustand'
import type { Position2D, Heading, Wind, Weather, WeatherType, PortId } from '@/types/common.ts'

/** 航海モード */
export type NavigationMode = 'docked' | 'sailing' | 'anchored' | 'combat'

interface NavigationStoreState {
  /** 航海モード */
  mode: NavigationMode
  /** 現在位置 (ワールド座標 km) */
  position: Position2D
  /** 現在の船首方向 (度, 0=北) */
  heading: Heading
  /** 目標方向 — クリックで設定される舵の向き (度, 0=北) */
  targetHeading: Heading
  /** 帆の開閉率 (0=全閉, 1=全開) */
  sailRatio: number
  /** 現在速度 (ノット) — システムが計算して反映 */
  currentSpeed: number
  /** 現在停泊している港 */
  dockedPortId: PortId | null
  /** 現在の風 */
  wind: Wind
  /** 現在の天候 */
  weather: Weather
  /** 航行距離 (今回の航海, km) */
  distanceTraveled: number

  setMode: (mode: NavigationMode) => void
  setPosition: (position: Position2D) => void
  setHeading: (heading: Heading) => void
  setTargetHeading: (heading: Heading) => void
  setSailRatio: (ratio: number) => void
  setSpeed: (speed: number) => void
  setDockedPort: (portId: PortId | null) => void
  setWind: (wind: Wind) => void
  setWeather: (type: WeatherType, intensity: number) => void
  addDistance: (km: number) => void
  resetVoyage: () => void
  /** 港を出航 — 帆を少し開いて sailing モードへ */
  departPort: (heading: Heading) => void
  debugTeleport: (position: Position2D) => void
}

export const useNavigationStore = create<NavigationStoreState>()((set) => ({
  mode: 'docked',
  position: { x: 200, y: 500 },
  heading: 180,
  targetHeading: 180,
  sailRatio: 0,
  currentSpeed: 0,
  dockedPortId: null,
  wind: { direction: 0, speed: 10 },
  weather: { type: 'clear', intensity: 0, duration: 0 },
  distanceTraveled: 0,

  setMode: (mode) => set({ mode }),
  setPosition: (position) => set({ position }),
  setHeading: (heading) => set({ heading }),
  setTargetHeading: (heading) => set({ targetHeading: ((heading % 360) + 360) % 360 }),
  setSailRatio: (ratio) => set({ sailRatio: Math.max(0, Math.min(1, ratio)) }),
  setSpeed: (currentSpeed) => set({ currentSpeed }),
  setDockedPort: (dockedPortId) => set({ dockedPortId }),
  setWind: (wind) => set({ wind }),
  setWeather: (type, intensity) =>
    set({ weather: { type, intensity, duration: 0 } }),
  addDistance: (km) =>
    set((state) => ({ distanceTraveled: state.distanceTraveled + km })),
  resetVoyage: () => set({ distanceTraveled: 0 }),

  departPort: (heading) =>
    set({
      mode: 'sailing',
      dockedPortId: null,
      heading,
      targetHeading: heading,
      sailRatio: 0.5,
      distanceTraveled: 0,
    }),

  debugTeleport: (position) =>
    set({ position, currentSpeed: 0, sailRatio: 0 }),
}))
