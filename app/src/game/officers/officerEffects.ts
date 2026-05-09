import type { Officer } from '@/types/character.ts'
import type { ShipInstance } from '@/types/ship.ts'

export interface OfficerShipEffects {
  speedFactor: number
  turnFactor: number
  cargoFactor: number
  gunneryFactor: number
  repairFactor: number
  moraleLossFactor: number
  tradePriceFactor: number
}

const BASE_EFFECTS: OfficerShipEffects = {
  speedFactor: 1,
  turnFactor: 1,
  cargoFactor: 1,
  gunneryFactor: 1,
  repairFactor: 1,
  moraleLossFactor: 1,
  tradePriceFactor: 1,
}

export function getAssignedOfficer(ship: ShipInstance | undefined, officers: Officer[]): Officer | undefined {
  if (!ship?.captainOfficerId) return undefined
  return officers.find((officer) => officer.id === ship.captainOfficerId)
}

export function getOfficerShipEffects(ship: ShipInstance | undefined, officers: Officer[]): OfficerShipEffects {
  const officer = getAssignedOfficer(ship, officers)
  if (!officer) return BASE_EFFECTS

  return {
    speedFactor: 1 + officer.stats.navigation * 0.012,
    turnFactor: 1 + officer.stats.navigation * 0.015,
    cargoFactor: 1 + officer.stats.trade * 0.01,
    gunneryFactor: 1 + officer.stats.gunnery * 0.025,
    repairFactor: 1 + officer.stats.repair * 0.018,
    moraleLossFactor: Math.max(0.72, 1 - officer.stats.leadership * 0.025),
    tradePriceFactor: 1 + officer.stats.trade * 0.004,
  }
}

export function getFleetOfficerEffects(ships: ShipInstance[], officers: Officer[]): OfficerShipEffects {
  const assignedShips = ships.filter((ship) => getAssignedOfficer(ship, officers))
  if (assignedShips.length === 0) return BASE_EFFECTS

  const total = assignedShips.reduce(
    (sum, ship) => {
      const effects = getOfficerShipEffects(ship, officers)
      return {
        speedFactor: sum.speedFactor + (effects.speedFactor - 1),
        turnFactor: sum.turnFactor + (effects.turnFactor - 1),
        cargoFactor: sum.cargoFactor + (effects.cargoFactor - 1),
        gunneryFactor: sum.gunneryFactor + (effects.gunneryFactor - 1),
        repairFactor: sum.repairFactor + (effects.repairFactor - 1),
        moraleLossFactor: sum.moraleLossFactor + (1 - effects.moraleLossFactor),
        tradePriceFactor: sum.tradePriceFactor + (effects.tradePriceFactor - 1),
      }
    },
    {
      speedFactor: 0,
      turnFactor: 0,
      cargoFactor: 0,
      gunneryFactor: 0,
      repairFactor: 0,
      moraleLossFactor: 0,
      tradePriceFactor: 0,
    },
  )
  const divisor = Math.max(1, ships.length)

  return {
    speedFactor: 1 + total.speedFactor / divisor,
    turnFactor: 1 + total.turnFactor / divisor,
    cargoFactor: 1 + total.cargoFactor / divisor,
    gunneryFactor: 1 + total.gunneryFactor / divisor,
    repairFactor: 1 + total.repairFactor / divisor,
    moraleLossFactor: Math.max(0.82, 1 - total.moraleLossFactor / divisor),
    tradePriceFactor: 1 + total.tradePriceFactor / divisor,
  }
}

export function formatOfficerStats(officer: Officer): string {
  const stats = officer.stats
  return `航海 ${stats.navigation} / 交易 ${stats.trade} / 砲術 ${stats.gunnery} / 修理 ${stats.repair} / 統率 ${stats.leadership}`
}
