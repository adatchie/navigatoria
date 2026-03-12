// ============================================================
// Zodスキーマ — マスタデータのバリデーション
// ============================================================

import { z } from 'zod/v4'

/** 範囲 */
const RangeSchema = z.object({
  min: z.number(),
  max: z.number(),
})

/** 船種マスタ */
export const ShipTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameEn: z.string(),
  category: z.enum(['small_sail', 'medium_sail', 'large_sail', 'galley', 'oriental']),
  description: z.string(),
  capacity: z.number().positive(),
  durability: RangeSchema,
  crew: RangeSchema,
  cannonSlots: z.number().int().min(0),
  speed: z.number().positive(),
  turnRate: z.number().positive(),
  verticalSails: z.number().int().min(0),
  horizontalSails: z.number().int().min(0),
  requiredLevel: z.number().int().min(1),
  price: z.number().positive(),
  modelId: z.string().optional(),
  modelPrompt: z.string().optional(),
})

/** 施設 */
const FacilitySchema = z.object({
  type: z.enum([
    'market', 'guild', 'shipyard', 'tavern', 'palace',
    'bank', 'shop', 'church', 'library',
  ]),
  available: z.boolean(),
  level: z.number().int().min(1).max(5),
})

/** 座標 */
const Position2DSchema = z.object({
  x: z.number(),
  y: z.number(),
})

/** 国籍 */
const NationalitySchema = z.enum([
  'portugal', 'spain', 'england', 'netherlands', 'france', 'venice', 'ottoman',
])

/** 港マスタ */
export const PortSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameEn: z.string(),
  position: Position2DSchema,
  zoneId: z.string(),
  size: z.enum(['small', 'medium', 'large', 'capital']),
  culture: z.enum([
    'west_europe', 'north_europe', 'east_europe', 'islamic',
    'indian', 'southeast_asia', 'east_asia', 'africa', 'new_world',
  ]),
  nationality: NationalitySchema,
  influence: z.record(z.string(), z.number()),
  facilities: z.array(FacilitySchema),
  specialProducts: z.array(z.string()),
  taxRate: z.number().min(0).max(1),
  prosperity: z.number().min(0).max(100),
})

/** 交易品マスタ */
export const TradeGoodSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum([
    'food', 'alcohol', 'spice', 'fiber', 'textile', 'dye', 'ore', 'metal',
    'weapon', 'medicine', 'luxury', 'jewel', 'craft', 'art', 'industrial',
    'livestock', 'wood', 'leather', 'ceramic', 'book',
  ]),
  description: z.string(),
  basePrice: z.number().positive(),
  weight: z.number().positive(),
  rarity: z.number().int().min(1).max(5),
  origins: z.array(z.string()),
})

/** スキルマスタ */
export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['adventure', 'trade', 'combat', 'language', 'life']),
  description: z.string(),
  maxRank: z.number().int().min(1),
})

/** マスタデータ全体 */
export const MasterDataSchema = z.object({
  ships: z.array(ShipTypeSchema),
  ports: z.array(PortSchema),
  tradeGoods: z.array(TradeGoodSchema),
  skills: z.array(SkillSchema),
})
