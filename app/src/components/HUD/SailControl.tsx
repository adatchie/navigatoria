// ============================================================
// SailControl — 帆の開閉操作UI
// ============================================================
// スライダーとボタンで帆の開閉率 (0-100%) を調整
// 帆を開く＝加速、閉じる＝減速・停止

import { useCallback } from 'react'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { uiText } from '@/i18n/uiText.ts'

// 帆の段階（ボタン操作用）
const SAIL_STEPS = [0, 0.25, 0.5, 0.75, 1.0]
const SAIL_LABELS = ['収帆', '1/4', '半帆', '3/4', '全帆']

export function SailControl() {
  const mode = useNavigationStore((s) => s.mode)
  const sailRatio = useNavigationStore((s) => s.sailRatio)
  const setSailRatio = useNavigationStore((s) => s.setSailRatio)
  const currentSpeed = useNavigationStore((s) => s.currentSpeed)
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSailRatio(Number(e.target.value) / 100)
    },
    [setSailRatio],
  )

  // 停泊中は表示しない
  if (mode === 'docked') return null

  const percent = Math.round(sailRatio * 100)

  return (
    <div style={styles.container}>
      {/* 帆の状態表示 */}
      <div style={styles.header}>
        <span style={styles.label}>{uiText.sail.label}</span>
        <span style={styles.value}>{percent}%</span>
      </div>

      {/* スライダー */}
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        onChange={handleSliderChange}
        style={styles.slider}
      />

      {/* 段階ボタン */}
      <div style={styles.buttons}>
        {SAIL_STEPS.map((step, i) => (
          <button
            key={step}
            onClick={() => setSailRatio(step)}
            style={{
              ...styles.button,
              ...(Math.abs(sailRatio - step) < 0.05 ? styles.buttonActive : {}),
            }}
          >
            {SAIL_LABELS[i]}
          </button>
        ))}
      </div>

      {/* 速度表示 */}
      <div style={styles.speedRow}>
        <span style={styles.speedLabel}>{uiText.sail.speed}</span>
        <span style={styles.speedValue}>{currentSpeed.toFixed(1)} kt</span>
      </div>

      {/* 操作ヒント */}
      <div style={styles.hint}>
        {sailRatio === 0
          ? uiText.sail.openToSail
          : uiText.sail.clickSea}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: 18,
    left: 376,
    width: 160,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(12, 19, 34, 0.82)',
    border: '1px solid rgba(120, 172, 219, 0.24)',
    backdropFilter: 'blur(10px)',
    zIndex: 120,
    pointerEvents: 'auto' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    color: '#8fb1d8',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 600,
  },
  value: {
    color: '#e8edf7',
    fontSize: 16,
    fontWeight: 700,
  },
  slider: {
    width: '100%',
    height: 6,
    appearance: 'auto',
    cursor: 'pointer',
    marginBottom: 8,
    accentColor: '#60a5fa',
  },
  buttons: {
    display: 'flex',
    gap: 3,
    marginBottom: 8,
  },
  button: {
    flex: 1,
    padding: '4px 2px',
    fontSize: 9,
    fontWeight: 500,
    border: '1px solid rgba(120, 172, 219, 0.2)',
    borderRadius: 6,
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#b8c9de',
    cursor: 'pointer',
  },
  buttonActive: {
    background: 'rgba(96, 165, 250, 0.3)',
    borderColor: 'rgba(96, 165, 250, 0.5)',
    color: '#ffffff',
  },
  speedRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  speedLabel: {
    color: '#8fb1d8',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  speedValue: {
    color: '#e8edf7',
    fontSize: 13,
    fontWeight: 600,
  },
  hint: {
    marginTop: 6,
    color: '#6b8aaa',
    fontSize: 9,
    textAlign: 'center',
  },
}
