import { create } from 'zustand'
import { generateAdventureQuestsForPort } from '@/game/quest/adventureQuestGenerator.ts'
import { generateCombatQuestsForPort } from '@/game/quest/combatQuestGenerator.ts'
import { generateTradeQuestsForPort } from '@/game/quest/tradeQuestGenerator.ts'
import { WORLD_DISTANCE_SCALE } from '@/config/gameConfig.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useNpcFleetStore } from '@/stores/useNpcFleetStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useUIStore } from '@/stores/useUIStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import type { Discovery, DiscoveryMethod } from '@/types/discovery.ts'
import type { Quest, QuestCategory, QuestReward } from '@/types/quest.ts'

interface QuestStoreState {
  availableByPort: Record<string, Quest[]>
  activeQuests: Quest[]
  activeQuest: Quest | null
  completedQuestIds: string[]
  failedQuestIds: string[]
  lastGeneratedDayByPort: Record<string, number>
  lastQuestNotice: string | null

  ensurePortQuests: (portId: string, day: number) => void
  acceptQuest: (questId: string, portId: string) => { ok: boolean; message: string }
  selectActiveQuest: (questId: string) => void
  deliverTradeQuestCargo: () => { ok: boolean; message: string }
  turnInQuest: () => { ok: boolean; message: string }
  completeCombatQuestForFleet: (fleetId: string) => { ok: boolean; message: string }
  attemptDiscovery: (method: DiscoveryMethod) => { ok: boolean; message: string }
  recordPurchasedGoods: (portId: string, goodId: string, quantity: number) => void
  recordSoldGoods: (portId: string, goodId: string, quantity: number) => void
  failExpiredQuests: (currentDay: number) => void
  clearQuestNotice: () => void
}

export const MAX_ACTIVE_QUESTS = 3

function updateObjective(quest: Quest, targetType: 'deliver_item' | 'visit_port' | 'buy_item' | 'sell_item', current: number): Quest {
  return {
    ...quest,
    objectives: quest.objectives.map((objective) => objective.type !== targetType ? objective : { ...objective, current: Math.min(objective.count, current) }),
  }
}

function isQuestReadyForTurnIn(quest: Quest | null): boolean {
  if (!quest) return false
  if (quest.status === 'ready_to_turn_in') return true
  return quest.objectives.every((objective) => objective.current >= objective.count)
}

function formatDay(day?: number): string {
  if (day == null) return '-'
  return `Day ${day}`
}

function getCurrentDay(): number {
  return Math.floor(useGameStore.getState().timeState.totalDays)
}

function getReportPortId(quest: Quest): string | undefined {
  return quest.metadata?.reportPortId ?? quest.metadata?.destinationPortId ?? quest.giverPort
}

function getPortName(ports: { id: string; name: string }[], portId?: string): string {
  if (!portId) return '不明港'
  return ports.find((port) => port.id === portId)?.name ?? portId
}

function getQuestCategory(quest: Quest): QuestCategory | undefined {
  return quest.metadata?.category
}

function showQuestAchievement(params: {
  kind: 'discovery' | 'combat' | 'trade'
  title: string
  subject: string
  subtitle?: string
  discoveryId?: string
  goodId?: string
}): void {
  useUIStore.getState().showQuestAchievement(params)
}

function getDiscoveryMethodLabel(method?: DiscoveryMethod): string {
  return method === 'search' ? '探索' : '視認'
}

function getCompletedDiscoveryIds(): string[] {
  return usePlayerStore.getState().player?.discoveredDiscoveryIds ?? []
}

function getActiveDiscoveryIds(quests: Quest[]): string[] {
  return quests
    .map((quest) => quest.metadata?.discoveryId)
    .filter((id): id is string => Boolean(id))
}

function getDistanceKmToDiscovery(discovery: Discovery): number {
  const position = useNavigationStore.getState().position
  return Math.hypot(discovery.position.x - position.x, discovery.position.y - position.y) * WORLD_DISTANCE_SCALE
}

function getEffectiveSkillRank(skillId: string | undefined): number {
  const player = usePlayerStore.getState().player
  if (!player || !skillId) return 0
  const learnedRank = player.skills.find((skill) => skill.skillId === skillId)?.rank ?? 0
  if (learnedRank > 0) return learnedRank
  return Math.max(1, Math.floor(player.stats.adventureLevel / 2) + 1)
}

