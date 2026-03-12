import { create } from 'zustand'
import { generateTradeQuestsForPort } from '@/game/quest/tradeQuestGenerator.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import type { Quest, QuestReward, TradeQuestCategory } from '@/types/quest.ts'

interface QuestStoreState {
  availableByPort: Record<string, Quest[]>
  activeQuest: Quest | null
  completedQuestIds: string[]
  failedQuestIds: string[]
  lastGeneratedDayByPort: Record<string, number>
  lastQuestNotice: string | null

  ensurePortQuests: (portId: string, day: number) => void
  acceptQuest: (questId: string, portId: string) => { ok: boolean; message: string }
  deliverTradeQuestCargo: () => { ok: boolean; message: string }
  turnInQuest: () => { ok: boolean; message: string }
  recordPurchasedGoods: (portId: string, goodId: string, quantity: number) => void
  recordSoldGoods: (portId: string, goodId: string, quantity: number) => void
  failExpiredQuests: (currentDay: number) => void
  clearQuestNotice: () => void
}

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

function getQuestCategory(quest: Quest): TradeQuestCategory | undefined {
  return quest.metadata?.category
}

function appendUnique(items: string[], next: string): string[] {
  return items.includes(next) ? items : [...items, next]
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

export const useQuestStore = create<QuestStoreState>()((set, get) => ({
  availableByPort: {},
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
    const player = usePlayerStore.getState().player
    if (!port || !player) return

    const quests = generateTradeQuestsForPort({
      port,
      ports: masterData.ports,
      goods: masterData.tradeGoods,
      day: currentDay,
      tradeLevel: player.stats.tradeLevel,
    }).filter((quest) => !get().completedQuestIds.includes(quest.id) && !get().failedQuestIds.includes(quest.id))

    set((state) => ({
      availableByPort: { ...state.availableByPort, [portId]: quests },
      lastGeneratedDayByPort: { ...state.lastGeneratedDayByPort, [portId]: currentDay },
    }))
  },

  acceptQuest: (questId, portId) => {
    if (get().activeQuest) return { ok: false, message: '進行中のクエストがあります。' }

    const quest = get().availableByPort[portId]?.find((entry) => entry.id === questId)
    const playerState = usePlayerStore.getState()
    const player = playerState.player
    const activeShip = playerState.ships.find((ship) => ship.instanceId === playerState.activeShipId)
    const currentDay = getCurrentDay()
    if (!quest || !player || !activeShip) return { ok: false, message: 'クエストが見つかりません。' }
    if ((quest.requiredLevel ?? 1) > player.stats.tradeLevel) return { ok: false, message: '交易レベルが足りません。' }
    if ((quest.requiredFame ?? 0) > player.stats.fame) return { ok: false, message: `名声が ${quest.requiredFame} 必要です。` }

    const quantity = quest.metadata?.quantity ?? 0
    const good = quest.metadata?.goodId ? useDataStore.getState().getTradeGood(quest.metadata.goodId) : null
    const requiredCapacity = (good?.weight ?? 1) * quantity
    const category = getQuestCategory(quest)
    if ((category === 'trade_delivery' || category === 'trade_procurement') && activeShip.maxCapacity < requiredCapacity) {
      return { ok: false, message: 'この依頼を運ぶには船倉が足りません。' }
    }

    const nextQuest: Quest = {
      ...quest,
      status: 'active',
      acceptedDay: currentDay,
      metadata: { ...quest.metadata, delivered: false, purchased: false, soldQuantity: 0 },
    }

    set((state) => ({
      activeQuest: nextQuest,
      lastQuestNotice: `${nextQuest.title} を受注しました。期限は ${formatDay(nextQuest.deadlineDay)} です。`,
      availableByPort: {
        ...state.availableByPort,
        [portId]: (state.availableByPort[portId] ?? []).filter((entry) => entry.id !== questId),
      },
    }))
    return { ok: true, message: `${nextQuest.title} を受注しました。` }
  },

  deliverTradeQuestCargo: () => {
    const quest = get().activeQuest
    const dockedPortId = useNavigationStore.getState().dockedPortId
    const playerState = usePlayerStore.getState()
    const activeShip = playerState.ships.find((ship) => ship.instanceId === playerState.activeShipId)
    if (!quest || !activeShip || !quest.metadata?.goodId || !quest.metadata?.quantity) {
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
    const cargoSlot = activeShip.cargo.find((slot) => slot.goodId === goodId)
    if (!cargoSlot || cargoSlot.quantity < quantity) {
      return { ok: false, message: '納品に必要な積荷が足りません。' }
    }

    const good = useDataStore.getState().getTradeGood(goodId)
    const remainingCargo = activeShip.cargo
      .map((slot) => slot.goodId !== goodId ? slot : { ...slot, quantity: slot.quantity - quantity })
      .filter((slot) => slot.quantity > 0)
    const freedCapacity = (good?.weight ?? 1) * quantity

    usePlayerStore.setState((state) => ({
      ships: state.ships.map((ship) => ship.instanceId !== state.activeShipId ? ship : {
        ...ship,
        cargo: remainingCargo,
        usedCapacity: Math.max(0, Math.round((ship.usedCapacity - freedCapacity) * 100) / 100),
      }),
    }))

    set((state) => {
      const currentQuest = state.activeQuest
      if (!currentQuest) return state

      let nextQuest = updateObjective(currentQuest, 'deliver_item', quantity)
      if (category === 'trade_delivery') {
        nextQuest = updateObjective(nextQuest, 'visit_port', 1)
      }
      nextQuest = {
        ...nextQuest,
        status: 'ready_to_turn_in',
        metadata: { ...nextQuest.metadata, delivered: true },
      }

      return {
        activeQuest: nextQuest,
        lastQuestNotice: '依頼品を納品しました。報告して報酬を受け取れます。',
      }
    })

    return { ok: true, message: '依頼品を納品しました。ギルドで報告できます。' }
  },

  turnInQuest: () => {
    const quest = get().activeQuest
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

    usePlayerStore.setState((state) => state.player ? ({
      player: {
        ...state.player,
        money: state.player.money + rewardMoney,
        stats: {
          ...state.player.stats,
          tradeExp: state.player.stats.tradeExp + rewardExp,
          fame: state.player.stats.fame + rewardFame,
        },
      },
    }) : state)

    const bonusNotes = applyQuestRewards(quest.rewards, player.nationality)

    set((state) => ({
      activeQuest: null,
      completedQuestIds: appendUnique(state.completedQuestIds, quest.id),
      lastQuestNotice: `${quest.title} を報告しました。報酬 ${rewardMoney} d を獲得。${bonusNotes.length > 0 ? ` 追加: ${bonusNotes.join(', ')}` : ''}`,
    }))

    return { ok: true, message: `${quest.title} を報告しました。報酬 ${rewardMoney} d を獲得。` }
  },

  recordPurchasedGoods: (portId, goodId, quantity) => {
    if (quantity <= 0) return
    set((state) => {
      const quest = state.activeQuest
      if (!quest || getQuestCategory(quest) !== 'trade_procurement') return state
      if (quest.metadata?.destinationPortId !== portId || quest.metadata.goodId !== goodId) return state

      const nextCurrent = Math.min((quest.metadata.quantity ?? 0), (quest.objectives.find((objective) => objective.type === 'buy_item')?.current ?? 0) + quantity)
      const nextQuest = updateObjective(quest, 'buy_item', nextCurrent)
      return {
        activeQuest: {
          ...nextQuest,
          metadata: { ...nextQuest.metadata, purchased: nextCurrent >= (quest.metadata.quantity ?? 0) },
          status: nextCurrent >= (quest.metadata.quantity ?? 0) ? 'active' : nextQuest.status,
        },
        lastQuestNotice: nextCurrent >= (quest.metadata.quantity ?? 0) ? '買い付け完了です。依頼主の港へ持ち帰って納品してください。' : state.lastQuestNotice,
      }
    })
  },

  recordSoldGoods: (portId, goodId, quantity) => {
    if (quantity <= 0) return
    set((state) => {
      const quest = state.activeQuest
      if (!quest || getQuestCategory(quest) !== 'trade_sales') return state
      if (quest.metadata?.destinationPortId !== portId || quest.metadata.goodId !== goodId) return state

      const currentSold = quest.metadata.soldQuantity ?? 0
      const nextSold = Math.min((quest.metadata.quantity ?? 0), currentSold + quantity)
      let nextQuest = updateObjective(quest, 'sell_item', nextSold)
      if (nextSold >= (quest.metadata.quantity ?? 0)) {
        nextQuest = updateObjective(nextQuest, 'visit_port', 1)
        nextQuest = {
          ...nextQuest,
          status: 'ready_to_turn_in',
          metadata: { ...nextQuest.metadata, soldQuantity: nextSold },
        }
        return {
          activeQuest: nextQuest,
          lastQuestNotice: '指定数量の売り込みが完了しました。ギルドへ報告できます。',
        }
      }

      return {
        activeQuest: {
          ...nextQuest,
          metadata: { ...nextQuest.metadata, soldQuantity: nextSold },
        },
      }
    })
  },

  failExpiredQuests: (currentDay) => {
    const day = Math.floor(currentDay)
    const quest = get().activeQuest
    if (!quest || quest.status === 'failed' || quest.status === 'completed') return
    if (quest.deadlineDay == null || day <= quest.deadlineDay) return

    set((state) => ({
      activeQuest: null,
      failedQuestIds: appendUnique(state.failedQuestIds, quest.id),
      lastQuestNotice: `${quest.title} は期限切れで失敗しました。期限は ${formatDay(quest.deadlineDay)} でした。`,
    }))
  },

  clearQuestNotice: () => set({ lastQuestNotice: null }),
}))


