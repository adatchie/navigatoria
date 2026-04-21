// ============================================================
// StatusBar — 画面上部に主要ステータスを常時表示
// ============================================================

import { useGameStore } from '@/stores/useGameStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { uiText } from '@/i18n/uiText.ts'

const MONTH_NAMES = uiText.statusBar.months

export function StatusBar() {
  const timeState = useGameStore((s) => s.timeState)
  const speed = useGameStore((s) => s.speed)
  const paused = useGameStore((s) => s.paused)
  const player = usePlayerStore((s) => s.player)
  const ships = usePlayerStore((s) => s.ships)

  const fleetSupply = ships.reduce(
    (total, ship) => ({
      food: total.food + ship.supplies.food,
      maxFood: total.maxFood + ship.supplies.maxFood,
      water: total.water + ship.supplies.water,
      maxWater: total.maxWater + ship.supplies.maxWater,
    }),
    { food: 0, maxFood: 0, water: 0, maxWater: 0 },
  )

  // 日付フォーマット
  const monthName = MONTH_NAMES[timeState.month - 1] ?? '???'
  const dateStr = `${timeState.day} ${monthName} ${timeState.year}`
  const hourStr = `${Math.floor(timeState.hour).toString().padStart(2, '0')}:${Math.floor((timeState.hour % 1) * 60).toString().padStart(2, '0')}`

  // 速度ラベル
  const speedLabel = paused ? uiText.statusBar.paused : speed === 0 ? uiText.statusBar.stop : `x${speed}`

  // 補給状況の警告色
  const foodRatio = fleetSupply.food / Math.max(1, fleetSupply.maxFood)
  const waterRatio = fleetSupply.water / Math.max(1, fleetSupply.maxWater)
  const foodColor = foodRatio < 0.2 ? '#ef4444' : foodRatio < 0.4 ? '#f59e0b' : '#94a3b8'
  const waterColor = waterRatio < 0.2 ? '#ef4444' : waterRatio < 0.4 ? '#f59e0b' : '#94a3b8'

  return (
    <div style={styles.bar}>
      {/* 日付・時刻 */}
      <div style={styles.segment}>
        <span style={styles.value}>{dateStr}</span>
        <span style={styles.dim}>{hourStr}</span>
        <span style={{ ...styles.badge, background: paused ? 'rgba(239,68,68,0.3)' : 'rgba(96,165,250,0.2)' }}>
          {speedLabel}
        </span>
      </div>

      {/* 所持金 */}
      {player && (
        <div style={styles.segment}>
          <span style={styles.label}>{uiText.statusBar.money}</span>
          <span style={styles.value}>{player.money.toLocaleString()} d</span>
        </div>
      )}

      {/* 艦隊補給 */}
      {ships.length > 0 && (
        <>
          <div style={styles.supplySegment}>
            <span style={{ ...styles.label, color: foodColor }}>{uiText.statusBar.food}</span>
            <span style={{ ...styles.value, color: foodColor }}>{fleetSupply.food.toFixed(0)}/{fleetSupply.maxFood.toFixed(0)}</span>
            <div style={styles.supplyBar}><div style={{ ...styles.supplyFill, width: `${Math.round(foodRatio * 100)}%`, background: foodColor }} /></div>
          </div>
          <div style={styles.supplySegment}>
            <span style={{ ...styles.label, color: waterColor }}>{uiText.statusBar.water}</span>
            <span style={{ ...styles.value, color: waterColor }}>{fleetSupply.water.toFixed(0)}/{fleetSupply.maxWater.toFixed(0)}</span>
            <div style={styles.supplyBar}><div style={{ ...styles.supplyFill, width: `${Math.round(waterRatio * 100)}%`, background: waterColor }} /></div>
          </div>
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    padding: '0 16px',
    background: 'rgba(12, 19, 34, 0.75)',
    borderBottom: '1px solid rgba(120, 172, 219, 0.15)',
    backdropFilter: 'blur(8px)',
    zIndex: 130,
    fontSize: 12,
    color: '#e8edf7',
    pointerEvents: 'auto' as const,
  },
  segment: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  supplySegment: {
    display: 'grid',
    gridTemplateColumns: 'auto auto 120px',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    color: '#8fb1d8',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    color: '#e8edf7',
    fontWeight: 500,
  },
  dim: {
    color: '#8fb1d8',
    fontSize: 11,
  },
  badge: {
    padding: '1px 6px',
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 0.5,
    color: '#e8edf7',
  },
  supplyBar: {
    width: 120,
    height: 6,
    borderRadius: 999,
    background: 'rgba(148, 163, 184, 0.18)',
    overflow: 'hidden',
  },
  supplyFill: {
    height: '100%',
    borderRadius: 999,
  },
}
