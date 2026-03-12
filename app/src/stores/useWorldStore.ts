// ============================================================
// useWorldStore — ワールドデータ管理
// ============================================================

import { create } from 'zustand'
import type { Port } from '@/types/port.ts'
import type { Zone, DisasterEvent, Season } from '@/types/world.ts'
import type { Wind, Weather } from '@/types/common.ts'

interface WorldStoreState {
  ports: Port[]
  zones: Zone[]
  globalWind: Wind
  globalWeather: Weather
  disasters: DisasterEvent[]
  season: Season
  loaded: boolean

  setPorts: (ports: Port[]) => void
  updatePort: (portId: string, updater: (port: Port) => Port) => void
  setZones: (zones: Zone[]) => void
  setGlobalWind: (wind: Wind) => void
  setGlobalWeather: (weather: Weather) => void
  addDisaster: (disaster: DisasterEvent) => void
  removeDisaster: (index: number) => void
  setSeason: (season: Season) => void
  setLoaded: (loaded: boolean) => void
}

export const useWorldStore = create<WorldStoreState>()((set) => ({
  ports: [],
  zones: [],
  globalWind: { direction: 270, speed: 12 },
  globalWeather: { type: 'clear', intensity: 0, duration: 0 },
  disasters: [],
  season: 'spring',
  loaded: false,

  setPorts: (ports) => set({ ports }),
  updatePort: (portId, updater) => set((state) => ({
    ports: state.ports.map((port) => (port.id === portId ? updater(port) : port)),
  })),
  setZones: (zones) => set({ zones }),
  setGlobalWind: (globalWind) => set({ globalWind }),
  setGlobalWeather: (globalWeather) => set({ globalWeather }),
  addDisaster: (disaster) => set((state) => ({ disasters: [...state.disasters, disaster] })),
  removeDisaster: (index) => set((state) => ({ disasters: state.disasters.filter((_, i) => i !== index) })),
  setSeason: (season) => set({ season }),
  setLoaded: (loaded) => set({ loaded }),
}))