function recordDiscoveryForPlayer(discovery: Discovery, expFactor = 0): void {
  let adventureExp = 0
  usePlayerStore.setState((state) => {
    if (!state.player) return state
    const discovered = state.player.discoveredDiscoveryIds ?? []
    if (discovered.includes(discovery.id)) return state
    adventureExp = Math.round(discovery.exp * expFactor)
    const fame = Math.round(discovery.fame * expFactor)
    return {
      player: {
        ...state.player,
        discoveredDiscoveryIds: [...discovered, discovery.id],
        stats: {
          ...state.player.stats,
          fame: state.player.stats.fame + fame,
        },
      },
    }
  })
  if (adventureExp > 0) usePlayerStore.getState().grantExperience({ adventure: adventureExp })
}

function appendUnique(items: string[], next: string): string[] {
  return items.includes(next) ? items : [...items, next]
}

function appendUniqueMany(items: string[], nextItems: string[]): string[] {
  return nextItems.reduce((current, item) => appendUnique(current, item), items)
}

function getActiveQuests(state: Pick<QuestStoreState, 'activeQuest' | 'activeQuests'>): Quest[] {
  if (state.activeQuests?.length > 0) return state.activeQuests
  return state.activeQuest ? [state.activeQuest] : []
}

function getSelectedActiveQuest(state: Pick<QuestStoreState, 'activeQuest' | 'activeQuests'>): Quest | null {
  const quests = getActiveQuests(state)
  if (state.activeQuest && quests.some((quest) => quest.id === state.activeQuest?.id)) return state.activeQuest
  return quests[0] ?? null
}

function applyQuestRewards(rewards: QuestReward[], playerNationality: string): string[] {
  const notes: string[] = []

  for (const reward of rewards) {
    if (reward.type === 'item' && reward.itemId && reward.amount) {
      usePlayerStore.getState().addInventoryItem(reward.itemId, reward.amount)
      notes.push(`${reward.itemId} x${reward.amount}`)
      continue
    }

    if (reward.type === 'influence' && reward.portId && reward.amount) {
      useWorldStore.getState().updatePort(reward.portId, (port) => ({
        ...port,
        influence: {
          ...port.influence,
          [playerNationality]: Math.min(100, (port.influence[playerNationality as keyof typeof port.influence] ?? 0) + (reward.amount ?? 0)),
        },
      }))
      notes.push(`${reward.portId} influence +${reward.amount}`)
    }
  }

  return notes
}

function getQuestShipSpeedKnots(): number | undefined {
  const playerState = usePlayerStore.getState()
  const activeShip = playerState.ships.find((ship) => ship.instanceId === playerState.activeShipId)
  if (!activeShip) return undefined

  const shipType = useDataStore.getState().getShip(activeShip.typeId)
  if (!shipType) return undefined

  const riggingLevel = activeShip.upgrades?.rigging ?? 0
  return shipType.speed * (1 + riggingLevel * 0.04)
}

