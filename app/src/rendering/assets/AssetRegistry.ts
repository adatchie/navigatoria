// ============================================================
// AssetRegistry — アセットIDとURLのマッピング管理
// Tripo AI生成モデルのホットスワップ対応
// ============================================================

/** アセットエントリ */
export interface AssetEntry {
  id: string
  type: 'glb' | 'texture' | 'audio'
  url: string
  /** Tripoで生成済みかどうか */
  generated: boolean
  /** 生成に使用したプロンプト (Tripo用) */
  prompt?: string
  /** ファイルサイズ (bytes) */
  fileSize?: number
  /** 最終更新 */
  updatedAt?: number
}

/** プレースホルダーアセットの種別 */
export type PlaceholderType = 'ship' | 'port' | 'item'

class AssetRegistryImpl {
  private _entries = new Map<string, AssetEntry>()
  private _listeners = new Set<(id: string, entry: AssetEntry) => void>()

  /** アセットを登録 */
  register(entry: AssetEntry): void {
    this._entries.set(entry.id, entry)
    this._notifyListeners(entry.id, entry)
  }

  /** アセットを取得 */
  get(id: string): AssetEntry | undefined {
    return this._entries.get(id)
  }

  /** アセットのURLを取得 (未登録ならundefined) */
  getUrl(id: string): string | undefined {
    return this._entries.get(id)?.url
  }

  /** アセットが存在するか */
  has(id: string): boolean {
    return this._entries.has(id)
  }

  /** 全アセット一覧 */
  getAll(): AssetEntry[] {
    return Array.from(this._entries.values())
  }

  /** カテゴリでフィルタ */
  getByType(type: AssetEntry['type']): AssetEntry[] {
    return this.getAll().filter((e) => e.type === type)
  }

  /**
   * ホットスワップ: 既存アセットのURLを更新
   * Tripoで新しいモデルを生成した際に呼ぶ
   */
  hotSwap(id: string, newUrl: string, generated = true): boolean {
    const existing = this._entries.get(id)
    if (!existing) return false

    const updated: AssetEntry = {
      ...existing,
      url: newUrl,
      generated,
      updatedAt: Date.now(),
    }
    this._entries.set(id, updated)
    this._notifyListeners(id, updated)
    console.log(`[AssetRegistry] Hot-swapped: ${id} → ${newUrl}`)
    return true
  }

  /** 変更リスナーを登録 (ホットスワップ通知用) */
  onChange(listener: (id: string, entry: AssetEntry) => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  private _notifyListeners(id: string, entry: AssetEntry): void {
    for (const listener of this._listeners) {
      listener(id, entry)
    }
  }

  /** デバッグ: レジストリの状態をダンプ */
  dump(): Record<string, AssetEntry> {
    return Object.fromEntries(this._entries)
  }
}

/** シングルトンインスタンス */
export const assetRegistry = new AssetRegistryImpl()

/** デバッグ用グローバル公開 */
if (import.meta.env.DEV) {
  const w = window as unknown as { __DOL_ASSETS__: AssetRegistryImpl }
  w.__DOL_ASSETS__ = assetRegistry
}
