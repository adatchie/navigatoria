// ============================================================
// SaveManager — Dexie.js IndexedDBスキーマ + セーブ/ロード
// ============================================================

import Dexie, { type EntityTable } from 'dexie'

/** セーブデータエントリ */
export interface SaveEntry {
  id?: number
  name: string
  createdAt: number
  updatedAt: number
  gameTime: number // 総ゲーム秒
  playerName: string
  /** JSON化されたゲーム状態 */
  data: string
}

/** 設定エントリ */
export interface SettingsEntry {
  key: string
  value: string
}

/** アセットキャッシュエントリ */
export interface AssetCacheEntry {
  id: string
  type: string
  blob: Blob
  cachedAt: number
}

/** データベース定義 */
class GameDatabase extends Dexie {
  saves!: EntityTable<SaveEntry, 'id'>
  settings!: EntityTable<SettingsEntry, 'key'>
  assetCache!: EntityTable<AssetCacheEntry, 'id'>

  constructor() {
    super('DaikoukaiDB')

    // バージョン管理 (マイグレーション対応)
    this.version(1).stores({
      saves: '++id, name, updatedAt',
      settings: 'key',
      assetCache: 'id, type, cachedAt',
    })
  }
}

/** DBインスタンス */
export const db = new GameDatabase()

/** セーブマネージャー */
export const SaveManager = {
  /** セーブデータを作成 */
  async save(name: string, gameState: Record<string, unknown>): Promise<number> {
    const now = Date.now()
    const id = await db.saves.add({
      name,
      createdAt: now,
      updatedAt: now,
      gameTime: (gameState.gameTime as number) ?? 0,
      playerName: (gameState.playerName as string) ?? 'Unknown',
      data: JSON.stringify(gameState),
    })
    console.log(`[SaveManager] Saved: "${name}" (id: ${id})`)
    return id as number
  },

  /** セーブデータを上書き */
  async overwrite(id: number, gameState: Record<string, unknown>): Promise<void> {
    await db.saves.update(id, {
      updatedAt: Date.now(),
      gameTime: (gameState.gameTime as number) ?? 0,
      data: JSON.stringify(gameState),
    })
    console.log(`[SaveManager] Overwritten: id ${id}`)
  },

  /** セーブデータを読み込み */
  async load(id: number): Promise<Record<string, unknown> | null> {
    const entry = await db.saves.get(id)
    if (!entry) return null
    return JSON.parse(entry.data) as Record<string, unknown>
  },

  /** セーブ一覧を取得 */
  async listSaves(): Promise<SaveEntry[]> {
    return db.saves.orderBy('updatedAt').reverse().toArray()
  },

  /** セーブを削除 */
  async deleteSave(id: number): Promise<void> {
    await db.saves.delete(id)
    console.log(`[SaveManager] Deleted: id ${id}`)
  },

  /** 設定の保存 */
  async setSetting(key: string, value: string): Promise<void> {
    await db.settings.put({ key, value })
  },

  /** 設定の取得 */
  async getSetting(key: string): Promise<string | undefined> {
    const entry = await db.settings.get(key)
    return entry?.value
  },
}
