// ============================================================
// GameTimeControl — ゲーム時間操作HUD
// ============================================================

import { useGameStore } from '@/stores/useGameStore.ts'
import type { GameSpeed } from '@/types/common.ts'

const SPEED_OPTIONS: { label: string; value: GameSpeed }[] = [
  { label: '⏸', value: 0 },
  { label: '½×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '2×', value: 2 },
  { label: '4×', value: 4 },
]

export function GameTimeControl() {
  const { timeState, speed, paused, setSpeed, togglePause } = useGameStore()

  const hourStr = Math.floor(timeState.hour).toString().padStart(2, '0')
  const minStr = Math.floor((timeState.hour % 1) * 60)
    .toString()
    .padStart(2, '0')
  const dateStr = `${timeState.year}/${timeState.month}/${timeState.day}`

  return (
    <div style={styles.container}>
      {/* 日付表示 */}
      <div style={styles.date}>{dateStr}</div>

      {/* 時刻表示 */}
      <div style={styles.time}>
        {hourStr}:{minStr}
      </div>

      {/* 速度ボタン */}
      <div style={styles.speedButtons}>
        {SPEED_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            style={{
              ...styles.speedBtn,
              ...(speed === opt.value && !paused ? styles.activeSpeedBtn : {}),
            }}
            onClick={() => {
              if (opt.value === 0) {
                togglePause()
              } else {
                if (paused) togglePause()
                setSpeed(opt.value)
              }
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ゲーム日数 */}
      <div style={styles.dayCount}>Day {timeState.totalDays}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 42,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '6px 16px',
    background: 'rgba(10, 10, 20, 0.8)',
    borderRadius: 8,
    color: '#eee',
    fontFamily: 'monospace',
    fontSize: 14,
    zIndex: 140,
    userSelect: 'none',
    pointerEvents: 'auto',
    border: '1px solid rgba(100, 120, 180, 0.3)',
  },
  date: { color: '#8899bb' },
  time: { fontSize: 18, fontWeight: 'bold', color: '#ffd700' },
  speedButtons: { display: 'flex', gap: 2 },
  speedBtn: {
    padding: '2px 8px',
    background: '#333',
    color: '#aaa',
    border: '1px solid #555',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    minWidth: 28,
    textAlign: 'center' as const,
  },
  activeSpeedBtn: {
    background: '#446',
    color: '#fff',
    borderColor: '#88aaff',
  },
  dayCount: { color: '#6688aa', fontSize: 11 },
}
