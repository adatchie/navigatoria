// ============================================================
// デバッグ設定 — 開発時のフラグ・機能トグル
// ============================================================

export interface DebugFlags {
  /** デバッグパネル表示 */
  showDebugPanel: boolean
  /** FPSカウンター表示 */
  showFPS: boolean
  /** ワイヤーフレーム表示 */
  wireframe: boolean
  /** 当たり判定可視化 */
  showColliders: boolean
  /** ゾーン境界表示 */
  showZoneBorders: boolean
  /** 港マーカー表示 */
  showPortMarkers: boolean
  /** 風向矢印表示 */
  showWindArrows: boolean
  /** ゲームログ詳細出力 */
  verboseLogging: boolean
  /** マスタデータ ホットリロード有効 */
  hotReloadData: boolean
  /** グローバルデータアクセス公開 */
  exposeGlobalData: boolean
  /** AI生成アセットプレビュー */
  assetPreview: boolean
}

/** デフォルトのデバッグフラグ */
export const DEFAULT_DEBUG_FLAGS: DebugFlags = {
  showDebugPanel: import.meta.env.DEV,
  showFPS: import.meta.env.DEV,
  wireframe: false,
  showColliders: false,
  showZoneBorders: true,
  showPortMarkers: true,
  showWindArrows: false,
  verboseLogging: import.meta.env.DEV,
  hotReloadData: import.meta.env.DEV,
  exposeGlobalData: import.meta.env.DEV,
  assetPreview: import.meta.env.DEV,
}

/** ローカルストレージのキー (デバッグフラグ永続化) */
export const DEBUG_STORAGE_KEY = 'dol_debug_flags'

/** 保存されたデバッグフラグを読み込む */
export function loadDebugFlags(): DebugFlags {
  try {
    const saved = localStorage.getItem(DEBUG_STORAGE_KEY)
    if (saved) {
      return { ...DEFAULT_DEBUG_FLAGS, ...JSON.parse(saved) }
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_DEBUG_FLAGS }
}

/** デバッグフラグを保存 */
export function saveDebugFlags(flags: DebugFlags): void {
  try {
    localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(flags))
  } catch {
    // ignore storage errors
  }
}
