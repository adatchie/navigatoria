// ============================================================
// SailControl — 帆の開閉操作UI
// ============================================================
// スライダーとボタンで帆の開閉率 (0-100%) を調整
// 帆を開く＝加速、閉じる＝減速・停止

import { useCallback } from 'react'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { uiText } from '@/i18n/uiText.ts'
import { antiqueColors, antiqueFonts, antiqueStyles } from '@/ui/antiqueTheme.ts'

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
    ...antiqueStyles.oceanPanel,
    position: 'fixed',
    bottom: 'calc(18px * var(--navigatoria-ui-scale, 1))',
    left: 'var(--navigatoria-sail-left, calc(12px + 364px * var(--navigatoria-ui-scale, 1)))',
    width: 160,
    padding: '10px 12px',
    zIndex: 120,
    pointerEvents: 'auto' as const,
    transform: 'scale(var(--navigatoria-ui-scale, 1))',
    transformOrigin: 'bottom left',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    color: antiqueColors.brass,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 600,
  },
  value: {
    color: antiqueColors.candle,
    fontSize: 16,
    fontWeight: 700,
    fontFamily: antiqueFonts.title,
  },
  slider: {
    width: '100%',
    height: 6,
    appearance: 'auto',
    cursor: 'pointer',
    marginBottom: 8,
    accentColor: antiqueColors.brass,
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
    border: '1px solid rgba(201, 151, 92, 0.22)',
    borderRadius: 2,
    background: 'rgba(255, 255, 255, 0.035)',
    color: antiqueColors.candle,
    cursor: 'pointer',
  },
  buttonActive: {
    background: 'rgba(184, 134, 11, 0.24)',
    borderColor: antiqueColors.brass,
    color: antiqueColors.brassBright,
  },
  speedRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTop: '1px solid rgba(201,151,92,0.16)',
  },
  speedLabel: {
    color: antiqueColors.brass,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  speedValue: {
    color: antiqueColors.candle,
    fontSize: 13,
    fontWeight: 600,
  },
  hint: {
    marginTop: 6,
    color: antiqueColors.brassDark,
    fontSize: 9,
    textAlign: 'center',
  },
}
