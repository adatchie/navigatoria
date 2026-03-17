// ============================================================
// MiniMap — ワールドマップ上に港・自船位置を表示
// ============================================================

import { useRef, useEffect, useCallback } from 'react'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { WORLD_WIDTH, WORLD_HEIGHT } from '@/config/gameConfig.ts'
import type { Port } from '@/types/port.ts'

// ミニマップのサイズ (CSS px)
const MAP_WIDTH = 240
const MAP_HEIGHT = 120
const PIXEL_RATIO = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1

// 国籍カラーマップ
const NATIONALITY_COLORS: Record<string, string> = {
  portugal: '#34d399',
  spain: '#f97316',
  england: '#60a5fa',
  netherlands: '#facc15',
  france: '#a78bfa',
  venice: '#f87171',
  ottoman: '#22c55e',
}
const DEFAULT_PORT_COLOR = '#ffffff'

// ワールド座標 → キャンバスピクセル
function worldToCanvas(x: number, y: number): [number, number] {
  const cx = (x / WORLD_WIDTH) * MAP_WIDTH * PIXEL_RATIO
  // Y軸: ワールドではy大が北、キャンバスではy小が上
  const cy = (1 - y / WORLD_HEIGHT) * MAP_HEIGHT * PIXEL_RATIO
  return [cx, cy]
}

export function MiniMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const position = useNavigationStore((s) => s.position)
  const heading = useNavigationStore((s) => s.heading)
  const sailRatio = useNavigationStore((s) => s.sailRatio)
  const wind = useNavigationStore((s) => s.wind)
  const ports = useWorldStore((s) => s.ports)
  const playerNationality = usePlayerStore((s) => s.player?.nationality)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = MAP_WIDTH * PIXEL_RATIO
    const h = MAP_HEIGHT * PIXEL_RATIO

    // 背景クリア
    ctx.clearRect(0, 0, w, h)

    // 海面
    ctx.fillStyle = 'rgba(8, 28, 58, 0.85)'
    ctx.fillRect(0, 0, w, h)

    // グリッド線 (200kmごと)
    ctx.strokeStyle = 'rgba(100, 140, 200, 0.1)'
    ctx.lineWidth = PIXEL_RATIO * 0.5
    for (let gx = 200; gx < WORLD_WIDTH; gx += 200) {
      const [cx] = worldToCanvas(gx, 0)
      ctx.beginPath()
      ctx.moveTo(cx, 0)
      ctx.lineTo(cx, h)
      ctx.stroke()
    }
    for (let gy = 200; gy < WORLD_HEIGHT; gy += 200) {
      const [, cy] = worldToCanvas(0, gy)
      ctx.beginPath()
      ctx.moveTo(0, cy)
      ctx.lineTo(w, cy)
      ctx.stroke()
    }

    // 港マーカー
    for (const port of ports) {
      drawPort(ctx, port, playerNationality)
    }

    // 帆走中は進行方向を破線で表示
    if (sailRatio > 0) {
      const [sx, sy] = worldToCanvas(position.x, position.y)
      const headingRad = (heading * Math.PI) / 180
      // 進行方向に40km先の点を描画
      const fwdX = position.x + Math.sin(headingRad) * 40
      const fwdY = position.y + Math.cos(headingRad) * 40
      const [fx, fy] = worldToCanvas(fwdX, fwdY)
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)'
      ctx.lineWidth = PIXEL_RATIO
      ctx.setLineDash([4 * PIXEL_RATIO, 3 * PIXEL_RATIO])
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(fx, fy)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // 風向矢印 (右上)
    drawWindArrow(ctx, wind.direction, wind.speed, w, PIXEL_RATIO)

    // 自船位置 (三角形)
    drawShip(ctx, position.x, position.y, heading)
  }, [position, heading, sailRatio, wind, ports, playerNationality])

  useEffect(() => {
    const id = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(id)
  }, [draw])

  return (
    <div style={styles.container}>
      <canvas
        ref={canvasRef}
        width={MAP_WIDTH * PIXEL_RATIO}
        height={MAP_HEIGHT * PIXEL_RATIO}
        style={styles.canvas}
      />
      <div style={styles.label}>CHART</div>
    </div>
  )
}

