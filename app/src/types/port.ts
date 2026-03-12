// ============================================================
// 港型定義 — 港マスタ、施設、ショップ在庫
// ============================================================

import type { PortId, Position2D, ZoneId } from './common.ts'
import type { Nationality } from './character.ts'

/** 港の規模 */
export type PortSize = 'small' | 'medium' | 'large' | 'capital'

/** 港の文化圏 */
export type CultureZone =
  | 'west_europe'
  | 'north_europe'
  | 'east_europe'
  | 'islamic'
  | 'indian'
  | 'southeast_asia'
  | 'east_asia'
  | 'africa'
  | 'new_world'

/** 施設タイプ */
export type FacilityType =
  | 'market' // 交易所
  | 'guild' // ギルド
  | 'shipyard' // 造船所
  | 'tavern' // 酒場
  | 'palace' // 王宮
  | 'bank' // 銀行
  | 'shop' // 道具屋
  | 'church' // 教会
  | 'library' // 書庫

/** 施設情報 */
export interface Facility {
  type: FacilityType
  available: boolean
  level: number // 施設レベル (1-5)
}

/** 港マスタデータ */
export interface Port {
  id: PortId
  name: string
  nameEn: string
  position: Position2D // ワールド座標上の位置
  zoneId: ZoneId
  size: PortSize
  culture: CultureZone
  nationality: Nationality // 支配国
  influence: Record<Nationality, number> // 各国の影響度 (0-100)
  facilities: Facility[]
  specialProducts: string[] // 特産品ID
  taxRate: number // 税率 (0.0-0.5)
  prosperity: number // 繁栄度 (0-100) — 物価に影響
}

/** ショップの在庫アイテム */
export interface ShopItem {
  goodId: string
  basePrice: number
  currentPrice: number
  stock: number
  maxStock: number
  restockRate: number // 1日あたりの回復量
}

/** 交易所の在庫状態 */
export interface MarketInventory {
  portId: PortId
  items: ShopItem[]
  lastUpdated: number // ゲーム内日数
}
