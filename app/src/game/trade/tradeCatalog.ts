import type { Port } from '@/types/port.ts'
import type { TradeGood } from '@/types/trade.ts'

const COMMON_GOODS_BY_CULTURE: Record<string, string[]> = {
  west_europe: ['wheat', 'fish', 'salt', 'wine'],
  north_europe: ['fish', 'herring', 'wool', 'timber', 'beer', 'canvas', 'ship_tar'],
  east_europe: ['wheat', 'timber', 'fur', 'amber', 'ship_tar'],
  islamic: ['dates', 'cotton', 'coffee', 'salt', 'gum_arabic', 'sesame'],
  indian: ['cotton', 'pepper', 'indigo', 'rice', 'sesame'],
  southeast_asia: ['fish', 'tin_ingot'],
  east_asia: ['fish', 'paper', 'tea'],
  africa: ['fish', 'hide', 'timber', 'ivory', 'cowrie_shells'],
  new_world: ['fish', 'sugar', 'hide', 'maize', 'vanilla'],
}

export function getTradeCatalog(port: Port, goods: TradeGood[]): TradeGood[] {
  const seen = new Set<string>()
  const catalog: TradeGood[] = []

  const addGoods = (items: TradeGood[]) => {
    for (const item of items) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      catalog.push(item)
    }
  }

  addGoods(goods.filter((good) => good.origins.includes(port.id) || port.specialProducts.includes(good.id)))
  addGoods((COMMON_GOODS_BY_CULTURE[port.culture] ?? [])
    .map((goodId) => goods.find((good) => good.id === goodId))
    .filter((good): good is TradeGood => Boolean(good)))

  return catalog
}
