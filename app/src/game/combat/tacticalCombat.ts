import type { EncounterState } from '@/types/encounter.ts'
import type { Position2D } from '@/types/common.ts'
import type { ShipInstance, ShipType } from '@/types/ship.ts'
import type { TacticalBattleState, TacticalShipOrder, TacticalShipState, TacticalWindState } from '@/types/tacticalCombat.ts'

const PLAYER_START_X = 22
const ENEMY_START_X = 78
const BATTLEFIELD_HEIGHT = 100

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getFormationY(index: number, total: number): number {
  const spacing = total >= 4 ? 10 : 14
  return 50 + (index - (total - 1) / 2) * spacing
}

export function estimateMovementRange(ship: TacticalShipState, wind: TacticalWindState): number {
  const windAssist = Math.cos(((wind.direction - ship.heading) * Math.PI) / 180)
  const windFactor = clamp(1 + windAssist * 0.18 + wind.speed / 160, 0.55, 1.35)
  return clamp(ship.speed * 2.4 * windFactor + ship.turnRate * 0.05, 12, 34)
}

export function getHeadingToPosition(from: Position2D, to: Position2D): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360
}

export function getSignedHeadingDelta(current: number, target: number): number {
  return ((((target - current) % 360) + 540) % 360) - 180
}

export function getHeadingDelta(current: number, target: number): number {
  return Math.abs(getSignedHeadingDelta(current, target))
}

export function estimateDirectionalMovementRange(ship: TacticalShipState, wind: TacticalWindState, targetPosition: Position2D): number {
  const baseRange = estimateMovementRange(ship, wind)
  const targetHeading = getHeadingToPosition(ship.position, targetPosition)
  const headingDelta = getHeadingDelta(ship.heading, targetHeading)
  const turnAllowance = clamp(ship.turnRate / 90, 0.25, 1)
  const sidePenalty = clamp(1 - Math.max(0, headingDelta - 35) / 180, 0.28, 1)
  const turnFactor = clamp(sidePenalty + turnAllowance * 0.22, 0.32, 1)
  return baseRange * turnFactor
}

export function buildPredictedCourse(
  ship: TacticalShipState,
  targetPosition: Position2D,
  wind: TacticalWindState,
  steps = 18,
): Position2D[] {
  const distance = Math.max(0.001, Math.hypot(targetPosition.x - ship.position.x, targetPosition.y - ship.position.y))
  const targetHeading = getHeadingToPosition(ship.position, targetPosition)
  const signedTurn = getSignedHeadingDelta(ship.heading, targetHeading)
  const headingRad = (ship.heading * Math.PI) / 180
  const windBlowRad = (((wind.direction + 180) % 360) * Math.PI) / 180
  const forward = { x: Math.sin(headingRad), y: Math.cos(headingRad) }
  const windVector = { x: Math.sin(windBlowRad), y: Math.cos(windBlowRad) }

  const turnDifficulty = clamp(Math.abs(signedTurn) / Math.max(18, ship.turnRate), 0.15, 2.6)
  const speedCarry = clamp(ship.speed / 8, 0.45, 1.9)
  const windDrift = clamp(wind.speed / 40, 0, 1.4)
  const curveSign = signedTurn === 0 ? 1 : Math.sign(signedTurn)
  const sideVector = { x: forward.y * curveSign, y: -forward.x * curveSign }

  const firstControlDistance = distance * clamp(0.22 + speedCarry * 0.22 + turnDifficulty * 0.08, 0.28, 0.68)
  const secondControlPull = distance * clamp(0.18 + turnDifficulty * 0.12, 0.22, 0.62)
  const bend = distance * clamp(0.08 + turnDifficulty * 0.14 + speedCarry * 0.05, 0.1, 0.42)
  const drift = distance * windDrift * 0.18

  const controlA: Position2D = {
    x: ship.position.x + forward.x * firstControlDistance + sideVector.x * bend + windVector.x * drift,
    y: ship.position.y + forward.y * firstControlDistance + sideVector.y * bend + windVector.y * drift,
  }
  const controlB: Position2D = {
    x: targetPosition.x - Math.sin((targetHeading * Math.PI) / 180) * secondControlPull + windVector.x * drift * 0.45,
    y: targetPosition.y - Math.cos((targetHeading * Math.PI) / 180) * secondControlPull + windVector.y * drift * 0.45,
  }

  const points: Position2D[] = []
  const count = Math.max(4, steps)
  for (let index = 0; index <= count; index += 1) {
    const t = index / count
    const inverse = 1 - t
    points.push({
      x:
        inverse ** 3 * ship.position.x +
        3 * inverse ** 2 * t * controlA.x +
        3 * inverse * t ** 2 * controlB.x +
        t ** 3 * targetPosition.x,
      y:
        inverse ** 3 * ship.position.y +
        3 * inverse ** 2 * t * controlA.y +
        3 * inverse * t ** 2 * controlB.y +
        t ** 3 * targetPosition.y,
    })
  }

  return points
}

export function createTargetOrder(shipId: string, targetPosition: Position2D): TacticalShipOrder {
  return {
    shipId,
    type: 'move',
    targetPosition,
    confirmed: false,
  }
}

export function confirmOrder(order: TacticalShipOrder): TacticalShipOrder {
  return { ...order, confirmed: true }
}

export function buildInitialTacticalBattle(params: {
  encounter: EncounterState
  playerShips: ShipInstance[]
  getShipType: (typeId: string) => ShipType | undefined
  wind: TacticalWindState
}): TacticalBattleState {
  const playerShips = params.playerShips.slice(0, 5).map((ship, index, list): TacticalShipState => {
    const shipType = params.getShipType(ship.typeId)
    return {
      id: ship.instanceId,
      side: 'player',
      name: ship.name,
      position: { x: PLAYER_START_X, y: getFormationY(index, list.length) },
      heading: 90,
      durability: ship.currentDurability,
      maxDurability: ship.maxDurability,
      crew: ship.currentCrew,
      maxCrew: ship.maxCrew,
      speed: shipType?.speed ?? 7,
      turnRate: shipType?.turnRate ?? 45,
      cannonSlots: shipType?.cannonSlots ?? 2,
      status: ship.currentDurability <= 0 ? 'sunk' : ship.currentCrew <= 0 ? 'disabled' : 'active',
    }
  })

  const enemyShip: TacticalShipState = {
    id: params.encounter.id + ':enemy-1',
    side: 'enemy',
    name: params.encounter.shipName,
    position: { x: ENEMY_START_X, y: 50 },
    heading: 270,
    durability: params.encounter.enemyDurability,
    maxDurability: params.encounter.enemyDurability,
    crew: params.encounter.enemyCrew,
    maxCrew: params.encounter.enemyCrew,
    speed: params.encounter.enemySpeed,
    turnRate: params.encounter.enemyTurnRate,
    cannonSlots: params.encounter.enemyCannonSlots,
    status: 'active',
  }

  return {
    phase: 'player_targeting',
    turn: 1,
    elapsedSeconds: 0,
    wind: params.wind,
    ships: [...playerShips, enemyShip],
    orders: [],
  }
}

export function isPositionInMovementRange(ship: TacticalShipState, wind: TacticalWindState, position: Position2D): boolean {
  const dx = position.x - ship.position.x
  const dy = position.y - ship.position.y
  const distance = Math.hypot(dx, dy)
  return distance <= estimateDirectionalMovementRange(ship, wind, position)
}

export const BATTLEFIELD_BOUNDS = {
  minX: 4,
  maxX: 96,
  minY: 10,
  maxY: BATTLEFIELD_HEIGHT - 10,
}