export const useQuestStore = create<QuestStoreState>()((set, get) => ({
  availableByPort: {},
  activeQuests: [],
  activeQuest: null,
  completedQuestIds: [],
  failedQuestIds: [],
  lastGeneratedDayByPort: {},
  lastQuestNotice: null,

  ensurePortQuests: (portId, day) => {
    const currentDay = Math.floor(day)
    if (get().lastGeneratedDayByPort[portId] === currentDay) return

    const { masterData } = useDataStore.getState()
    const port = masterData.ports.find((entry) => entry.id === portId)
    const playerState = usePlayerStore.getState()
    const player = playerState.player
    if (!port || !player) return

    const activeQuests = getActiveQuests(get())
    const activeQuestIds = new Set(activeQuests.map((quest) => quest.id))
    const adventureQuests = generateAdventureQuestsForPort({
      port,
      ports: masterData.ports,
      discoveries: masterData.discoveries,
      day: currentDay,
      adventureLevel: player.stats.adventureLevel,
      completedDiscoveryIds: getCompletedDiscoveryIds(),
      activeDiscoveryIds: getActiveDiscoveryIds(activeQuests),
      shipSpeedKnots: getQuestShipSpeedKnots(),
    })
    const tradeQuests = generateTradeQuestsForPort({
      port,
      ports: masterData.ports,
      goods: masterData.tradeGoods,
      day: currentDay,
      tradeLevel: player.stats.tradeLevel,
      shipSpeedKnots: getQuestShipSpeedKnots(),
    })
    const combatQuests = generateCombatQuestsForPort({
      port,
      ports: masterData.ports,
      day: currentDay,
      combatLevel: player.stats.combatLevel,
      playerFleetShipCount: playerState.ships.length,
      shipSpeedKnots: getQuestShipSpeedKnots(),
    })
    const quests = [...adventureQuests, ...tradeQuests, ...combatQuests]
      .filter((quest) => !activeQuestIds.has(quest.id) && !get().completedQuestIds.includes(quest.id) && !get().failedQuestIds.includes(quest.id))

    set((state) => ({
      availableByPort: { ...state.availableByPort, [portId]: quests },
      lastGeneratedDayByPort: { ...state.lastGeneratedDayByPort, [portId]: currentDay },
    }))
  },

  acceptQuest: (questId, portId) => {
    const activeQuests = getActiveQuests(get())
    if (activeQuests.length >= MAX_ACTIVE_QUESTS) return { ok: false, message: `同時に請け負えるクエストは最大 ${MAX_ACTIVE_QUESTS} 件です。` }

    const quest = get().availableByPort[portId]?.find((entry) => entry.id === questId)
    const playerState = usePlayerStore.getState()
    const player = playerState.player
    const activeShip = playerState.ships.find((ship) => ship.instanceId === playerState.activeShipId)
    const currentDay = getCurrentDay()
    if (!quest || !player || !activeShip) return { ok: false, message: 'クエストが見つかりません。' }
    const category = getQuestCategory(quest)
    const requiredLevelStat = category === 'combat_bounty'
      ? player.stats.combatLevel
      : category === 'adventure_discovery'
        ? player.stats.adventureLevel
        : player.stats.tradeLevel
    if ((quest.requiredLevel ?? 0) > requiredLevelStat) {
      return { ok: false, message: category === 'combat_bounty' ? '戦闘レベルが足りません。' : category === 'adventure_discovery' ? '冒険レベルが足りません。' : '交易レベルが足りません。' }
    }
    if ((quest.requiredFame ?? 0) > player.stats.fame) return { ok: false, message: `名声が ${quest.requiredFame} 必要です。` }
    if (quest.requiredSkill && getEffectiveSkillRank(quest.requiredSkill.skillId) < quest.requiredSkill.rank) {
      return { ok: false, message: `${quest.requiredSkill.skillId} ランク ${quest.requiredSkill.rank} が必要です。` }
    }

    const quantity = quest.metadata?.quantity ?? 0
    const good = quest.metadata?.goodId ? useDataStore.getState().getTradeGood(quest.metadata.goodId) : null
    const requiredCapacity = (good?.weight ?? 1) * quantity
    if ((category === 'trade_delivery' || category === 'trade_procurement') && activeShip.maxCapacity < requiredCapacity) {
      return { ok: false, message: 'この依頼を運ぶには船倉が足りません。' }
    }

    const nextQuest: Quest = {
      ...quest,
      status: 'active',
      acceptedDay: currentDay,
      metadata: category === 'combat_bounty'
        ? { ...quest.metadata }
        : { ...quest.metadata, delivered: false, purchased: false, soldQuantity: 0 },
    }

    set((state) => ({
      activeQuests: [...getActiveQuests(state), nextQuest],
      activeQuest: nextQuest,
      lastQuestNotice: `${nextQuest.title} を受注しました。期限は ${formatDay(nextQuest.deadlineDay)} です。`,
      availableByPort: {
        ...state.availableByPort,
        [portId]: (state.availableByPort[portId] ?? []).filter((entry) => entry.id !== questId),
      },
    }))

    if (category === 'combat_bounty' && nextQuest.metadata?.combatTargetFleet) {
      useNpcFleetStore.getState().activateQuestFleet(nextQuest.metadata.combatTargetFleet)
    }

    return { ok: true, message: `${nextQuest.title} を受注しました。` }
  },

  selectActiveQuest: (questId) => {
    set((state) => {
      const quest = getActiveQuests(state).find((entry) => entry.id === questId)
      return quest ? { activeQuest: quest } : state
    })
  },

  deliverTradeQuestCargo: () => {
    const quest = getSelectedActiveQuest(get())
    const dockedPortId = useNavigationStore.getState().dockedPortId
    const playerState = usePlayerStore.getState()
    if (!quest || playerState.ships.length === 0 || !quest.metadata?.goodId || !quest.metadata?.quantity) {
      return { ok: false, message: '納品可能な交易クエストがありません。' }
    }

    const category = getQuestCategory(quest)
    const reportPortId = getReportPortId(quest)
    const canDeliverCategory = category === 'trade_delivery' || category === 'trade_procurement'
    if (!canDeliverCategory || !reportPortId) {
      return { ok: false, message: 'このクエストは納品操作を必要としません。' }
    }
    if (quest.metadata.delivered || quest.status === 'ready_to_turn_in') {
      return { ok: false, message: 'この依頼品はすでに納品済みです。' }
    }
    if (dockedPortId !== reportPortId) {
      return { ok: false, message: '納品先の港に到着していません。' }
    }
    if (category === 'trade_procurement' && !quest.metadata.purchased) {
      return { ok: false, message: '先に指定された港で買い付けを済ませてください。' }
    }

    const goodId = quest.metadata.goodId
    const quantity = quest.metadata.quantity
    const fleetQuantity = playerState.ships.reduce((sum, ship) => sum + (ship.cargo.find((slot) => slot.goodId === goodId)?.quantity ?? 0), 0)
    if (fleetQuantity < quantity) {
      return { ok: false, message: '納品に必要な積荷が足りません。' }
    }

    const good = useDataStore.getState().getTradeGood(goodId)
    const goodWeight = good?.weight ?? 1
    let remainingDelivery = quantity

    usePlayerStore.setState((state) => ({
      ships: state.ships.map((ship) => {
        if (remainingDelivery <= 0) return ship
        const cargoSlot = ship.cargo.find((slot) => slot.goodId === goodId)
        if (!cargoSlot) return ship

        const deliveredFromShip = Math.min(remainingDelivery, cargoSlot.quantity)
        remainingDelivery -= deliveredFromShip
        const nextCargo = ship.cargo
          .map((slot) => slot.goodId !== goodId ? slot : { ...slot, quantity: slot.quantity - deliveredFromShip })
          .filter((slot) => slot.quantity > 0)
        const freedCapacity = goodWeight * deliveredFromShip
        return {
          ...ship,
          cargo: nextCargo,
          usedCapacity: Math.max(0, Math.round((ship.usedCapacity - freedCapacity) * 100) / 100),
        }
      }),
    }))

    set((state) => {
      const currentQuest = getSelectedActiveQuest(state)
      if (!currentQuest) return state

      let nextQuest = updateObjective(currentQuest, 'deliver_item', quantity)
      if (category === 'trade_delivery' || category === 'trade_procurement') {
        nextQuest = updateObjective(nextQuest, 'visit_port', 1)
      }
      nextQuest = {
        ...nextQuest,
        status: 'ready_to_turn_in',
        metadata: { ...nextQuest.metadata, delivered: true },
      }

      return {
        activeQuests: getActiveQuests(state).map((entry) => entry.id === nextQuest.id ? nextQuest : entry),
        activeQuest: nextQuest,
        lastQuestNotice: '依頼品を納品しました。報告して報酬を受け取れます。',
      }
    })

    const goodName = good?.name ?? goodId
    showQuestAchievement({
      kind: 'trade',
      title: `${goodName} 納品完了`,
      subject: goodName,
      subtitle: `${getPortName(useDataStore.getState().masterData.ports, reportPortId)} で依頼品を引き渡しました。`,
      goodId,
    })

    return { ok: true, message: '依頼品を納品しました。依頼主へ報告できます。' }
  },

  turnInQuest: () => {
    const quest = getSelectedActiveQuest(get())
    const dockedPortId = useNavigationStore.getState().dockedPortId
    const player = usePlayerStore.getState().player
    if (!quest || !player) return { ok: false, message: '報告できるクエストがありません。' }

    const reportPortId = getReportPortId(quest)
    if (reportPortId && dockedPortId !== reportPortId) {
      return { ok: false, message: '報告先の港ではありません。' }
    }
    if (!isQuestReadyForTurnIn(quest)) return { ok: false, message: 'まだ目標を達成していません。' }

    const rewardMoney = quest.rewards.filter((reward) => reward.type === 'money').reduce((sum, reward) => sum + (reward.amount ?? 0), 0)
    const rewardExp = quest.rewards.filter((reward) => reward.type === 'exp').reduce((sum, reward) => sum + (reward.amount ?? 0), 0)
    const rewardFame = quest.rewards.filter((reward) => reward.type === 'fame').reduce((sum, reward) => sum + (reward.amount ?? 0), 0)
    const category = getQuestCategory(quest)

    usePlayerStore.setState((state) => state.player ? ({
      player: {
        ...state.player,
        money: state.player.money + rewardMoney,
        stats: {
          ...state.player.stats,
          fame: state.player.stats.fame + rewardFame,
        },
      },
    }) : state)
    usePlayerStore.getState().grantExperience(category === 'adventure_discovery' ? { adventure: rewardExp } : { trade: rewardExp })

    const bonusNotes = applyQuestRewards(quest.rewards, player.nationality)

    set((state) => {
      const remainingQuests = getActiveQuests(state).filter((entry) => entry.id !== quest.id)
      return {
        activeQuests: remainingQuests,
        activeQuest: remainingQuests[0] ?? null,
        completedQuestIds: appendUnique(state.completedQuestIds, quest.id),
        lastQuestNotice: `${quest.title} を報告しました。報酬 ${rewardMoney} d を獲得。${bonusNotes.length > 0 ? ` 追加: ${bonusNotes.join(', ')}` : ''}`,
      }
    })

    return { ok: true, message: `${quest.title} を報告しました。報酬 ${rewardMoney} d を獲得。` }
  },

  completeCombatQuestForFleet: (fleetId) => {
    const quest = getActiveQuests(get()).find((entry) => getQuestCategory(entry) === 'combat_bounty' && entry.metadata?.combatTargetFleetId === fleetId)
    const player = usePlayerStore.getState().player
    if (!quest || !player) {
      return { ok: false, message: '対象の討伐クエストはありません。' }
    }

    const rewardMoney = quest.rewards.filter((reward) => reward.type === 'money').reduce((sum, reward) => sum + (reward.amount ?? 0), 0)
    const rewardExp = quest.rewards.filter((reward) => reward.type === 'exp').reduce((sum, reward) => sum + (reward.amount ?? 0), 0)
    const rewardFame = quest.rewards.filter((reward) => reward.type === 'fame').reduce((sum, reward) => sum + (reward.amount ?? 0), 0)

    usePlayerStore.setState((state) => state.player ? ({
      player: {
        ...state.player,
        money: state.player.money + rewardMoney,
        stats: {
          ...state.player.stats,
          fame: state.player.stats.fame + rewardFame,
        },
      },
    }) : state)
    usePlayerStore.getState().grantExperience({ combat: rewardExp })

    const bonusNotes = applyQuestRewards(quest.rewards, player.nationality)
    useNpcFleetStore.getState().removeQuestFleet(fleetId)

    set((state) => {
      const remainingQuests = getActiveQuests(state).filter((entry) => entry.id !== quest.id)
      return {
        activeQuests: remainingQuests,
        activeQuest: state.activeQuest?.id === quest.id
          ? remainingQuests[0] ?? null
          : getSelectedActiveQuest(state),
        completedQuestIds: appendUnique(state.completedQuestIds, quest.id),
        lastQuestNotice: `${quest.title} を達成しました。報酬 ${rewardMoney} d と戦闘経験 ${rewardExp} を獲得。${bonusNotes.length > 0 ? ` 追加: ${bonusNotes.join(', ')}` : ''}`,
      }
    })

    const targetName = quest.metadata?.combatTargetName ?? quest.title
    showQuestAchievement({
      kind: 'combat',
      title: `${targetName} 討伐完了`,
      subject: targetName,
      subtitle: `報酬 ${rewardMoney} d と戦闘経験 ${rewardExp} を獲得しました。`,
    })

    return { ok: true, message: `${quest.title} を達成しました。報酬 ${rewardMoney} d を獲得。` }
  },

  attemptDiscovery: (method) => {
    const navigation = useNavigationStore.getState()
    const player = usePlayerStore.getState().player
    if (!player) return { ok: false, message: '探索できる状態ではありません。' }
    if (navigation.mode === 'docked' || navigation.mode === 'combat') {
      return { ok: false, message: '洋上でのみ実行できます。' }
    }

    const methodLabel = getDiscoveryMethodLabel(method)
    const discoveries = useDataStore.getState().masterData.discoveries
    const completed = new Set(getCompletedDiscoveryIds())
    const activeQuests = getActiveQuests(get())
    const activeAdventureQuests = activeQuests.filter((quest) => getQuestCategory(quest) === 'adventure_discovery' && quest.metadata?.discoveryMethod === method)

    const questCandidates = activeAdventureQuests
      .map((quest) => {
        const discovery = quest.metadata?.discoveryId ? discoveries.find((entry) => entry.id === quest.metadata?.discoveryId) : undefined
        return discovery ? { discovery, quest, distance: getDistanceKmToDiscovery(discovery) } : null
      })
      .filter((entry): entry is { discovery: Discovery; quest: Quest; distance: number } => Boolean(entry))
      .sort((a, b) => a.distance - b.distance)

    const freeCandidates = discoveries
      .filter((discovery) => discovery.method === method && !completed.has(discovery.id))
      .map((discovery) => ({ discovery, quest: null, distance: getDistanceKmToDiscovery(discovery) }))
      .sort((a, b) => a.distance - b.distance)

    const nearby = [...questCandidates, ...freeCandidates].find((entry) => entry.distance <= entry.discovery.radiusKm)
    if (!nearby) {
      const nearest = [...questCandidates, ...freeCandidates][0]
      const distanceHint = nearest ? ` 最も近い手がかりまで約 ${Math.round(nearest.distance)} km です。` : ''
      return { ok: false, message: `周辺に${methodLabel}できる発見物は見当たりません。${distanceHint}` }
    }

    const requiredRank = nearby.discovery.requiredSkill.rank
    const skillRank = getEffectiveSkillRank(nearby.discovery.requiredSkill.skillId)
    if (skillRank < requiredRank) {
      return { ok: false, message: `周辺の発見物の${methodLabel}には ${nearby.discovery.requiredSkill.skillId} ランク ${requiredRank} が必要です。` }
    }

    if (nearby.quest) {
      recordDiscoveryForPlayer(nearby.discovery, 0.35)
      set((state) => {
        const nextQuest: Quest = {
          ...nearby.quest!,
          title: `${nearby.discovery.name} 発見報告`,
          status: 'ready_to_turn_in',
          objectives: nearby.quest!.objectives.map((objective) => {
            if (objective.type === 'discover') return { ...objective, current: objective.count, description: `${nearby.discovery.name} を発見した` }
            return objective
          }),
        }
        return {
          activeQuests: getActiveQuests(state).map((quest) => quest.id === nextQuest.id ? nextQuest : quest),
          activeQuest: nextQuest,
          lastQuestNotice: `${nearby.discovery.name} を発見しました。${getPortName(useDataStore.getState().masterData.ports, nextQuest.metadata?.reportPortId)} のギルドで報告できます。`,
        }
      })
      showQuestAchievement({
        kind: 'discovery',
        title: `${nearby.discovery.name} 発見`,
        subject: nearby.discovery.name,
        subtitle: `${getPortName(useDataStore.getState().masterData.ports, nearby.quest.metadata?.reportPortId)} のギルドで報告できます。`,
        discoveryId: nearby.discovery.id,
      })
      return { ok: true, message: `${nearby.discovery.name} を発見しました。` }
    }

    recordDiscoveryForPlayer(nearby.discovery, 0.5)
    set({ lastQuestNotice: `${nearby.discovery.name} を発見しました。冒険経験と名声を少し獲得しました。` })
    showQuestAchievement({
      kind: 'discovery',
      title: `${nearby.discovery.name} 発見`,
      subject: nearby.discovery.name,
      subtitle: '冒険経験と名声を獲得しました。',
      discoveryId: nearby.discovery.id,
    })
    return { ok: true, message: `${nearby.discovery.name} を発見しました。` }
  },

  recordPurchasedGoods: (portId, goodId, quantity) => {
    if (quantity <= 0) return
    set((state) => {
      let completedNotice = false
      const nextQuests = getActiveQuests(state).map((quest) => {
        if (getQuestCategory(quest) !== 'trade_procurement') return quest
        if (quest.metadata?.sourcePortId !== portId || quest.metadata.goodId !== goodId) return quest

        const nextCurrent = Math.min((quest.metadata.quantity ?? 0), (quest.objectives.find((objective) => objective.type === 'buy_item')?.current ?? 0) + quantity)
        const nextQuest = updateObjective(quest, 'buy_item', nextCurrent)
        if (nextCurrent >= (quest.metadata.quantity ?? 0)) completedNotice = true
        return {
          ...nextQuest,
          metadata: { ...nextQuest.metadata, purchased: nextCurrent >= (quest.metadata.quantity ?? 0) },
          status: nextCurrent >= (quest.metadata.quantity ?? 0) ? 'active' as const : nextQuest.status,
        }
      })
      const selectedQuest = state.activeQuest ? nextQuests.find((quest) => quest.id === state.activeQuest?.id) ?? nextQuests[0] ?? null : nextQuests[0] ?? null
      return {
        activeQuests: nextQuests,
        activeQuest: selectedQuest,
        lastQuestNotice: completedNotice ? '買い付け完了です。指定された港へ運んで納品してください。' : state.lastQuestNotice,
      }
    })
  },

  recordSoldGoods: (portId, goodId, quantity) => {
    if (quantity <= 0) return
    const completedSale: { current: { goodId: string; reportPortId?: string } | null } = { current: null }
    set((state) => {
      let completedNotice = false
      const nextQuests = getActiveQuests(state).map((quest) => {
        if (getQuestCategory(quest) !== 'trade_sales') return quest
        if (quest.status === 'ready_to_turn_in') return quest
        if (quest.metadata?.destinationPortId !== portId || quest.metadata.goodId !== goodId) return quest

        const currentSold = quest.metadata.soldQuantity ?? 0
        const nextSold = Math.min((quest.metadata.quantity ?? 0), currentSold + quantity)
        let nextQuest = updateObjective(quest, 'sell_item', nextSold)
        if (nextSold >= (quest.metadata.quantity ?? 0)) {
          completedNotice = true
          completedSale.current = { goodId, reportPortId: getReportPortId(quest) }
          nextQuest = updateObjective(nextQuest, 'visit_port', 1)
          return {
            ...nextQuest,
            status: 'ready_to_turn_in' as const,
            metadata: { ...nextQuest.metadata, soldQuantity: nextSold },
          }
        }

        return {
          ...nextQuest,
          metadata: { ...nextQuest.metadata, soldQuantity: nextSold },
        }
      })
      const selectedQuest = state.activeQuest ? nextQuests.find((quest) => quest.id === state.activeQuest?.id) ?? nextQuests[0] ?? null : nextQuests[0] ?? null

      return {
        activeQuests: nextQuests,
        activeQuest: selectedQuest,
        lastQuestNotice: completedNotice ? '指定数量の売り込みが完了しました。ギルドへ報告できます。' : state.lastQuestNotice,
      }
    })
    if (completedSale.current) {
      const good = useDataStore.getState().getTradeGood(completedSale.current.goodId)
      const goodName = good?.name ?? completedSale.current.goodId
      showQuestAchievement({
        kind: 'trade',
        title: `${goodName} 売却完了`,
        subject: goodName,
        subtitle: `${getPortName(useDataStore.getState().masterData.ports, completedSale.current.reportPortId)} へ報告できます。`,
        goodId: completedSale.current.goodId,
      })
    }
  },

  failExpiredQuests: (currentDay) => {
    const day = Math.floor(currentDay)
    const activeQuests = getActiveQuests(get())
    const expiredQuests = activeQuests.filter((quest) => quest.status !== 'failed' && quest.status !== 'completed' && quest.deadlineDay != null && day > quest.deadlineDay)
    if (expiredQuests.length === 0) return

    for (const quest of expiredQuests) {
      const questFleetId = quest.metadata?.combatTargetFleet?.id
      if (questFleetId) useNpcFleetStore.getState().removeQuestFleet(questFleetId)
    }

    set((state) => {
      const expiredIds = new Set(expiredQuests.map((quest) => quest.id))
      const remainingQuests = getActiveQuests(state).filter((quest) => !expiredIds.has(quest.id))
      return {
        activeQuests: remainingQuests,
        activeQuest: remainingQuests.find((quest) => quest.id === state.activeQuest?.id) ?? remainingQuests[0] ?? null,
        failedQuestIds: appendUniqueMany(state.failedQuestIds, expiredQuests.map((quest) => quest.id)),
        lastQuestNotice: expiredQuests.length === 1
          ? `${expiredQuests[0]!.title} は期限切れで失敗しました。期限は ${formatDay(expiredQuests[0]!.deadlineDay)} でした。`
          : `${expiredQuests.length} 件のクエストが期限切れで失敗しました。`,
      }
    })
  },

  clearQuestNotice: () => set({ lastQuestNotice: null }),
}))




