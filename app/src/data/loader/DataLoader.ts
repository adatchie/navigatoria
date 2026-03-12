// ============================================================
// DataLoader — マスタデータ読み込み + Zodバリデーション + HMR
// ============================================================

import { ShipTypeSchema, PortSchema, TradeGoodSchema, SkillSchema } from './schemas.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import type { ShipType } from '@/types/ship.ts'
import type { Port } from '@/types/port.ts'
import type { TradeGood } from '@/types/trade.ts'
import type { Skill } from '@/types/character.ts'
import { z } from 'zod/v4'

// JSON imports (Vite handles these as modules)
import shipsRaw from '@/data/master/ships.json'
import portsRaw from '@/data/master/ports.json'
import tradeGoodsRaw from '@/data/master/tradeGoods.json'
import skillsRaw from '@/data/master/skills.json'

/** バリデーションエラー情報 */
interface ValidationError {
  file: string
  errors: string[]
}

/** ロード結果 */
interface LoadResult {
  success: boolean
  errors: ValidationError[]
}

/** マスタデータをバリデーションしてストアにセット */
export async function loadAllMasterData(): Promise<LoadResult> {
  const store = useDataStore.getState()
  const errors: ValidationError[] = []

  // Ships
  const shipsResult = validateArray(shipsRaw, ShipTypeSchema, 'ships.json')
  if (shipsResult.errors.length > 0) errors.push(shipsResult.errors[0]!)
  const ships = shipsResult.data as ShipType[]

  // Ports
  const portsResult = validateArray(portsRaw, PortSchema, 'ports.json')
  if (portsResult.errors.length > 0) errors.push(portsResult.errors[0]!)
  const ports = portsResult.data as Port[]

  // Trade Goods
  const tradeGoodsResult = validateArray(tradeGoodsRaw, TradeGoodSchema, 'tradeGoods.json')
  if (tradeGoodsResult.errors.length > 0) errors.push(tradeGoodsResult.errors[0]!)
  const tradeGoods = tradeGoodsResult.data as TradeGood[]

  // Skills
  const skillsResult = validateArray(skillsRaw, SkillSchema, 'skills.json')
  if (skillsResult.errors.length > 0) errors.push(skillsResult.errors[0]!)
  const skills = skillsResult.data as Skill[]

  // ストアにセット
  store.setMasterData({ ships, ports, tradeGoods, skills })
  store.setLoaded(true)
  store.incrementVersion()

  if (errors.length > 0) {
    const errorMsg = errors.map((e) => `${e.file}: ${e.errors.join(', ')}`).join('\n')
    store.setError(errorMsg)
    console.warn('[DataLoader] Validation warnings:', errorMsg)
  } else {
    store.setError(null)
    console.log('[DataLoader] All master data loaded successfully')
    console.log(`  Ships: ${ships.length}, Ports: ${ports.length}, TradeGoods: ${tradeGoods.length}, Skills: ${skills.length}`)
  }

  return { success: errors.length === 0, errors }
}

/** 配列データのバリデーション */
function validateArray<T>(
  rawData: unknown[],
  schema: z.ZodType<T>,
  fileName: string,
): { data: T[]; errors: ValidationError[] } {
  const validItems: T[] = []
  const errorMessages: string[] = []

  for (let i = 0; i < rawData.length; i++) {
    const result = schema.safeParse(rawData[i])
    if (result.success) {
      validItems.push(result.data)
    } else {
      const itemId = (rawData[i] as Record<string, unknown>)?.id ?? `index ${i}`
      errorMessages.push(`[${itemId}] ${JSON.stringify(result.error)}`)
    }
  }

  const errors: ValidationError[] =
    errorMessages.length > 0 ? [{ file: fileName, errors: errorMessages }] : []

  return { data: validItems, errors }
}

/** HMR対応: Vite dev serverでJSON変更時に自動リロード */
if (import.meta.hot) {
  import.meta.hot.accept(
    [
      '@/data/master/ships.json',
      '@/data/master/ports.json',
      '@/data/master/tradeGoods.json',
      '@/data/master/skills.json',
    ],
    () => {
      console.log('[DataLoader] HMR detected, reloading master data...')
      loadAllMasterData()
    },
  )
}
