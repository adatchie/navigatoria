// ============================================================
// ワールド型定義 — ゾーン、航路、風データ
// ============================================================

import type { ZoneId, Position2D, Wind, Weather } from './common.ts'

/** 海域ゾーン */
export interface Zone {
  id: ZoneId
  name: string
  nameEn: string
  /** ゾーンの矩形範囲 */
  bounds: {
    topLeft: Position2D
    bottomRight: Position2D
  }
  /** 基本風向 (季節ごと) */
  baseWind: {
    spring: Wind
    summer: Wind
    autumn: Wind
    winter: Wind
  }
  /** 危険度 (0-10) — 海賊出現率に影響 */
  dangerLevel: number
  /** 所属海域名 */
  seaRegion: SeaRegion
}

/** 海域区分 */
export type SeaRegion =
  | 'north_sea' // 北海
  | 'mediterranean' // 地中海
  | 'west_africa' // 西アフリカ
  | 'east_africa' // 東アフリカ
  | 'indian_ocean' // インド洋
  | 'southeast_asia' // 東南アジア
  | 'east_asia' // 東アジア
  | 'caribbean' // カリブ海
  | 'south_america' // 南米
  | 'atlantic' // 大西洋

/** 海流データ */
export interface CurrentData {
  zoneId: ZoneId
  direction: number // 流れる方向 (度)
  speed: number // 流速 (ノット)
}

/** 災害イベント */
export interface DisasterEvent {
  type: DisasterType
  position: Position2D
  radius: number // 影響範囲 (km)
  intensity: number // 強度 (0-1)
  duration: number // 残り秒数
}

/** 災害タイプ (原作準拠12種) */
export type DisasterType =
  | 'storm' // 嵐
  | 'tornado' // 竜巻
  | 'fog' // 濃霧
  | 'doldrums' // 凪 (無風)
  | 'tsunami' // 津波
  | 'iceberg' // 流氷
  | 'reef' // 暗礁
  | 'fire' // 火災
  | 'plague' // 疫病
  | 'mutiny' // 反乱
  | 'leak' // 浸水
  | 'scurvy' // 壊血病

/** ワールド全体の状態 (毎フレーム更新) */
export interface WorldState {
  currentWind: Wind
  currentWeather: Weather
  disasters: DisasterEvent[]
  dayOfYear: number // 年間通算日 (1-365) — 季節計算用
  season: Season
}

/** 季節 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
