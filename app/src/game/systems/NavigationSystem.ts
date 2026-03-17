// ============================================================
// NavigationSystem — 帆走モデルによる航海計算
// ============================================================
// クリック＝舵（方向指示）、帆の開閉率＝スピード調整
// 帆が開いていれば風を受けて自動的に前進し続ける

import type { GameSystem } from '@/game/GameLoop.ts'
import { NAVIGATION_CONFIG, TIME_CONFIG, WORLD_DISTANCE_SCALE, WORLD_WIDTH, WORLD_HEIGHT } from '@/config/gameConfig.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { windSpeedFactor } from '@/game/utils/math.ts'

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

export class NavigationSystem implements GameSystem {
  name = 'NavigationSystem'
  priority = 10

  update(deltaTime: number): void {
    const nav = useNavigationStore.getState()
    const playerStore = usePlayerStore.getState()
    const { paused, speed } = useGameStore.getState()

    // 停泊中・戦闘中・ポーズ中は移動しない
    if (paused || nav.mode === 'docked' || nav.mode === 'combat') {
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

    // 最低限の乗組員がいないと動けない
    if (crewPerformance < NAVIGATION_CONFIG.MINIMUM_MOVABLE_CREW_FACTOR) {
      nav.setSpeed(0)
      return
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

    nav.setSpeed(effectiveSpeed)

    // --- 移動 ---
    const headingRad = (newHeading * Math.PI) / 180
    const hoursPerRealSecond = (24 / TIME_CONFIG.REAL_SECONDS_PER_GAME_DAY) * speed
    // stepKm は実際のkm移動量
    const stepKm = effectiveSpeed * 1.852 * hoursPerRealSecond * deltaTime
    // マップ座標上の移動量に変換 (1マップ単位 = WORLD_DISTANCE_SCALE km)
    const stepMap = stepKm / WORLD_DISTANCE_SCALE

    const nx = Math.sin(headingRad)
    const ny = Math.cos(headingRad)
    const nextPosition = {
      x: Math.max(0, Math.min(WORLD_WIDTH, nav.position.x + nx * stepMap)),
      y: Math.max(0, Math.min(WORLD_HEIGHT, nav.position.y + ny * stepMap)),
    }

    nav.setPosition(nextPosition)
    nav.addDistance(stepKm)
    playerStore.setPosition(nextPosition)
    playerStore.setHeading(newHeading)
    playerStore.updatePlayer({ currentPortId: undefined })
  }
}
