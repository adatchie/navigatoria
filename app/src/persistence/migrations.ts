// ============================================================
// DBマイグレーション — バージョンアップ時のデータ変換
// ============================================================

/**
 * マイグレーション処理はDexie.jsのバージョニングで管理。
 * SaveManager.ts の db.version() でスキーマ変更を定義。
 *
 * 将来のマイグレーション例:
 * db.version(2).stores({ saves: '++id, name, updatedAt, version' })
 *   .upgrade(tx => tx.table('saves').toCollection().modify(save => { save.version = 1 }))
 */

export const CURRENT_DB_VERSION = 1

/** セーブデータのバージョン互換性チェック */
export function isCompatibleSaveVersion(saveVersion: number): boolean {
  return saveVersion <= CURRENT_DB_VERSION
}
