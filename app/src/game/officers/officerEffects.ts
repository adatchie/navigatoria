import type { Officer } from '@/types/character.ts'
import type { OfficerRoleSlot, ShipInstance, ShipOfficerAssignments } from '@/types/ship.ts'

export interface OfficerShipEffects {
  speedFactor: number
  turnFactor: number
  cargoFactor: number
  gunneryFactor: number
  repairFactor: number
  moraleLossFactor: number
  tradePriceFactor: number
}

export interface OfficerRoleDefinition {
  id: OfficerRoleSlot
  label: string
  shortLabel: string
  description: string
  effectSummary: string
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

export const OFFICER_ROLE_DEFINITIONS: OfficerRoleDefinition[] = [
  {
    id: 'navigator',
    label: '航海長',
    shortLabel: '航海',
    description: '帆走と操船を補佐します。',
    effectSummary: '速力・旋回',
  },
  {
    id: 'quartermaster',
    label: '主計長',
    shortLabel: '主計',
    description: '積荷と売買の計算を補佐します。',
    effectSummary: '売買価格・積載補助',
  },
  {
    id: 'gunner',
    label: '砲術長',
    shortLabel: '砲術',
    description: '砲列運用を補佐します。',
    effectSummary: '砲門・砲撃補助',
  },
  {
    id: 'shipwright',
    label: '船大工',
    shortLabel: '修理',
    description: '船体の補修を補佐します。',
    effectSummary: '修理効率',
  },
  {
    id: 'firstMate',
    label: '副官',
    shortLabel: '統率',
    description: '船内規律と士気を補佐します。',
    effectSummary: '士気低下軽減',
  },
]

const ROLE_LABELS: Record<OfficerRoleSlot, string> = {
  captain: '船長',
  navigator: '航海長',
  quartermaster: '主計長',
  gunner: '砲術長',
  shipwright: '船大工',
  firstMate: '副官',
}

function multiplyEffects(base: OfficerShipEffects, patch: Partial<OfficerShipEffects>): OfficerShipEffects {
  return {
    speedFactor: base.speedFactor * (patch.speedFactor ?? 1),
    turnFactor: base.turnFactor * (patch.turnFactor ?? 1),
    cargoFactor: base.cargoFactor * (patch.cargoFactor ?? 1),
    gunneryFactor: base.gunneryFactor * (patch.gunneryFactor ?? 1),
    repairFactor: base.repairFactor * (patch.repairFactor ?? 1),
    moraleLossFactor: base.moraleLossFactor * (patch.moraleLossFactor ?? 1),
    tradePriceFactor: base.tradePriceFactor * (patch.tradePriceFactor ?? 1),
  }
}

export function getShipOfficerAssignments(ship: ShipInstance | undefined): ShipOfficerAssignments {
  if (!ship) return {}
  return {
    ...(ship.officerAssignments ?? {}),
    ...(ship.captainOfficerId ? { captain: ship.captainOfficerId } : {}),
  }
}

export function getAssignedOfficer(ship: ShipInstance | undefined, officers: Officer[]): Officer | undefined {
  return getAssignedOfficerForRole(ship, officers, 'captain')
}

export function getAssignedOfficerForRole(ship: ShipInstance | undefined, officers: Officer[], role: OfficerRoleSlot): Officer | undefined {
  const officerId = getShipOfficerAssignments(ship)[role]
  if (!officerId) return undefined
  return officers.find((officer) => officer.id === officerId)
}

export function getOfficerAssignmentLabel(officerId: string, ships: ShipInstance[]): string {
  for (const ship of ships) {
    const assignments = getShipOfficerAssignments(ship)
    for (const [role, assignedOfficerId] of Object.entries(assignments) as [OfficerRoleSlot, string][]) {
      if (assignedOfficerId === officerId) return `${ship.name} / ${ROLE_LABELS[role] ?? role}`
    }
  }
  return '未任命'
}

function getCaptainEffects(officer: Officer): OfficerShipEffects {
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

function getRoleEffects(role: OfficerRoleSlot, officer: Officer): Partial<OfficerShipEffects> {
  if (role === 'captain') return getCaptainEffects(officer)
  if (role === 'navigator') {
    return {
      speedFactor: 1 + officer.stats.navigation * 0.014,
      turnFactor: 1 + officer.stats.navigation * 0.018,
    }
  }
  if (role === 'quartermaster') {
    return {
      cargoFactor: 1 + officer.stats.trade * 0.012,
      tradePriceFactor: 1 + officer.stats.trade * 0.006,
    }
  }
  if (role === 'gunner') {
    return {
      gunneryFactor: 1 + officer.stats.gunnery * 0.03,
    }
  }
  if (role === 'shipwright') {
    return {
      repairFactor: 1 + officer.stats.repair * 0.024,
    }
  }
  return {
    moraleLossFactor: Math.max(0.66, 1 - officer.stats.leadership * 0.03),
  }
}

export function getOfficerShipEffects(ship: ShipInstance | undefined, officers: Officer[]): OfficerShipEffects {
  const assignments = getShipOfficerAssignments(ship)
  return (Object.entries(assignments) as [OfficerRoleSlot, string][]).reduce((effects, [role, officerId]) => {
    const officer = officers.find((entry) => entry.id === officerId)
    return officer ? multiplyEffects(effects, getRoleEffects(role, officer)) : effects
  }, BASE_EFFECTS)
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

export function formatOfficerRoleEffect(role: OfficerRoleSlot, officer: Officer): string {
  if (role === 'captain') {
    return `速力 +${(officer.stats.navigation * 1.2).toFixed(1)}% / 旋回 +${(officer.stats.navigation * 1.5).toFixed(1)}% / 売買 +${(officer.stats.trade * 0.4).toFixed(1)}%`
  }
  if (role === 'navigator') return `速力 +${(officer.stats.navigation * 1.4).toFixed(1)}% / 旋回 +${(officer.stats.navigation * 1.8).toFixed(1)}%`
  if (role === 'quartermaster') return `積載補助 +${(officer.stats.trade * 1.2).toFixed(1)}% / 売買 +${(officer.stats.trade * 0.6).toFixed(1)}%`
  if (role === 'gunner') return `砲術補助 +${(officer.stats.gunnery * 3).toFixed(1)}%`
  if (role === 'shipwright') return `修理効率 +${(officer.stats.repair * 2.4).toFixed(1)}%`
  return `士気低下 -${(Math.min(34, officer.stats.leadership * 3)).toFixed(1)}%`
}
