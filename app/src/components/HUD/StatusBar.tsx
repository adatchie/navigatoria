// ============================================================
// StatusBar — 画面上部に主要ステータスを常時表示
// ============================================================

import { useGameStore } from '@/stores/useGameStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { uiText } from '@/i18n/uiText.ts'

const MONTH_NAMES = uiText.statusBar.months

export function StatusBar() {
  const timeState = useGameStore((s) => s.timeState)
  const speed = useGameStore((s) => s.speed)
  const paused = useGameStore((s) => s.paused)
  const player = usePlayerStore((s) => s.player)
  const ships = usePlayerStore((s) => s.ships)
  const activeShipId = usePlayerStore((s) => s.activeShipId)
  const navMode = useNavigationStore((s) => s.mode)
  const currentSpeed = useNavigationStore((s) => s.currentSpeed)

  const activeShip = ships.find((s) => s.instanceId === activeShipId)

  // 日付フォーマット
  const monthName = MONTH_NAMES[timeState.month - 1] ?? '???'
  const dateStr = `${timeState.day} ${monthName} ${timeState.year}`
  const hourStr = `${Math.floor(timeState.hour).toString().padStart(2, '0')}:${Math.floor((timeState.hour % 1) * 60).toString().padStart(2, '0')}`

  // 速度ラベル
  const speedLabel = paused ? uiText.statusBar.paused : speed === 0 ? uiText.statusBar.stop : `x${speed}`

  // 補給状況の警告色
  const foodRatio = activeShip ? activeShip.supplies.food / Math.max(1, activeShip.supplies.maxFood) : 1
  const waterRatio = activeShip ? activeShip.supplies.water / Math.max(1, activeShip.supplies.maxWater) : 1
  const foodColor = foodRatio < 0.2 ? '#ef4444' : foodRatio < 0.4 ? '#f59e0b' : '#94a3b8'
  const waterColor = waterRatio < 0.2 ? '#ef4444' : waterRatio < 0.4 ? '#f59e0b' : '#94a3b8'

  // 耐久度の警告色
  const durRatio = activeShip ? activeShip.currentDurability / Math.max(1, activeShip.maxDurability) : 1
  const durColor = durRatio < 0.25 ? '#ef4444' : durRatio < 0.5 ? '#f59e0b' : '#94a3b8'

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

      {/* 航海情報 */}
      {navMode === 'sailing' && (
        <div style={styles.segment}>
          <span style={styles.label}>{uiText.statusBar.speed}</span>
          <span style={styles.value}>{currentSpeed.toFixed(1)} kt</span>
        </div>
      )}

      {/* 船体状況 */}
      {activeShip && (
        <>
          <div style={styles.segment}>
            <span style={styles.label}>{uiText.statusBar.hull}</span>
            <span style={{ ...styles.value, color: durColor }}>
              {activeShip.currentDurability}/{activeShip.maxDurability}
            </span>
          </div>
          <div style={styles.segment}>
            <span style={styles.label}>{uiText.statusBar.crew}</span>
            <span style={styles.value}>{activeShip.currentCrew}/{activeShip.maxCrew}</span>
          </div>
          <div style={styles.segment}>
            <span style={{ ...styles.label, color: foodColor }}>{uiText.statusBar.food}</span>
            <span style={{ ...styles.value, color: foodColor }}>{activeShip.supplies.food.toFixed(0)}</span>
          </div>
          <div style={styles.segment}>
            <span style={{ ...styles.label, color: waterColor }}>{uiText.statusBar.water}</span>
            <span style={{ ...styles.value, color: waterColor }}>{activeShip.supplies.water.toFixed(0)}</span>
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
}
