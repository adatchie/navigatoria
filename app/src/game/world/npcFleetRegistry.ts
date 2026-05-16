import { NPC_FLEETS } from '@/data/master/npcFleets.ts'
import { useNpcFleetStore } from '@/stores/useNpcFleetStore.ts'
import type { PortId } from '@/types/common.ts'
import type { NpcFleetDefinition } from '@/types/npcFleet.ts'

export function getNpcFleetAppearancePortId(fleet: NpcFleetDefinition): PortId | undefined {
  return fleet.appearancePortId ?? fleet.routePortIds[0]
}

export function getNpcFleetPatrolPortId(fleet: NpcFleetDefinition): PortId | undefined {
  return fleet.patrolPortId ?? fleet.routePortIds[1]
}

export function getAllNpcFleetDefinitions(): NpcFleetDefinition[] {
  return [...NPC_FLEETS, ...Object.values(useNpcFleetStore.getState().questFleets)]
}

export function findNpcFleetDefinition(fleetId: string): NpcFleetDefinition | undefined {
  return getAllNpcFleetDefinitions().find((fleet) => fleet.id === fleetId)
}

export function isNpcFleetSuppressed(fleetId: string, totalDays: number): boolean {
  const untilDay = useNpcFleetStore.getState().defeatedFleetCooldowns[fleetId]
  return untilDay != null && totalDays < untilDay
}

export function getActiveNpcFleetDefinitions(totalDays: number): NpcFleetDefinition[] {
  return getAllNpcFleetDefinitions().filter((fleet) => !isNpcFleetSuppressed(fleet.id, totalDays))
}
