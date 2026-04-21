// ============================================================
// NavigationSystem — 帆走モデルによる航海計算
// ============================================================
// クリック＝舵（方向指示）、帆の開閉率＝スピード調整
// 改良版：進行方向に応じた接線方向探索による連続沿岸スライド
// 改良版：航行不能理由に応じた通知内容の体系化（A-3）
// 改良版：UIストアとの連携による停止フラグ管理と通知自動クリア
// ============================================================

import type { GameSystem } from '@/game/GameLoop.ts'
import { NAVIGATION_CONFIG, TIME_CONFIG, WORLD_DISTANCE_SCALE, WORLD_WIDTH, WORLD_HEIGHT } from '@/config/gameConfig.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import type { Position2D } from '@/types/common.ts'
import { windSpeedFactor } from '@/game/utils/math.ts'
import { isPointOnLand } from '@/data/master/landmasses.ts'
import { useUIStore } from '@/stores/useUIStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { updateStopTimer } from '@/stores/useUIStore.ts'

declare global {
  interface Window {
    __NAV_LOG_COUNT__?: number
    __LAND_NOTICE__?: number
    __CREW_NOTICE__?: number
  }
}

// --- 停止理由列挙と通知メッセージ --- //
export const StopReason = {
  CREW_SHORTAGE: '船員不足',
  FOOD_SHORTAGE: '食料不足',
  WATER_SHORTAGE: '水不足',
  STRUCTURE_DAMAGE: '構造損傷',
  MORALE_CRISIS: '士気崩壊',
  STRUCK_GROUND: '座礁',
  BATTLE_MODE: '戦闘モード',
  FORCED_RETURN: '強制送還',
  ANCHORED: '投錨中',
  DOCKED: '停泊中',
} as const

export type StopReason = typeof StopReason[keyof typeof StopReason]

function getStopReasonMessage(reason: StopReason, detail?: string): string {
  const map: Record<StopReason, string> = {
    [StopReason.CREW_SHORTAGE]: '船員不足で航行不能です。必要人数まであと %s 人必要です。',
    [StopReason.FOOD_SHORTAGE]: '食料が不足しています。',
    [StopReason.WATER_SHORTAGE]: '水が不足しています。',
    [StopReason.STRUCTURE_DAMAGE]: '船に構造損傷があります。修理が必要です。',
    [StopReason.MORALE_CRISIS]: '士気が極度に低下しています。酒場での回復が必要です。',
    [StopReason.STRUCK_GROUND]: '陸地に接触しています。安全な海域まで移動してください。',
    [StopReason.BATTLE_MODE]: '戦闘モードです。離脱または防御してください。',
    [StopReason.FORCED_RETURN]: '%s へ強制送還されました。',
    [StopReason.ANCHORED]: '現在投錨中です。錨を上げて移動してください。',
    [StopReason.DOCKED]: '現在停泊中です。次の出航を準備してください。',
  }
  const base = map[reason]
  return base ? (detail ? base.replace('%s', detail) : base) : '航行不能です。'
}

// 乗組員充足率による性能補正
function getCrewPerformance(activeCrew: number, requiredCrew: number): number {
  if (requiredCrew <= 0) return 1
  return Math.max(0, Math.min(1.1, activeCrew / requiredCrew))
}

// 士気による速度・旋回補正
function getMoralePerformance(morale: number): { speed: number; turn: number } {
  if (morale >= 80) {
    return {
      speed: NAVIGATION_CONFIG.HIGH_MORALE_SPEED_BONUS,
      turn: NAVIGATION_CONFIG.HIGH_MORALE_TURN_BONUS,
    }
  }
  if (morale >= 45) return { speed: 1, turn: 1 }
  const ratio = Math.max(0, morale / 45)
  return {
    speed: NAVIGATION_CONFIG.LOW_MORALE_SPEED_FACTOR + (1 - NAVIGATION_CONFIG.LOW_MORALE_SPEED_FACTOR) * ratio,
    turn: NAVIGATION_CONFIG.LOW_MORALE_TURN_FACTOR + (1 - NAVIGATION_CONFIG.LOW_MORALE_TURN_FACTOR) * ratio,
  }
}

