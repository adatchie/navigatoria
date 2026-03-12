import { create } from 'zustand'
import type {
  CombatAction,
  CombatDistance,
  EncounterAction,
  EncounterCombatState,
  EncounterOutcome,
  EncounterState,
  EncounterType,
} from '@/types/encounter.ts'
import { COMBAT_CONFIG } from '@/config/gameConfig.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'

interface EncounterResolution {
  ok: boolean
  message: string
}

interface EncounterStoreState {
  activeEncounter: EncounterState | null
  combatState: EncounterCombatState | null
  lastEncounterNotice: string | null
  lastEncounterAtDay: number
  triggerEncounter: (encounter: EncounterState) => boolean
  resolveEncounter: (action: EncounterAction) => EncounterResolution
  startCombat: () => EncounterResolution
  performCombatAction: (action: CombatAction) => EncounterResolution
  closeEncounter: () => void
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

function resolveNavigationMode(): 'sailing' | 'anchored' {
  return useNavigationStore.getState().destination ? 'sailing' : 'anchored'
}

function applyEncounterOutcome(outcome: EncounterOutcome, combatState?: EncounterCombatState): void {
  usePlayerStore.setState((state) => {
    if (!state.player) return state

    const ships = state.ships.map((ship) => {
      if (ship.instanceId !== state.activeShipId) return ship
      if (!combatState) return ship

      return {
        ...ship,
        currentDurability: clamp(combatState.playerDurability, 1, ship.maxDurability),
        currentCrew: clamp(combatState.playerCrew, 0, ship.maxCrew),
        morale: clamp(combatState.playerMorale, 0, 100),
      }
    })

    return {
      player: {
        ...state.player,
        money: Math.max(0, state.player.money + outcome.moneyDelta),
        stats: {
          ...state.player.stats,
          fame: Math.max(0, state.player.stats.fame + outcome.fameDelta),
          notoriety: Math.max(0, state.player.stats.notoriety + outcome.notorietyDelta),
          tradeExp: state.player.stats.tradeExp + outcome.tradeExpDelta,
          combatExp: state.player.stats.combatExp + outcome.combatExpDelta,
          adventureExp: state.player.stats.adventureExp + outcome.adventureExpDelta,
        },
      },
      ships,
    }
  })
}

function resolveImmediateOutcome(encounter: EncounterState, action: EncounterAction): EncounterOutcome {
  const playerStore = usePlayerStore.getState()
  const player = playerStore.player
  const activeShip = playerStore.ships.find((ship) => ship.instanceId === playerStore.activeShipId)
  if (!player || !activeShip) {
    return {
      message: '遭遇情報を解決できません。',
      moneyDelta: 0,
      fameDelta: 0,
      tradeExpDelta: 0,
      combatExpDelta: 0,
      adventureExpDelta: 0,
      notorietyDelta: 0,
    }
  }

  const crewFactor = activeShip.currentCrew / Math.max(1, activeShip.maxCrew)
  const moraleFactor = (activeShip.morale ?? 60) / 100
  const stats = player.stats

  let score = 0
  if (action === 'engage') score = stats.combatLevel * 8 + crewFactor * 24 + moraleFactor * 18
  if (action === 'evade') score = stats.adventureLevel * 7 + crewFactor * 10 + moraleFactor * 16 + (activeShip.maxDurability - activeShip.currentDurability < 20 ? 4 : 0)
  if (action === 'ignore') score = stats.tradeLevel * 6 + moraleFactor * 10 + crewFactor * 8
  score += getTypeBonus(encounter.type, action)

  const threshold = encounter.threat * 10 + encounter.enemyCrew * 0.45 + encounter.enemyDurability * 0.08
  const success = score - threshold >= 0

  let message = ''
  let moneyDelta = 0
  const fameDelta = 0
  let tradeExpDelta = 0
  const combatExpDelta = 0
  let adventureExpDelta = 0
  const notorietyDelta = 0

  if (action === 'evade') {
    if (success) {
      adventureExpDelta = 6 + encounter.threat * 2
      message = `${encounter.title} を振り切りました。`
    } else {
      const combatState: EncounterCombatState = {
        phase: 'resolved',
        round: 0,
        distance: 'long',
        playerStartDurability: activeShip.currentDurability,
        playerStartCrew: activeShip.currentCrew,
        playerStartMorale: activeShip.morale ?? 60,
        playerDurability: clamp(activeShip.currentDurability - (5 + encounter.threat), 1, activeShip.maxDurability),
        playerMaxDurability: activeShip.maxDurability,
        playerCrew: clamp(activeShip.currentCrew - (encounter.type === 'pirate' ? 1 : 0), 0, activeShip.maxCrew),
        playerMaxCrew: activeShip.maxCrew,
        playerMorale: clamp((activeShip.morale ?? 60) - 5, 0, 100),
        enemyDurability: encounter.enemyDurability,
        enemyMaxDurability: encounter.enemyDurability,
        enemyCrew: encounter.enemyCrew,
        enemyMaxCrew: encounter.enemyCrew,
        log: [],
      }
      applyEncounterOutcome({ message: `${encounter.title} からの離脱に手間取り、損傷が出ました。`, moneyDelta: 0, fameDelta: 0, tradeExpDelta: 0, combatExpDelta: 0, adventureExpDelta: 3 + encounter.threat, notorietyDelta: 0 }, combatState)
      return { message: `${encounter.title} からの離脱に手間取り、損傷が出ました。`, moneyDelta: 0, fameDelta: 0, tradeExpDelta: 0, combatExpDelta: 0, adventureExpDelta: 3 + encounter.threat, notorietyDelta: 0 }
    }
  }

  if (action === 'ignore') {
    if (success) {
      tradeExpDelta = 4 + encounter.threat
      message = `${encounter.title} をやり過ごしました。`
    } else if (encounter.type === 'merchant') {
      moneyDelta = -Math.min(player.money, 120 + encounter.threat * 30)
      tradeExpDelta = 2
      message = `${encounter.title} に足止めされ、出費が発生しました。`
    } else {
      const combatState: EncounterCombatState = {
        phase: 'resolved',
        round: 0,
        distance: 'long',
        playerStartDurability: activeShip.currentDurability,
        playerStartCrew: activeShip.currentCrew,
        playerStartMorale: activeShip.morale ?? 60,
        playerDurability: clamp(activeShip.currentDurability - (4 + encounter.threat), 1, activeShip.maxDurability),
        playerMaxDurability: activeShip.maxDurability,
        playerCrew: activeShip.currentCrew,
        playerMaxCrew: activeShip.maxCrew,
        playerMorale: clamp((activeShip.morale ?? 60) - 4, 0, 100),
        enemyDurability: encounter.enemyDurability,
        enemyMaxDurability: encounter.enemyDurability,
        enemyCrew: encounter.enemyCrew,
        enemyMaxCrew: encounter.enemyCrew,
        log: [],
      }
      applyEncounterOutcome({ message: `${encounter.title} を無視した結果、小さな損害が出ました。`, moneyDelta: 0, fameDelta: 0, tradeExpDelta: 0, combatExpDelta: 0, adventureExpDelta: 0, notorietyDelta: 0 }, combatState)
      return { message: `${encounter.title} を無視した結果、小さな損害が出ました。`, moneyDelta: 0, fameDelta: 0, tradeExpDelta: 0, combatExpDelta: 0, adventureExpDelta: 0, notorietyDelta: 0 }
    }
  }

  return {
    message,
    moneyDelta,
    fameDelta,
    tradeExpDelta,
    combatExpDelta,
    adventureExpDelta,
    notorietyDelta,
  }
}

function createCombatState(encounter: EncounterState): EncounterCombatState | null {
  const playerStore = usePlayerStore.getState()
  const player = playerStore.player
  const activeShip = playerStore.ships.find((ship) => ship.instanceId === playerStore.activeShipId)
  if (!player || !activeShip) return null

  return {
    phase: 'battle',
    round: 0,
    distance: 'long',
    playerStartDurability: activeShip.currentDurability,
    playerStartCrew: activeShip.currentCrew,
    playerStartMorale: activeShip.morale ?? 60,
    playerDurability: activeShip.currentDurability,
    playerMaxDurability: activeShip.maxDurability,
    playerCrew: activeShip.currentCrew,
    playerMaxCrew: activeShip.maxCrew,
    playerMorale: activeShip.morale ?? 60,
    enemyDurability: encounter.enemyDurability,
    enemyMaxDurability: encounter.enemyDurability,
    enemyCrew: encounter.enemyCrew,
    enemyMaxCrew: encounter.enemyCrew,
    log: [],
  }
}

function getDistanceFactor(distance: CombatDistance, action: CombatAction): number {
  if (action === 'cannon') {
    if (distance === 'long') return 1
    if (distance === 'close') return 0.82
    return 0.45
  }

  if (action === 'board') {
    if (distance === 'long') return 0.4
    if (distance === 'close') return 0.92
    return 1.08
  }

  return distance === 'boarded' ? 0.65 : 1
}

function getEnemyAggression(type: EncounterType): number {
  if (type === 'pirate') return 1.18
  if (type === 'navy') return 1.05
  if (type === 'merchant') return 0.78
  return 0.52
}

function buildVictoryOutcome(encounter: EncounterState, state: EncounterCombatState): EncounterOutcome {
  const player = usePlayerStore.getState().player
  const combatLevel = player?.stats.combatLevel ?? 1
  const rewardBase = encounter.type === 'derelict' ? 340 : 240
  const moneyDelta = rewardBase + encounter.threat * 55 + state.round * 18
  const fameDelta = encounter.type === 'pirate' ? 2 + Math.floor(encounter.threat / 2) : encounter.type === 'navy' ? 1 : 0
  const notorietyDelta = encounter.type === 'merchant' ? 2 : encounter.type === 'navy' ? 3 : 0

  return {
    message: `${encounter.title} に勝利しました。${moneyDelta} d を獲得しました。`,
    moneyDelta,
    fameDelta,
    tradeExpDelta: encounter.type === 'merchant' ? 2 + encounter.threat : 0,
    combatExpDelta: 10 + encounter.threat * 4 + combatLevel,
    adventureExpDelta: encounter.type === 'derelict' ? 4 + encounter.threat : 0,
    notorietyDelta,
  }
}

function buildDefeatOutcome(encounter: EncounterState): EncounterOutcome {
  const player = usePlayerStore.getState().player
  const moneyLoss = Math.min(player?.money ?? 0, 150 + encounter.threat * 45)
  return {
    message: `${encounter.title} に押し切られ、撤退しました。`,
    moneyDelta: -moneyLoss,
    fameDelta: 0,
    tradeExpDelta: 0,
    combatExpDelta: 4 + encounter.threat,
    adventureExpDelta: 0,
    notorietyDelta: encounter.type === 'navy' ? 1 : 0,
  }
}

function buildWithdrawalOutcome(encounter: EncounterState, success: boolean): EncounterOutcome {
  return success
    ? {
        message: `${encounter.title} から距離を取り、戦闘海域を離脱しました。`,
        moneyDelta: 0,
        fameDelta: 0,
        tradeExpDelta: 0,
        combatExpDelta: 0,
        adventureExpDelta: 6 + encounter.threat * 2,
        notorietyDelta: 0,
      }
    : {
        message: `${encounter.title} の追撃を受けつつ、辛うじて離脱しました。`,
        moneyDelta: 0,
        fameDelta: 0,
        tradeExpDelta: 0,
        combatExpDelta: 2 + encounter.threat,
        adventureExpDelta: 3 + encounter.threat,
        notorietyDelta: 0,
      }
}

function performCombatRound(encounter: EncounterState, state: EncounterCombatState, action: CombatAction): EncounterCombatState {
  const playerStore = usePlayerStore.getState()
  const player = playerStore.player
  const activeShip = playerStore.ships.find((ship) => ship.instanceId === playerStore.activeShipId)
  const shipType = activeShip ? useDataStore.getState().getShip(activeShip.typeId) : undefined
  if (!player || !activeShip) return state

  const stats = player.stats
  const round = state.round + 1
  const crewRatio = state.playerCrew / Math.max(1, state.playerMaxCrew)
  const moraleRatio = state.playerMorale / 100
  const enemyCrewRatio = state.enemyCrew / Math.max(1, state.enemyMaxCrew)
  const cannonSlots = shipType?.cannonSlots ?? 2
  const shipSpeed = shipType?.speed ?? 8
  const shipTurn = shipType?.turnRate ?? 40

  let distance = state.distance
  let playerDamage = 0
  let enemyDamage = 0
  let playerCrewLoss = 0
  let enemyCrewLoss = 0
  let playerMorale = state.playerMorale
  let outcome: EncounterOutcome | undefined

  const cannonPower = COMBAT_CONFIG.BASE_CANNON_DAMAGE + cannonSlots * 2.2 + stats.combatLevel * 3.4 + moraleRatio * 8 + crewRatio * 10
  const meleePower = COMBAT_CONFIG.BASE_MELEE_DAMAGE + stats.combatLevel * 2.8 + crewRatio * 16 + moraleRatio * 9
  const enemyCannonPower = COMBAT_CONFIG.BASE_CANNON_DAMAGE + encounter.threat * 4.2 + enemyCrewRatio * 8 * getEnemyAggression(encounter.type)
  const enemyMeleePower = COMBAT_CONFIG.BASE_MELEE_DAMAGE + encounter.threat * 3.6 + enemyCrewRatio * 14 * getEnemyAggression(encounter.type)

  if (action === 'withdraw') {
    const escapeScore = stats.adventureLevel * 8 + shipSpeed * 1.6 + shipTurn * 0.35 + moraleRatio * 16 - encounter.threat * 10 - (distance === 'boarded' ? 16 : distance === 'close' ? 6 : 0)
    const escapedCleanly = escapeScore >= 26
    if (escapedCleanly) {
      outcome = buildWithdrawalOutcome(encounter, true)
    } else {
      playerDamage = Math.max(2, Math.round((enemyCannonPower * getDistanceFactor(distance, 'withdraw')) / 3.8))
      playerCrewLoss = distance === 'boarded' ? Math.min(state.playerCrew, 2) : 0
      playerMorale = clamp(playerMorale - 7, 0, 100)
      outcome = buildWithdrawalOutcome(encounter, false)
    }
  } else if (action === 'cannon') {
    enemyDamage = Math.max(1, Math.round((cannonPower * getDistanceFactor(distance, 'cannon')) / 4.1))
    playerDamage = Math.max(1, Math.round((enemyCannonPower * getDistanceFactor(distance, 'cannon')) / 4.6))
    enemyCrewLoss = distance === 'close' ? Math.min(state.enemyCrew, Math.floor(enemyDamage / 7)) : 0
    playerCrewLoss = distance === 'close' ? Math.min(state.playerCrew, Math.floor(playerDamage / 8)) : 0
    playerMorale = clamp(playerMorale + 2 - Math.floor(playerDamage / 6), 0, 100)
    if (distance === 'long') distance = encounter.type === 'derelict' ? 'close' : Math.random() > 0.35 ? 'close' : 'long'
    else if (distance === 'close' && encounter.type === 'pirate' && Math.random() > 0.55) distance = 'boarded'
  } else {
    if (distance === 'long') {
      distance = 'boarded'
      enemyDamage = Math.max(1, Math.round((cannonPower * 0.35) / 4.3))
      playerDamage = Math.max(1, Math.round((enemyCannonPower * 0.5) / 4.8))
    } else {
      distance = 'boarded'
      enemyDamage = Math.max(2, Math.round((meleePower * getDistanceFactor(distance, 'board')) / 3.6))
      playerDamage = Math.max(2, Math.round((enemyMeleePower * getDistanceFactor(distance, 'board')) / 3.9))
      enemyCrewLoss = Math.min(state.enemyCrew, Math.max(1, Math.round(enemyDamage / 5)))
      playerCrewLoss = Math.min(state.playerCrew, Math.max(1, Math.round(playerDamage / 5.5)))
    }
    playerMorale = clamp(playerMorale + 4 - Math.floor(playerDamage / 5), 0, 100)
  }

  const enemyDurability = clamp(state.enemyDurability - enemyDamage, 0, state.enemyMaxDurability)
  const playerDurability = clamp(state.playerDurability - playerDamage, 0, state.playerMaxDurability)
  const enemyCrew = clamp(state.enemyCrew - enemyCrewLoss, 0, state.enemyMaxCrew)
  const playerCrew = clamp(state.playerCrew - playerCrewLoss, 0, state.playerMaxCrew)

  const summaryMap: Record<CombatAction, string> = {
    cannon: '砲撃を交わしました。',
    board: distance === 'boarded' ? '接舷して白兵戦を展開しました。' : '接近を試みました。',
    withdraw: outcome?.message ?? '離脱を試みました。',
  }

  const log = [
    {
      round,
      action,
      summary: summaryMap[action],
      playerDamage,
      enemyDamage,
      playerCrewLoss,
      enemyCrewLoss,
    },
    ...state.log,
  ].slice(0, 6)

  const nextState: EncounterCombatState = {
    ...state,
    phase: 'battle',
    round,
    distance,
    playerDurability,
    playerCrew,
    playerMorale,
    enemyDurability,
    enemyCrew,
    log,
  }

  if (enemyDurability <= 0 || enemyCrew <= 0) {
    nextState.phase = 'resolved'
    nextState.result = buildVictoryOutcome(encounter, nextState)
    return nextState
  }

  if (playerDurability <= 0 || playerCrew <= 0) {
    nextState.phase = 'resolved'
    nextState.playerDurability = Math.max(1, playerDurability)
    nextState.result = buildDefeatOutcome(encounter)
    return nextState
  }

  if (outcome) {
    nextState.phase = 'resolved'
    nextState.result = outcome
    return nextState
  }

  return nextState
}

export const useEncounterStore = create<EncounterStoreState>()((set, get) => ({
  activeEncounter: null,
  combatState: null,
  lastEncounterNotice: null,
  lastEncounterAtDay: -1,

  triggerEncounter: (encounter) => {
    if (get().activeEncounter) return false
    useNavigationStore.getState().setMode('combat')
    useNavigationStore.getState().setSpeed(0)
    set({ activeEncounter: encounter, combatState: null, lastEncounterAtDay: encounter.startedAtDay, lastEncounterNotice: `遭遇: ${encounter.title}` })
    return true
  },

  resolveEncounter: (action) => {
    const encounter = get().activeEncounter
    if (!encounter) return { ok: false, message: '遭遇情報を解決できません。' }

    if (action === 'engage') return get().startCombat()

    const outcome = resolveImmediateOutcome(encounter, action)
    applyEncounterOutcome(outcome)
    useNavigationStore.getState().setMode(resolveNavigationMode())
    useNavigationStore.getState().setSpeed(0)
    set({ activeEncounter: null, combatState: null, lastEncounterNotice: outcome.message })
    return { ok: true, message: outcome.message }
  },

  startCombat: () => {
    const encounter = get().activeEncounter
    if (!encounter) return { ok: false, message: '遭遇情報を解決できません。' }
    const combatState = createCombatState(encounter)
    if (!combatState) return { ok: false, message: '戦闘準備に必要な船情報が見つかりません。' }
    set({ combatState, lastEncounterNotice: `戦闘開始: ${encounter.title}` })
    return { ok: true, message: `${encounter.title} との戦闘に入ります。` }
  },

  performCombatAction: (action) => {
    const encounter = get().activeEncounter
    const combatState = get().combatState
    if (!encounter || !combatState) return { ok: false, message: '進行中の戦闘がありません。' }
    if (combatState.phase === 'resolved') return { ok: false, message: '戦闘はすでに終了しています。' }

    const nextState = performCombatRound(encounter, combatState, action)
    if (nextState.phase === 'resolved' && nextState.result) {
      applyEncounterOutcome(nextState.result, nextState)
      set({ combatState: nextState, lastEncounterNotice: nextState.result.message })
      return { ok: true, message: nextState.result.message }
    }

    set({ combatState: nextState })
    return { ok: true, message: '戦闘行動を実行しました。' }
  },

  closeEncounter: () => {
    useNavigationStore.getState().setMode(resolveNavigationMode())
    useNavigationStore.getState().setSpeed(0)
    set({ activeEncounter: null, combatState: null })
  },

  clearEncounterNotice: () => set({ lastEncounterNotice: null }),
}))