// --- 描画ヘルパー ---

function drawPort(ctx: CanvasRenderingContext2D, port: Port, playerNationality?: string) {
  const [cx, cy] = worldToCanvas(port.position.x, port.position.y)
  const color = NATIONALITY_COLORS[port.nationality] ?? DEFAULT_PORT_COLOR
  const r = port.size === 'capital' ? 3 * PIXEL_RATIO : port.size === 'large' ? 2.2 * PIXEL_RATIO : 1.6 * PIXEL_RATIO

  // 自国の港はリングを追加
  if (playerNationality && port.nationality === playerNationality) {
    ctx.strokeStyle = color
    ctx.lineWidth = PIXEL_RATIO * 0.8
    ctx.beginPath()
    ctx.arc(cx, cy, r + 2 * PIXEL_RATIO, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // 港名 (capitalのみ)
  if (port.size === 'capital') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.font = `${8 * PIXEL_RATIO}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(port.nameEn, cx, cy - r - 2 * PIXEL_RATIO)
  }
}

function drawShip(ctx: CanvasRenderingContext2D, wx: number, wy: number, heading: number) {
  const [cx, cy] = worldToCanvas(wx, wy)
  const size = 4 * PIXEL_RATIO
  const rad = (heading * Math.PI) / 180

  ctx.save()
  ctx.translate(cx, cy)
  // キャンバスのY反転を考慮してheadingを逆にする
  ctx.rotate(-rad)

  // 三角形 (上向きが北=0度)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(0, -size)
  ctx.lineTo(-size * 0.6, size * 0.5)
  ctx.lineTo(size * 0.6, size * 0.5)
  ctx.closePath()
  ctx.fill()

  // 船の周りにグロー
  ctx.shadowColor = '#60a5fa'
  ctx.shadowBlur = 6 * PIXEL_RATIO
  ctx.fillStyle = 'rgba(96, 165, 250, 0.6)'
  ctx.beginPath()
  ctx.arc(0, 0, 2 * PIXEL_RATIO, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.restore()
}

function drawWindArrow(ctx: CanvasRenderingContext2D, direction: number, speed: number, canvasWidth: number, pr: number) {
  const cx = canvasWidth - 16 * pr
  const cy = 16 * pr
  const len = Math.min(10, 4 + speed * 0.3) * pr
  const rad = (direction * Math.PI) / 180

  // 風向き（風が吹いてくる方向 → 吹く方向を矢印で示す）
  const dx = Math.sin(rad) * len
  const dy = -Math.cos(rad) * len

  ctx.strokeStyle = 'rgba(200, 230, 255, 0.6)'
  ctx.lineWidth = 1.2 * pr
  ctx.beginPath()
  ctx.moveTo(cx - dx, cy + dy)
  ctx.lineTo(cx + dx, cy - dy)
  ctx.stroke()

  // 矢先
  const arrowSize = 3 * pr
  const tipX = cx + dx
  const tipY = cy - dy
  ctx.fillStyle = 'rgba(200, 230, 255, 0.6)'
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(tipX - arrowSize * Math.cos(rad - 0.5), tipY - arrowSize * Math.sin(rad - 0.5))
  ctx.lineTo(tipX - arrowSize * Math.cos(rad + 0.5), tipY - arrowSize * Math.sin(rad + 0.5))
  ctx.closePath()
  ctx.fill()

  // 風速テキスト
  ctx.fillStyle = 'rgba(200, 230, 255, 0.5)'
  ctx.font = `${7 * pr}px sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(`${speed.toFixed(0)}kt`, cx, cy + 14 * pr)
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: 16,
    right: 16,
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid rgba(120, 172, 219, 0.24)',
    background: 'rgba(12, 19, 34, 0.7)',
    backdropFilter: 'blur(8px)',
    zIndex: 120,
    pointerEvents: 'auto' as const,
  },
  canvas: {
    display: 'block',
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
  },
  label: {
    position: 'absolute',
    top: 4,
    left: 8,
    color: 'rgba(143, 177, 216, 0.6)',
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: 600,
    textTransform: 'uppercase',
  },
}