// 積載率による速度ペナルティ
function getLoadPerformance(usedCapacity: number, maxCapacity: number, cargoUpgradeLevel: number): number {
  if (maxCapacity <= 0) return 1
  const loadRatio = usedCapacity / maxCapacity
  if (loadRatio <= 0.6) return 1
  const rawPenalty = Math.min(0.18, (loadRatio - 0.6) * 0.45)
  const mitigation = 1 - cargoUpgradeLevel * 0.28
  return 1 - rawPenalty * Math.max(0.2, mitigation)
}

function clampWorldPosition(x: number, y: number): Position2D {
  return {
    x: Math.max(0, Math.min(WORLD_WIDTH, x)),
    y: Math.max(0, Math.min(WORLD_HEIGHT, y)),
  }
}

function isSailable(position: Position2D): boolean {
  return !isPointOnLand([position.x, position.y])
}

// ユーティリティ：2点間の距離
function distance(a: Position2D, b: Position2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// コース方向に沿った沿岸スライドを探索する改良版（360方向探索）
function trySlideAlongCoast(origin: Position2D, dx: number, dy: number, steeringBias: number): Position2D | null {
  const length = Math.hypot(dx, dy)
  if (length <= 0.0001) return null

  // 進行方向（steeringBiasに応じて接線方向を算出）
  const desiredDir = steeringBias > 0 ? [dy / length, -dx / length] : steeringBias < 0 ? [-dy / length, dx / length] : [dy / length, -dx / length]

  // 細かい角度ステップで沿岸方向を探索（1度刻み=Math.PI/180）
  const maxTryAngles = 360
  const stepAngle = (2 * Math.PI) / maxTryAngles
  let bestCandidate: Position2D | null = null
  let bestScore = -1

  for (let i = 0; i < maxTryAngles; i++) {
    const angle = i * stepAngle
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    // desiredDirに近い方向を重視したスコア
    const dirMatch = Math.abs(cos * desiredDir[0] + sin * desiredDir[1])
    const candidate: Position2D = {
      x: origin.x + cos * length,
      y: origin.y + sin * length,
    }
    if (isSailable(candidate)) {
      const score = dirMatch * length - distance(candidate, origin) * 0.01 // 距離はペナルティ
      if (score > bestScore) {
        bestScore = score
        bestCandidate = candidate
      }
    }
  }

  if (bestCandidate) return bestCandidate

  // バックアップ：単純な直角方向
  const rightTangent: [number, number] = [dy / length, -dx / length]
  const leftTangent: [number, number] = [-dy / length, dx / length]

  const axisCandidates = [
    clampWorldPosition(origin.x + rightTangent[0] * length, origin.y + rightTangent[1] * length),
    clampWorldPosition(origin.x + leftTangent[0] * length, origin.y + leftTangent[1] * length),
    clampWorldPosition(origin.x + dx, origin.y),
    clampWorldPosition(origin.x, origin.y + dy),
  ]

  for (const candidate of axisCandidates) {
    if (isSailable(candidate)) return candidate
  }

  return null
}

function rescueToDeparturePort(): void {
  const nav = useNavigationStore.getState()
  const departurePortId = nav.lastDeparturePortId
  if (!departurePortId) return

  const departurePort = useWorldStore.getState().ports.find((port) => port.id === departurePortId)
  if (!departurePort) return

  useNavigationStore.setState({
    mode: 'docked',
    position: departurePort.position,
    dockedPortId: departurePort.id,
    currentSpeed: 0,
    sailRatio: 0,
    targetHeading: nav.heading,
  })

  const playerStore = usePlayerStore.getState()
  playerStore.setPosition(departurePort.position)
  playerStore.updatePlayer({ currentPortId: departurePort.id })

  useGameStore.getState().setPhase('port')
  useUIStore.getState().setNotification(getStopReasonMessage(StopReason.FORCED_RETURN, departurePort.name), 5200)
}

export class NavigationSystem implements GameSystem {
  name = 'NavigationSystem'
  priority = 10

  update(deltaTime: number): void {
    // --- UIストア：停止フラグとタイマ更新 --- //
    updateStopTimer()

    const nav = useNavigationStore.getState()
    const playerStore = usePlayerStore.getState()
    const { speed } = useGameStore.getState()
    const w = window as Window & { __LAND_NOTICE__?: number }

    // 航行不能フラグで移動をブロック
    if (nav.mode === 'docked' || nav.mode === 'combat' || useUIStore.getState().isStopped) {
      if (nav.currentSpeed !== 0) nav.setSpeed(0)
      return
    }

    // --- 舵の処理: targetHeading に向かって旋回 ---
    const activeShip = playerStore.ships.find((s) => s.instanceId === playerStore.activeShipId)
    const shipType = activeShip ? useDataStore.getState().getShip(activeShip.typeId) : undefined

    const riggingLevel = activeShip?.upgrades?.rigging ?? 0
    const cargoUpgradeLevel = activeShip?.upgrades?.cargo ?? 0
    const riggingTurnFactor = 1 + riggingLevel * 0.06
    const riggingSpeedFactor = 1 + riggingLevel * 0.04

    const minimumCrew = shipType?.crew.min ?? 1
    const crewPerformance = getCrewPerformance(activeShip?.currentCrew ?? minimumCrew, minimumCrew)

    if ((activeShip?.currentCrew ?? 0) <= 0) {
      rescueToDeparturePort()
      nav.setSpeed(0)
      return
    }

    // 最低限の乗組員がいないと動けない
    if (crewPerformance < NAVIGATION_CONFIG.MINIMUM_MOVABLE_CREW_FACTOR) {
      nav.setSpeed(0)
      if (nav.mode !== 'anchored') nav.setMode('anchored')
      const now = performance.now()
      if (now - (w.__CREW_NOTICE__ ?? 0) > 3000) {
        const shortage = Math.max(0, minimumCrew - (activeShip?.currentCrew ?? 0))
        useUIStore.getState().addNotification(getStopReasonMessage(StopReason.CREW_SHORTAGE, `${shortage}`), 'warning', 2600)
        w.__CREW_NOTICE__ = now
      }
      // 停止フラグを立てる
      useUIStore.getState().setStopped(StopReason.CREW_SHORTAGE)
      return
    } else {
      // 乗組員が足りるなら停止フラグを解除
      useUIStore.getState().setResumed()
    }

    const crewTurnFactor = crewPerformance < 1
      ? NAVIGATION_CONFIG.LOW_CREW_TURN_FACTOR + (1 - NAVIGATION_CONFIG.LOW_CREW_TURN_FACTOR) * crewPerformance
      : 1
    const crewSpeedFactor = crewPerformance < 1
      ? NAVIGATION_CONFIG.LOW_CREW_SPEED_FACTOR + (1 - NAVIGATION_CONFIG.LOW_CREW_SPEED_FACTOR) * crewPerformance
      : 1

    const moraleFactor = getMoralePerformance(activeShip?.morale ?? 70)

    // --- 旋回 ---
    const turnRate = (shipType?.turnRate ?? NAVIGATION_CONFIG.BASE_TURN_RATE) * riggingTurnFactor * crewTurnFactor * moraleFactor.turn
    const headingDiff = ((nav.targetHeading - nav.heading + 540) % 360) - 180
    const maxTurn = turnRate * deltaTime

    let newHeading: number
    if (Math.abs(headingDiff) <= maxTurn) {
      newHeading = nav.targetHeading
    } else {
      newHeading = nav.heading + Math.sign(headingDiff) * maxTurn
    }
    newHeading = ((newHeading % 360) + 360) % 360
    nav.setHeading(newHeading)

    // --- 速度計算: 帆の開閉率 × 風の影響 ---
    if (nav.sailRatio <= 0) {
      // 帆が閉じている → 停止（投錨状態）
      nav.setSpeed(0)
      if (nav.mode !== 'anchored') nav.setMode('anchored')
      return
    }

    // 帆走モードへ
    if (nav.mode !== 'sailing') nav.setMode('sailing')

    const baseSpeed = (shipType?.speed ?? 8) * riggingSpeedFactor
    const verticalSails = shipType?.verticalSails ?? 1
    const horizontalSails = shipType?.horizontalSails ?? 1
    const loadFactor = getLoadPerformance(activeShip?.usedCapacity ?? 0, activeShip?.maxCapacity ?? 1, cargoUpgradeLevel)

    // 風の影響: 帆の種類と風向から速度係数を計算
    const windFactor = windSpeedFactor(newHeading, nav.wind.direction, verticalSails, horizontalSails)

    // 風速による追加係数 (0-40kt の風速を 0.3-1.5 の係数に変換)
    const windSpeedBonus = 0.3 + (nav.wind.speed / 40) * 1.2

    // 最終速度 = 基本速度 × 帆の開閉率 × 風方向係数 × 風速係数 × 各種補正
    const effectiveSpeed = Math.min(
      NAVIGATION_CONFIG.MAX_SPEED,
      Math.max(
        0.5, // 微速前進の最低保証
        baseSpeed * nav.sailRatio * windFactor * windSpeedBonus * crewSpeedFactor * moraleFactor.speed * loadFactor,
      ),
    )

    // --- 移動 ---
    const headingRad = (newHeading * Math.PI) / 180
    const hoursPerRealSecond = (24 / TIME_CONFIG.REAL_SECONDS_PER_GAME_DAY) * speed
    // stepKm は実際のkm移動量
    const stepKm = effectiveSpeed * 1.852 * hoursPerRealSecond * deltaTime
    // マップ座標上の移動量に変換 (1マップ単位 = WORLD_DISTANCE_SCALE km)
    const stepMap = stepKm / WORLD_DISTANCE_SCALE

    const nx = Math.sin(headingRad)
    const ny = Math.cos(headingRad)
    const rawX = nav.position.x + nx * stepMap
    const rawY = nav.position.y + ny * stepMap
    const nextPosition = clampWorldPosition(rawX, rawY)

    const isBlockedByLand = !isSailable(nextPosition)
    if (isBlockedByLand) {
      const slidePosition = trySlideAlongCoast(
        nav.position,
        nx * stepMap,
        ny * stepMap,
        Math.sign(headingDiff),
      )
      if (slidePosition) {
        nav.setPosition(slidePosition)
        nav.addDistance(stepKm)
        playerStore.setPosition(slidePosition)
        playerStore.setHeading(newHeading)
        playerStore.updatePlayer({ currentPortId: undefined })
        // 航行可能になったので停止フラグを解除
        useUIStore.getState().setResumed()
        return
      }

      nav.setSpeed(0)
      if (nav.mode !== 'anchored') nav.setMode('anchored')
      playerStore.setHeading(newHeading)
      const now = performance.now()
      if (now - (w.__LAND_NOTICE__ ?? 0) > 3000) {
        useUIStore.getState().addNotification(getStopReasonMessage(StopReason.STRUCK_GROUND), 'warning', 2200)
        w.__LAND_NOTICE__ = now
      }
      // 停止フラグを立てる
      useUIStore.getState().setStopped(StopReason.STRUCK_GROUND)
      return
    }

    nav.setPosition(nextPosition)
    nav.addDistance(stepKm)
    playerStore.setPosition(nextPosition)
    playerStore.setHeading(newHeading)
    playerStore.updatePlayer({ currentPortId: undefined })

    // ストア更新直後の確認
    if (!w.__NAV_LOG_COUNT__) w.__NAV_LOG_COUNT__ = 0
    if (w.__NAV_LOG_COUNT__ < 3) {
      const storedNav = useNavigationStore.getState().position
      console.log(`[Nav] After update: stored=(${storedNav.x.toFixed(1)},${storedNav.y.toFixed(1)}) set_to=(${nextPosition.x.toFixed(1)},${nextPosition.y.toFixed(1)})`)
      w.__NAV_LOG_COUNT__++
    }
  }
}
