import { create } from 'zustand'
import type { EncounterAction, EncounterState, EncounterType } from '@/types/encounter.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'

interface EncounterResolution {
  ok: boolean
  message: string
}

interface EncounterStoreState {
  activeEncounter: EncounterState | null
  lastEncounterNotice: string | null
  lastEncounterAtDay: number
  triggerEncounter: (encounter: EncounterState) => boolean
  resolveEncounter: (action: EncounterAction) => EncounterResolution
  clearEncounterNotice: () => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getTypeBonus(type: EncounterType, action: EncounterAction): number {
  if (type === 'pirate' && action === 'engage') return -4
  if (type === 'pirate' && action === 'evade') return 6
  if (type === 'navy' && action === 'engage') return -2
  if (type === 'merchant' && action === 'ignore') return 6
  if (type === 'derelict' && action === 'engage') return 8
  return 0
}

export const useEncounterStore = create<EncounterStoreState>()((set, get) => ({
  activeEncounter: null,
  lastEncounterNotice: null,
  lastEncounterAtDay: -1,

  triggerEncounter: (encounter) => {
    if (get().activeEncounter) return false
    useNavigationStore.getState().setMode('combat')
    useNavigationStore.getState().setSpeed(0)
    set({ activeEncounter: encounter, lastEncounterAtDay: encounter.startedAtDay, lastEncounterNotice: `遭遇: ${encounter.title}` })
    return true
  },

  resolveEncounter: (action) => {
    const encounter = get().activeEncounter
    const playerStore = usePlayerStore.getState()
    const player = playerStore.player
    const activeShip = playerStore.ships.find((ship) => ship.instanceId === playerStore.activeShipId)
    if (!encounter || !player || !activeShip) return { ok: false, message: '遭遇情報を解決できません。' }

    const crewFactor = activeShip.currentCrew / Math.max(1, activeShip.maxCrew)
    const moraleFactor = (activeShip.morale ?? 60) / 100
    const stats = player.stats

    let score = 0
    if (action === 'engage') score = stats.combatLevel * 8 + crewFactor * 24 + moraleFactor * 18
    if (action === 'evade') score = stats.adventureLevel * 7 + crewFactor * 10 + moraleFactor * 16 + (activeShip.maxDurability - activeShip.currentDurability < 20 ? 4 : 0)
    if (action === 'ignore') score = stats.tradeLevel * 6 + moraleFactor * 10 + crewFactor * 8
    score += getTypeBonus(encounter.type, action)

    const threshold = encounter.threat * 10 + encounter.enemyCrew * 0.45 + encounter.enemyDurability * 0.08
    const successMargin = score - threshold
    const success = successMargin >= 0

    let message = ''
    let moneyDelta = 0
    let fameDelta = 0
    let tradeExpDelta = 0
    let combatExpDelta = 0
    let adventureExpDelta = 0
    let durabilityDelta = 0
    let crewDelta = 0
    let moraleDelta = 0

    if (action === 'engage') {
      if (success) {
        moneyDelta = encounter.type === 'derelict' ? 320 + encounter.threat * 60 : 220 + encounter.threat * 45
        fameDelta = encounter.type === 'pirate' ? 2 + Math.floor(encounter.threat / 2) : 1
        combatExpDelta = 8 + encounter.threat * 3
        durabilityDelta = -(2 + Math.max(0, Math.floor(encounter.threat / 3)))
        moraleDelta = 5
        message = `${encounter.title} を制して ${moneyDelta} d を得ました。`
      } else {
        durabilityDelta = -(8 + encounter.threat * 2)
        crewDelta = -Math.min(activeShip.currentCrew, 1 + Math.floor(encounter.threat / 2))
        moraleDelta = -8
        combatExpDelta = 3 + encounter.threat
        message = `${encounter.title} との交戦で損害を受けました。`
      }
    }

    if (action === 'evade') {
      if (success) {
        adventureExpDelta = 6 + encounter.threat * 2
        moraleDelta = -1
        message = `${encounter.title} を振り切りました。`
      } else {
        durabilityDelta = -(5 + encounter.threat)
        crewDelta = encounter.type === 'pirate' ? -1 : 0
        moraleDelta = -5
        adventureExpDelta = 3 + encounter.threat
        message = `${encounter.title} からの離脱に手間取り、損傷が出ました。`
      }
    }

    if (action === 'ignore') {
      if (success) {
        tradeExpDelta = 4 + encounter.threat
        moraleDelta = encounter.type === 'merchant' ? 2 : 0
        message = `${encounter.title} をやり過ごしました。`
      } else {
        if (encounter.type === 'merchant') {
          moneyDelta = -Math.min(player.money, 120 + encounter.threat * 30)
          tradeExpDelta = 2
          moraleDelta = -3
          message = `${encounter.title} に足止めされ、出費が発生しました。`
        } else {
          durabilityDelta = -(4 + encounter.threat)
          moraleDelta = -4
          message = `${encounter.title} を無視した結果、小さな損害が出ました。`
        }
      }
    }

    usePlayerStore.setState((state) => {
      if (!state.player) return state
      return {
        player: {
          ...state.player,
          money: Math.max(0, state.player.money + moneyDelta),
          stats: {
            ...state.player.stats,
            fame: Math.max(0, state.player.stats.fame + fameDelta),
            tradeExp: state.player.stats.tradeExp + tradeExpDelta,
            combatExp: state.player.stats.combatExp + combatExpDelta,
            adventureExp: state.player.stats.adventureExp + adventureExpDelta,
          },
        },
        ships: state.ships.map((ship) => ship.instanceId !== state.activeShipId ? ship : {
          ...ship,
          currentDurability: clamp(ship.currentDurability + durabilityDelta, 1, ship.maxDurability),
          currentCrew: clamp(ship.currentCrew + crewDelta, 0, ship.maxCrew),
          morale: clamp((ship.morale ?? 60) + moraleDelta, 0, 100),
        }),
      }
    })

    const navigation = useNavigationStore.getState()
    navigation.setMode(navigation.destination ? 'sailing' : 'anchored')
    navigation.setSpeed(0)

    set({ activeEncounter: null, lastEncounterNotice: message })
    return { ok: true, message }
  },

  clearEncounterNotice: () => set({ lastEncounterNotice: null }),
}))
