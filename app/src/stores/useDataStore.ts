// ============================================================
// useDataStore — マスタデータ管理 (Hot-Reload対応)
// ============================================================

import { create } from 'zustand'
import type { ShipType } from '@/types/ship.ts'
import type { Port } from '@/types/port.ts'
import type { TradeGood } from '@/types/trade.ts'
import type { Skill } from '@/types/character.ts'

/** マスタデータの構造 */
export interface MasterData {
  ships: ShipType[]
  ports: Port[]
  tradeGoods: TradeGood[]
  skills: Skill[]
}

/** データオーバーライド (デバッグ用パッチ) */
export interface DataOverride {
  /** "ships.0.speed" のようなドットパス → 上書き値 */
  [path: string]: unknown
}

interface DataStoreState {
  /** マスタデータ */
  masterData: MasterData
  /** ロード完了フラグ */
  loaded: boolean
  /** ロードエラー */
  error: string | null
  /** アクティブなオーバーライド */
  overrides: DataOverride
  /** データバージョン (HMRで更新) */
  version: number

  // アクション
  setMasterData: (data: Partial<MasterData>) => void
  setLoaded: (loaded: boolean) => void
  setError: (error: string | null) => void
  setOverride: (path: string, value: unknown) => void
  removeOverride: (path: string) => void
  clearOverrides: () => void
  incrementVersion: () => void

  // ゲッター (オーバーライド適用済み)
  getShip: (id: string) => ShipType | undefined
  getPort: (id: string) => Port | undefined
  getTradeGood: (id: string) => TradeGood | undefined
}

const EMPTY_MASTER_DATA: MasterData = {
  ships: [],
  ports: [],
  tradeGoods: [],
  skills: [],
}

export const useDataStore = create<DataStoreState>()((set, get) => ({
  masterData: EMPTY_MASTER_DATA,
  loaded: false,
  error: null,
  overrides: {},
  version: 0,

  setMasterData: (data) =>
    set((state) => ({
      masterData: { ...state.masterData, ...data },
    })),

  setLoaded: (loaded) => set({ loaded }),
  setError: (error) => set({ error }),

  setOverride: (path, value) =>
    set((state) => ({
      overrides: { ...state.overrides, [path]: value },
    })),

  removeOverride: (path) =>
    set((state) => {
      const newOverrides = { ...state.overrides }
      delete newOverrides[path]
      return { overrides: newOverrides }
    }),

  clearOverrides: () => set({ overrides: {} }),

  incrementVersion: () =>
    set((state) => ({ version: state.version + 1 })),

  getShip: (id) => {
    const { masterData } = get()
    return masterData.ships.find((s) => s.id === id)
  },

  getPort: (id) => {
    const { masterData } = get()
    return masterData.ports.find((p) => p.id === id)
  },

  getTradeGood: (id) => {
    const { masterData } = get()
    return masterData.tradeGoods.find((g) => g.id === id)
  },
}))

/** グローバルデータアクセス (デバッグコンソール用) */
if (import.meta.env.DEV) {
  const w = window as unknown as { __DOL_DATA__: () => MasterData; __DOL_STORE__: typeof useDataStore }
  w.__DOL_DATA__ = () => useDataStore.getState().masterData
  w.__DOL_STORE__ = useDataStore
}
