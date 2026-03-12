// ============================================================
// NavigationSystem — 航海計算
// ============================================================

import type { GameSystem } from '@/game/GameLoop.ts'
import { NAVIGATION_CONFIG, TIME_CONFIG } from '@/config/gameConfig.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { getDistanceKm } from '@/game/world/queries.ts'

function getCrewPerformance(activeCrew: number, requiredCrew: number): number {
  if (requiredCrew <= 0) return 1
  return Math.max(0, Math.min(1.1, activeCrew / requiredCrew))
}

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

export class NavigationSystem implements GameSystem {
  name = 'NavigationSystem'
  priority = 10

  update(deltaTime: number): void {
    const navigationStore = useNavigationStore.getState()
    const playerStore = usePlayerStore.getState()
    const { paused, speed } = useGameStore.getState()

    if (paused || navigationStore.mode === 'combat' || !navigationStore.destination) {
      if (navigationStore.currentSpeed !== 0) navigationStore.setSpeed(0)
      return
    }

    const activeShip = playerStore.ships.find((ship) => ship.instanceId === playerStore.activeShipId)
    const shipType = activeShip ? useDataStore.getState().getShip(activeShip.typeId) : undefined

    const baseSpeed = shipType?.speed ?? 8
    const minimumCrew = shipType?.crew.min ?? 1
    const crewPerformance = getCrewPerformance(activeShip?.currentCrew ?? minimumCrew, minimumCrew)
    const crewSpeedFactor = crewPerformance < 1
      ? NAVIGATION_CONFIG.LOW_CREW_SPEED_FACTOR + (1 - NAVIGATION_CONFIG.LOW_CREW_SPEED_FACTOR) * crewPerformance
      : 1
    const crewTurnFactor = crewPerformance < 1
      ? NAVIGATION_CONFIG.LOW_CREW_TURN_FACTOR + (1 - NAVIGATION_CONFIG.LOW_CREW_TURN_FACTOR) * crewPerformance
      : 1

    if (crewPerformance < NAVIGATION_CONFIG.MINIMUM_MOVABLE_CREW_FACTOR) {
      navigationStore.setSpeed(0)
      return
    }

    const moraleFactor = getMoralePerformance(activeShip?.morale ?? 70)
    const turnRate = (shipType?.turnRate ?? NAVIGATION_CONFIG.BASE_TURN_RATE) * crewTurnFactor * moraleFactor.turn
    const dx = navigationStore.destination.x - navigationStore.position.x
    const dy = navigationStore.destination.y - navigationStore.position.y
    const targetHeading = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360
    const headingDiff = ((targetHeading - navigationStore.heading + 540) % 360) - 180
    const maxTurn = turnRate * deltaTime
    const newHeading = Math.abs(headingDiff) <= maxTurn
      ? targetHeading
      : navigationStore.heading + Math.sign(headingDiff) * maxTurn

    navigationStore.setHeading((newHeading + 360) % 360)

    const headingRad = (newHeading * Math.PI) / 180
    const windRad = (navigationStore.wind.direction * Math.PI) / 180
    const relativeWind = Math.cos(windRad - headingRad)
    const windBonus = relativeWind * navigationStore.wind.speed * NAVIGATION_CONFIG.WIND_EFFECT_FACTOR * 0.12
    const effectiveSpeed = Math.min(
      NAVIGATION_CONFIG.MAX_SPEED,
      Math.max(1.2, (baseSpeed + windBonus) * crewSpeedFactor * moraleFactor.speed),
    )

    navigationStore.setSpeed(effectiveSpeed)

    const hoursPerRealSecond = (24 / TIME_CONFIG.REAL_SECONDS_PER_GAME_DAY) * speed
    const stepKm = effectiveSpeed * 1.852 * hoursPerRealSecond * deltaTime
    const distanceToTarget = getDistanceKm(navigationStore.position, navigationStore.destination)

    if (distanceToTarget <= stepKm || distanceToTarget < 0.25) {
      const ports = useDataStore.getState().masterData.ports
      const arrivedPort = ports.find((port) => port.name === navigationStore.destinationName)

      navigationStore.setPosition(navigationStore.destination)
      navigationStore.setDestination(null)
      navigationStore.setSpeed(0)
      navigationStore.setMode('docked')
      navigationStore.resetVoyage()
      navigationStore.setDockedPort(arrivedPort?.id ?? null)

      playerStore.setPosition(navigationStore.destination)
      playerStore.updatePlayer({ currentPortId: arrivedPort?.id })
      return
    }

    const nx = dx / distanceToTarget
    const ny = dy / distanceToTarget
    const nextPosition = {
      x: navigationStore.position.x + nx * stepKm,
      y: navigationStore.position.y + ny * stepKm,
    }

    navigationStore.setMode('sailing')
    navigationStore.setDockedPort(null)
    navigationStore.setPosition(nextPosition)
    navigationStore.addDistance(stepKm)
    playerStore.setPosition(nextPosition)
    playerStore.setHeading((newHeading + 360) % 360)
    playerStore.updatePlayer({ currentPortId: undefined })
  }
}

