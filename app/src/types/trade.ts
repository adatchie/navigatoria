// ============================================================
// 交易型定義 — 交易品、相場、経済システム
// ============================================================

import type { TradeGoodId, PortId } from './common.ts'

/** 交易品カテゴリ */
export type TradeCategory =
  | 'food' // 食料品
  | 'alcohol' // 酒類
  | 'spice' // 香辛料
  | 'fiber' // 繊維
  | 'textile' // 織物
  | 'dye' // 染料
  | 'ore' // 鉱石
  | 'metal' // 金属
  | 'weapon' // 武具
  | 'medicine' // 医薬品
  | 'luxury' // 嗜好品
  | 'jewel' // 宝石
  | 'craft' // 工芸品
  | 'art' // 美術品
  | 'industrial' // 工業品
  | 'livestock' // 家畜
  | 'wood' // 木材
  | 'leather' // 皮革
  | 'ceramic' // 陶磁器
  | 'book' // 書物

/** 交易品マスタデータ */
export interface TradeGood {
  id: TradeGoodId
  name: string
  category: TradeCategory
  description: string
  basePrice: number // 基準価格 (ドゥカート)
  weight: number // 1個あたりの重量 (樽)
  rarity: number // レア度 (1-5)
  origins: PortId[] // 産地の港ID
}

/** 相場情報 */
export interface MarketPrice {
  goodId: TradeGoodId
  portId: PortId
  buyPrice: number // 買値
  sellPrice: number // 売値
  trend: PriceTrend // 相場トレンド
  lastChange: number // 前回変動からのゲーム日数
}

/** 相場トレンド */
export type PriceTrend = 'rising' | 'stable' | 'falling' | 'crash' | 'boom'

/** 経済イベント (NPC経済シミュレーション用) */
export interface EconomyEvent {
  id: string
  type: EconomyEventType
  affectedPorts: PortId[]
  affectedGoods: TradeGoodId[]
  priceModifier: number // 倍率 (0.5 = 半額, 2.0 = 倍額)
  duration: number // ゲーム日数
  remaining: number // 残り日数
}

/** 経済イベントタイプ */
export type EconomyEventType =
  | 'harvest' // 豊作
  | 'famine' // 飢饉
  | 'war' // 戦争
  | 'festival' // 祭り
  | 'plague' // 疫病
  | 'trade_boom' // 交易ブーム
  | 'embargo' // 禁輸
