// ============================================================
// DataOverride — ランタイムでマスタデータをパッチ (デバッグ用)
// ============================================================

import { useDataStore } from '@/stores/useDataStore.ts'

/**
 * ドットパスで値を取得
 * 例: getByPath(obj, "ships.0.speed") → obj.ships[0].speed
 */
export function getByPath(obj: unknown, path: string): unknown {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/**
 * ドットパスで値をセット (イミュータブルに新しいオブジェクトを返す)
 */
export function setByPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split('.')
  if (keys.length === 0) return obj

  const clone = Array.isArray(obj) ? ([...obj] as unknown as T) : { ...obj }
  let current: Record<string, unknown> = clone as Record<string, unknown>

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!
    const next = current[key]
    if (Array.isArray(next)) {
      current[key] = [...next]
    } else if (typeof next === 'object' && next !== null) {
      current[key] = { ...next }
    } else {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }

  current[keys[keys.length - 1]!] = value
  return clone
}

/**
 * オーバーライドを適用してデータを取得するヘルパー
 */
export function getOverriddenData<T>(category: string, data: T[]): T[] {
  const overrides = useDataStore.getState().overrides
  let result = data

  for (const [path, value] of Object.entries(overrides)) {
    if (path.startsWith(`${category}.`)) {
      const subPath = path.slice(category.length + 1)
      result = setByPath(result, subPath, value) as T[]
    }
  }

  return result
}

/** デバッグ用: グローバルにオーバーライドAPIを公開 */
if (import.meta.env.DEV) {
  const w = window as unknown as {
    __DOL_OVERRIDE__: {
      set: (path: string, value: unknown) => void
      remove: (path: string) => void
      clear: () => void
      list: () => Record<string, unknown>
    }
  }

  w.__DOL_OVERRIDE__ = {
    set: (path: string, value: unknown) => {
      useDataStore.getState().setOverride(path, value)
      console.log(`[Override] Set ${path} = ${JSON.stringify(value)}`)
    },
    remove: (path: string) => {
      useDataStore.getState().removeOverride(path)
      console.log(`[Override] Removed ${path}`)
    },
    clear: () => {
      useDataStore.getState().clearOverrides()
      console.log('[Override] Cleared all overrides')
    },
    list: () => {
      return useDataStore.getState().overrides
    },
  }
}
