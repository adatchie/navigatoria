import { useMemo, type CSSProperties } from 'react'
import { useDataStore } from '@/stores/useDataStore.ts'
import type { DiscoveryMethod } from '@/types/discovery.ts'

const DISCOVERY_ICON_COLUMNS = 5
const DISCOVERY_ICON_ROWS = 4
const DISCOVERY_ICON_FRAME_COUNT = DISCOVERY_ICON_COLUMNS * DISCOVERY_ICON_ROWS
const DISCOVERY_ICON_SPRITE_URL = `${import.meta.env.BASE_URL}generated/discovery/discovery-sprite-20.png`

const ADVENTURE_QUEST_ICON_COLUMNS = 2
const ADVENTURE_QUEST_ICON_SPRITE_URL = `${import.meta.env.BASE_URL}generated/discovery/method-sprite.png`

type DiscoveryIconProps = {
  discoveryId: string
  label?: string
  size?: number
}

type AdventureQuestIconProps = {
  method?: DiscoveryMethod
  label?: string
  size?: number
}

function getSpriteBackgroundPosition(column: number, row: number, columns: number, rows: number): string {
  const x = columns > 1 ? (column / (columns - 1)) * 100 : 0
  const y = rows > 1 ? (row / (rows - 1)) * 100 : 0
  return `${x}% ${y}%`
}

function getIconStyle(size: number): CSSProperties {
  return {
    width: size,
    height: size,
    flex: `0 0 ${size}px`,
    display: 'inline-grid',
    placeItems: 'center',
    overflow: 'hidden',
    borderRadius: 8,
    border: '1px solid rgba(244, 201, 130, 0.26)',
    backgroundColor: 'rgba(6, 15, 28, 0.72)',
    backgroundRepeat: 'no-repeat',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 18px rgba(0,0,0,0.22)',
    color: '#93a8c4',
    fontSize: Math.max(10, Math.floor(size * 0.28)),
    fontWeight: 800,
  }
}

export function DiscoveryIcon({ discoveryId, label, size = 44 }: DiscoveryIconProps) {
  const discoveries = useDataStore((state) => state.masterData.discoveries)
  const frameIndex = useMemo(() => discoveries.findIndex((discovery) => discovery.id === discoveryId), [discoveryId, discoveries])
  const hasFrame = frameIndex >= 0 && frameIndex < DISCOVERY_ICON_FRAME_COUNT
  const column = hasFrame ? frameIndex % DISCOVERY_ICON_COLUMNS : 0
  const row = hasFrame ? Math.floor(frameIndex / DISCOVERY_ICON_COLUMNS) : 0

  const style: CSSProperties = {
    ...getIconStyle(size),
    backgroundImage: hasFrame ? `url(${DISCOVERY_ICON_SPRITE_URL})` : undefined,
    backgroundSize: `${DISCOVERY_ICON_COLUMNS * 100}% ${DISCOVERY_ICON_ROWS * 100}%`,
    backgroundPosition: getSpriteBackgroundPosition(column, row, DISCOVERY_ICON_COLUMNS, DISCOVERY_ICON_ROWS),
  }

  return (
    <span style={style} role="img" aria-label={label ?? discoveryId} title={label ?? discoveryId}>
      {!hasFrame && '?'}
    </span>
  )
}

export function AdventureQuestIcon({ method = 'sighting', label, size = 44 }: AdventureQuestIconProps) {
  const column = method === 'search' ? 1 : 0
  const style: CSSProperties = {
    ...getIconStyle(size),
    backgroundImage: `url(${ADVENTURE_QUEST_ICON_SPRITE_URL})`,
    backgroundSize: `${ADVENTURE_QUEST_ICON_COLUMNS * 100}% 100%`,
    backgroundPosition: getSpriteBackgroundPosition(column, 0, ADVENTURE_QUEST_ICON_COLUMNS, 1),
  }

  return (
    <span style={style} role="img" aria-label={label ?? (method === 'search' ? '探索クエスト' : '視認クエスト')} title={label ?? (method === 'search' ? '探索クエスト' : '視認クエスト')} />
  )
}
