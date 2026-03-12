// ============================================================
// useNavigationStore — 航海状態管理
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
  /** 進行方向 (度) */
  heading: Heading
  /** 現在速度 (ノット) */
  currentSpeed: number
  /** 目的地 */
  destination: Position2D | null
  /** 目的地の港名 */
  destinationName: string | null
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
  setSpeed: (speed: number) => void
  setDestination: (position: Position2D | null, name?: string) => void
  setDockedPort: (portId: PortId | null) => void
  setWind: (wind: Wind) => void
  setWeather: (type: WeatherType, intensity: number) => void
  addDistance: (km: number) => void
  resetVoyage: () => void
  debugTeleport: (position: Position2D) => void
}

export const useNavigationStore = create<NavigationStoreState>()((set) => ({
  mode: 'docked',
  position: { x: 200, y: 500 },
  heading: 0,
  currentSpeed: 0,
  destination: null,
  destinationName: null,
  dockedPortId: null,
  wind: { direction: 0, speed: 10 },
  weather: { type: 'clear', intensity: 0, duration: 0 },
  distanceTraveled: 0,

  setMode: (mode) => set({ mode }),
  setPosition: (position) => set({ position }),
  setHeading: (heading) => set({ heading }),
  setSpeed: (currentSpeed) => set({ currentSpeed }),
  setDestination: (position, name) =>
    set({ destination: position, destinationName: name ?? null }),
  setDockedPort: (dockedPortId) => set({ dockedPortId }),
  setWind: (wind) => set({ wind }),
  setWeather: (type, intensity) =>
    set({ weather: { type, intensity, duration: 0 } }),
  addDistance: (km) =>
    set((state) => ({ distanceTraveled: state.distanceTraveled + km })),
  resetVoyage: () => set({ distanceTraveled: 0 }),

  debugTeleport: (position) =>
    set({ position, currentSpeed: 0, destination: null }),
}))
