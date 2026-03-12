// ============================================================
// ゲーム用数学ユーティリティ
// ============================================================

/** 度→ラジアン */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** ラジアン→度 */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

/** 値をmin-max範囲にクランプ */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** 線形補間 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1)
}

/** 角度の線形補間 (最短経路) */
export function lerpAngle(a: number, b: number, t: number): number {
  const diff = ((b - a + 540) % 360) - 180
  return a + diff * clamp(t, 0, 1)
}

/** 2点間の距離 (km) */
export function distance2D(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

/** 2点間の方位角 (度, 0=北) */
export function bearing(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const angle = radToDeg(Math.atan2(dx, dy))
  return (angle + 360) % 360
}

/** 風の影響計算: 船の進行方向と風向の関係からスピード係数を算出 */
export function windSpeedFactor(
  shipHeading: number,
  windDirection: number,
  verticalSails: number,
  horizontalSails: number,
): number {
  // 風に対する相対角度 (0=追い風, 180=向かい風)
  const relativeAngle = Math.abs(((windDirection - shipHeading + 540) % 360) - 180)

  // 横帆: 追い風に強い (0度で最大1.0, 90度で0.5, 180度でほぼ0)
  const horizontalFactor = Math.max(0, Math.cos(degToRad(relativeAngle))) * horizontalSails

  // 縦帆: 横風に強い (45-90度で最大, 正面・背面で弱い)
  const verticalFactor =
    Math.abs(Math.sin(degToRad(relativeAngle))) * 0.8 * verticalSails +
    0.2 * verticalSails // 最低保証

  const totalSails = verticalSails + horizontalSails
  if (totalSails === 0) return 0.1 // 帆なし(ガレー船等)は最低速度

  return clamp((horizontalFactor + verticalFactor) / totalSails, 0.1, 1.5)
}

/** 値を指定範囲内でラップ (角度等) */
export function wrap(value: number, min: number, max: number): number {
  const range = max - min
  return ((((value - min) % range) + range) % range) + min
}

/** スムースステップ補間 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

