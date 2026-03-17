// ============================================================
// Compass — 進行方向・風向を視覚的に表示するコンパスUI
// ============================================================

import { useNavigationStore } from '@/stores/useNavigationStore.ts'

const SIZE = 80
const CENTER = SIZE / 2
const RADIUS = 32

// 方位ラベル
const CARDINAL_LABELS = [
  { angle: 0, label: 'N' },
  { angle: 90, label: 'E' },
  { angle: 180, label: 'S' },
  { angle: 270, label: 'W' },
]

const TICK_ANGLES = Array.from({ length: 36 }, (_, i) => i * 10)

export function Compass() {
  const heading = useNavigationStore((s) => s.heading)
  const wind = useNavigationStore((s) => s.wind)
  const mode = useNavigationStore((s) => s.mode)

  if (mode === 'docked') return null

  const headingLabel = getHeadingLabel(heading)

  return (
    <div style={styles.container}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* 外枠円 */}
        <circle cx={CENTER} cy={CENTER} r={RADIUS + 4} fill="none" stroke="rgba(120, 172, 219, 0.2)" strokeWidth={1} />
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="rgba(8, 28, 58, 0.6)" stroke="rgba(120, 172, 219, 0.3)" strokeWidth={0.8} />

        {/* 回転グループ (ヘディングに合わせて回転) */}
        <g transform={`rotate(${-heading}, ${CENTER}, ${CENTER})`}>
          {/* 目盛り */}
          {TICK_ANGLES.map((angle) => {
            const isMajor = angle % 90 === 0
            const isMinor = angle % 30 === 0
            const innerR = isMajor ? RADIUS - 8 : isMinor ? RADIUS - 5 : RADIUS - 3
            const rad = (angle * Math.PI) / 180
            return (
              <line
                key={angle}
                x1={CENTER + Math.sin(rad) * innerR}
                y1={CENTER - Math.cos(rad) * innerR}
                x2={CENTER + Math.sin(rad) * (RADIUS - 1)}
                y2={CENTER - Math.cos(rad) * (RADIUS - 1)}
                stroke={isMajor ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)'}
                strokeWidth={isMajor ? 1.2 : 0.6}
              />
            )
          })}

          {/* 方位ラベル */}
          {CARDINAL_LABELS.map(({ angle, label }) => {
            const rad = (angle * Math.PI) / 180
            const labelR = RADIUS - 14
            return (
              <text
                key={label}
                x={CENTER + Math.sin(rad) * labelR}
                y={CENTER - Math.cos(rad) * labelR + 3}
                textAnchor="middle"
                fill={label === 'N' ? '#f87171' : 'rgba(200, 230, 255, 0.7)'}
                fontSize={label === 'N' ? 9 : 7}
                fontWeight={label === 'N' ? 700 : 400}
              >
                {label}
              </text>
            )
          })}

          {/* 風向矢印 (青) */}
          <g transform={`rotate(${wind.direction}, ${CENTER}, ${CENTER})`}>
            <line
              x1={CENTER}
              y1={CENTER + RADIUS * 0.55}
              x2={CENTER}
              y2={CENTER - RADIUS * 0.55}
              stroke="rgba(96, 165, 250, 0.5)"
              strokeWidth={1.5}
              strokeDasharray="3 2"
            />
            <polygon
              points={`${CENTER},${CENTER - RADIUS * 0.55} ${CENTER - 3},${CENTER - RADIUS * 0.35} ${CENTER + 3},${CENTER - RADIUS * 0.35}`}
              fill="rgba(96, 165, 250, 0.6)"
            />
          </g>
        </g>

        {/* 船首マーカー (固定、上向き) */}
        <polygon
          points={`${CENTER},${CENTER - RADIUS - 2} ${CENTER - 4},${CENTER - RADIUS + 5} ${CENTER + 4},${CENTER - RADIUS + 5}`}
          fill="#f87171"
        />

        {/* 中心の点 */}
        <circle cx={CENTER} cy={CENTER} r={2} fill="rgba(255,255,255,0.6)" />
      </svg>

      {/* ヘディング表示 */}
      <div style={styles.headingText}>
        {heading.toFixed(0)}° {headingLabel}
      </div>
    </div>
  )
}

function getHeadingLabel(heading: number): string {
  const h = ((heading % 360) + 360) % 360
  if (h < 22.5 || h >= 337.5) return 'N'
  if (h < 67.5) return 'NE'
  if (h < 112.5) return 'E'
  if (h < 157.5) return 'SE'
  if (h < 202.5) return 'S'
  if (h < 247.5) return 'SW'
  if (h < 292.5) return 'W'
  return 'NW'
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: 148,
    right: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 120,
  },
  headingText: {
    marginTop: 2,
    color: '#b8c9de',
    fontSize: 10,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
}
