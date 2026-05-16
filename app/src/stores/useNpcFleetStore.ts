import { create } from 'zustand'
import type { NpcFleetDefinition } from '@/types/npcFleet.ts'

interface NpcFleetStoreState {
  pendingAttackFleetId: string | null
  defeatedFleetCooldowns: Record<string, number>
  questFleets: Record<string, NpcFleetDefinition>

  requestAttack: (fleetId: string) => void
  cancelAttack: () => void
  activateQuestFleet: (fleet: NpcFleetDefinition) => void
  removeQuestFleet: (fleetId: string) => void
  suppressFleet: (fleetId: string, untilDay: number) => void
  clearExpiredSuppressions: (currentDay: number) => void
}

export const useNpcFleetStore = create<NpcFleetStoreState>()((set) => ({
  pendingAttackFleetId: null,
  defeatedFleetCooldowns: {},
  questFleets: {},

  requestAttack: (pendingAttackFleetId) => set({ pendingAttackFleetId }),
  cancelAttack: () => set({ pendingAttackFleetId: null }),

  activateQuestFleet: (fleet) =>
    set((state) => ({
      questFleets: { ...state.questFleets, [fleet.id]: fleet },
      defeatedFleetCooldowns: Object.fromEntries(
        Object.entries(state.defeatedFleetCooldowns).filter(([fleetId]) => fleetId !== fleet.id),
      ),
    })),

  removeQuestFleet: (fleetId) =>
    set((state) => {
      const questFleets = { ...state.questFleets }
      delete questFleets[fleetId]
      return { questFleets }
    }),

  suppressFleet: (fleetId, untilDay) =>
    set((state) => ({
      defeatedFleetCooldowns: {
        ...state.defeatedFleetCooldowns,
        [fleetId]: Math.max(untilDay, state.defeatedFleetCooldowns[fleetId] ?? 0),
      },
    })),

  clearExpiredSuppressions: (currentDay) =>
    set((state) => ({
      defeatedFleetCooldowns: Object.fromEntries(
        Object.entries(state.defeatedFleetCooldowns).filter(([, untilDay]) => currentDay < untilDay),
      ),
    })),
}))
