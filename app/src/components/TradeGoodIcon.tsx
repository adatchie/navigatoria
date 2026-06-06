import { useMemo, type CSSProperties } from 'react'
import { useDataStore } from '@/stores/useDataStore.ts'

const TRADE_GOOD_ICON_COLUMNS = 10
const TRADE_GOOD_ICON_SPRITE_URL = `${import.meta.env.BASE_URL}generated/trade/trade-goods-sprite-78.png`

type TradeGoodIconProps = {
  goodId: string
  label?: string
  size?: number
}

export function TradeGoodIcon({ goodId, label, size = 44 }: TradeGoodIconProps) {
  const tradeGoods = useDataStore((state) => state.masterData.tradeGoods)
  const frameIndex = useMemo(() => tradeGoods.findIndex((good) => good.id === goodId), [goodId, tradeGoods])
  const hasFrame = frameIndex >= 0
  const rowCount = Math.max(1, Math.ceil(tradeGoods.length / TRADE_GOOD_ICON_COLUMNS))
  const column = hasFrame ? frameIndex % TRADE_GOOD_ICON_COLUMNS : 0
  const row = hasFrame ? Math.floor(frameIndex / TRADE_GOOD_ICON_COLUMNS) : 0
  const backgroundPositionX = (column / (TRADE_GOOD_ICON_COLUMNS - 1)) * 100
  const backgroundPositionY = rowCount > 1 ? (row / (rowCount - 1)) * 100 : 0

  const style: CSSProperties = {
    width: size,
    height: size,
    flex: `0 0 ${size}px`,
    display: 'inline-grid',
    placeItems: 'center',
    overflow: 'hidden',
    borderRadius: 8,
    border: '1px solid rgba(191, 219, 254, 0.2)',
    backgroundColor: 'rgba(6, 15, 28, 0.72)',
    backgroundImage: hasFrame ? `url(${TRADE_GOOD_ICON_SPRITE_URL})` : undefined,
    backgroundSize: `${TRADE_GOOD_ICON_COLUMNS * 100}% ${rowCount * 100}%`,
    backgroundPosition: `${backgroundPositionX}% ${backgroundPositionY}%`,
    backgroundRepeat: 'no-repeat',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 18px rgba(0,0,0,0.22)',
    color: '#93a8c4',
    fontSize: Math.max(10, Math.floor(size * 0.28)),
    fontWeight: 800,
  }

  return (
    <span style={style} role="img" aria-label={label ?? goodId} title={label ?? goodId}>
      {!hasFrame && '?'}
    </span>
  )
}
