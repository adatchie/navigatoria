// ============================================================
// 共通型定義 — 座標系、方向、時間、基本ユーティリティ
// ============================================================

/** 2Dワールド座標 (洋上マップ) */
export interface Position2D {
  x: number // 東西 (km) — 0=西端, 1600=東端
  y: number // 南北 (km) — 0=南端, 800=北端
}

/** 3Dシーン座標 */
export interface Position3D {
  x: number
  y: number
  z: number
}

/** 方位角 (度) 0=北, 90=東, 180=南, 270=西 */
export type Heading = number

/** 風向・風速 */
export interface Wind {
  direction: Heading // 風が吹いてくる方向
  speed: number // ノット (0-40)
}

/** 天候タイプ */
export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog'

/** 天候状態 */
export interface Weather {
  type: WeatherType
  intensity: number // 0.0-1.0
  duration: number // 残り秒数 (ゲーム内時間)
}

/** ゲーム内時間 */
export interface GameTimeState {
  /** 経過した総ゲーム日数 */
  totalDays: number
  /** 現在の時刻 (0.0 - 24.0) */
  hour: number
  /** 現在の年 (西暦) */
  year: number
  /** 現在の月 (1-12) */
  month: number
  /** 現在の日 (1-31) */
  day: number
}

/** ゲーム速度倍率 */
export type GameSpeed = 0 | 0.5 | 1 | 2 | 4

/** ゲームフェーズ */
export type GamePhase = 'title' | 'loading' | 'playing' | 'paused' | 'port' | 'menu'

/** リソースID (型安全なブランド型) */
export type ShipId = string & { readonly __brand: 'ShipId' }
export type PortId = string & { readonly __brand: 'PortId' }
export type TradeGoodId = string & { readonly __brand: 'TradeGoodId' }
export type SkillId = string & { readonly __brand: 'SkillId' }
export type ZoneId = string & { readonly __brand: 'ZoneId' }
export type CharacterId = string & { readonly __brand: 'CharacterId' }

/** ID生成ヘルパー */
export const createShipId = (id: string) => id as ShipId
export const createPortId = (id: string) => id as PortId
export const createTradeGoodId = (id: string) => id as TradeGoodId
export const createSkillId = (id: string) => id as SkillId
export const createZoneId = (id: string) => id as ZoneId
export const createCharacterId = (id: string) => id as CharacterId

/** 汎用の範囲型 */
export interface Range {
  min: number
  max: number
}

/** 名前付きエンティティの基底 */
export interface NamedEntity {
  id: string
  name: string
  description?: string
}
