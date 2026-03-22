import { useEffect, useMemo, useState } from 'react'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { useEconomyStore } from '@/stores/useEconomyStore.ts'
import { useQuestStore } from '@/stores/useQuestStore.ts'
import { VOYAGE_CONFIG } from '@/config/gameConfig.ts'
import type { Quest, QuestRank, QuestReward, TradeQuestCategory } from '@/types/quest.ts'
import { uiText } from '@/i18n/uiText.ts'

interface TownScreenProps {
  onManualSave: () => void
  onLoadLatest: () => void
}

type TownSection = 'overview' | 'departure' | 'market' | 'guild' | 'tavern' | 'shipyard' | 'bank' | 'inventory'

const INVEST_AMOUNTS = [1000, 5000]
const BANK_AMOUNTS = [1000, 5000]
const CREW_HIRE_AMOUNTS = [1, 5, 10]
const REPAIR_AMOUNTS = [10, 30]
const SUPPLY_STEP = 12
const SECTION_LABELS: Record<TownSection, string> = {
  overview: uiText.town.sections.overview,
  departure: uiText.town.sections.departure,
  market: uiText.town.sections.market,
  guild: uiText.town.sections.guild,
  tavern: uiText.town.sections.tavern,
  shipyard: uiText.town.sections.shipyard,
  bank: uiText.town.sections.bank,
  inventory: uiText.town.sections.inventory,
}

const INVENTORY_SELL_FACTOR = 0.78
const OUTFIT_OPTIONS = [
  { option: 'rigging' as const, label: '帆装調整', description: '船体耐久と士気が微増 / 速力+4% / 旋回+6%' },
  { option: 'cargo' as const, label: '船倉補強', description: '積載量+6 / 重量ペナルティを軽減' },
  { option: 'gunnery' as const, label: '砲術訓練', description: '砲撃威力と命中感覚を改善 / 砲撃+8%' },
]
const OUTFIT_BASE_COST = { rigging: 320, cargo: 280, gunnery: 360 }
const OUTFIT_STEP = { rigging: 90, cargo: 70, gunnery: 120 }
const OUTFIT_MAX_LEVEL = 3

function formatQuestRank(rank?: QuestRank): string {
  if (rank === 'premium') return uiText.town.labels.premium
  if (rank === 'urgent') return uiText.town.labels.urgent
  return uiText.town.labels.standard
}

function formatQuestCategory(category?: TradeQuestCategory): string {
  if (category === 'trade_procurement') return '買い出し'
  if (category === 'trade_sales') return '売り込み'
  return '輸送'
}

function getDaysRemaining(quest: Quest | null, currentDay: number): number | null {
  if (!quest?.deadlineDay) return null
  return quest.deadlineDay - currentDay
}

function formatReward(reward: QuestReward): string {
  if (reward.type === 'money') return `${reward.amount ?? 0} d`
  if (reward.type === 'exp') return `EXP +${reward.amount ?? 0}`
  if (reward.type === 'fame') return `名声 +${reward.amount ?? 0}`
  if (reward.type === 'influence') return `${reward.portId ?? uiText.town.labels.port} +${reward.amount ?? 0}`
  if (reward.type === 'item') return `${reward.itemId ?? 'item'} x${reward.amount ?? 1}`
  return reward.type
}

function getQuestReportPortId(quest: Quest | null): string | undefined {
  return quest?.metadata?.reportPortId ?? quest?.metadata?.destinationPortId ?? quest?.giverPort
}

function getQuestActionLabel(category?: TradeQuestCategory): string {
  if (category === 'trade_procurement') return '買い付け品を納品'
  return '積荷を納品'
}

function formatObjectiveLabel(type: string): string {
  if (type === 'buy_item') return '買い付け'
  if (type === 'sell_item') return '売却'
  if (type === 'deliver_cargo') return '納品'
  if (type === 'visit_port') return '目的港到着'
  return type
}

function summarizeFacilities(facilities: { type: string; level: number }[]): string {
  return facilities.map((facility) => `${uiText.town.facilityNames[facility.type as keyof typeof uiText.town.facilityNames] ?? facility.type} Lv.${facility.level}`).join(' / ')
}

function formatMorale(morale?: number): string {
  if (morale == null) return '-'
  if (morale >= 80) return `${morale.toFixed(0)} 高い`
  if (morale >= 45) return `${morale.toFixed(0)} 安定`
  return `${morale.toFixed(0)} 低い`
}

function getMoraleTone(morale?: number): string {
  if (morale == null) return '不明'
  if (morale >= 80) return '上々'
  if (morale >= 45) return '安定'
  return '低い'
}



function getShipyardRequirement(category: string): number {
  if (category === 'small_sail') return 1
  if (category === 'medium_sail' || category === 'galley') return 2
  if (category === 'oriental') return 3
  return 4
}


export function TownScreen({ onManualSave, onLoadLatest }: TownScreenProps) {
  const portId = useNavigationStore((s) => s.dockedPortId)
  const ports = useWorldStore((s) => s.ports)
  const player = usePlayerStore((s) => s.player)
  const ships = usePlayerStore((s) => s.ships)
  const activeShipId = usePlayerStore((s) => s.activeShipId)
  const setPhase = useGameStore((s) => s.setPhase)
  const day = useGameStore((s) => Math.floor(s.timeState.totalDays))
  const getShip = useDataStore((s) => s.getShip)
  const getTradeGood = useDataStore((s) => s.getTradeGood)
  const shipCatalog = useDataStore((s) => s.masterData.ships)
  const market = useEconomyStore((s) => (portId ? s.markets[portId] : undefined))
  const getBuyQuote = useEconomyStore((s) => s.getBuyQuote)
  const getSellQuote = useEconomyStore((s) => s.getSellQuote)
  const getPurchaseLimit = useEconomyStore((s) => s.getPurchaseLimit)
  const buyGood = useEconomyStore((s) => s.buyGood)
  const sellGood = useEconomyStore((s) => s.sellGood)
  const investInPort = useEconomyStore((s) => s.investInPort)
  const depositMoney = useEconomyStore((s) => s.depositMoney)
  const withdrawMoney = useEconomyStore((s) => s.withdrawMoney)
  const borrowMoney = useEconomyStore((s) => s.borrowMoney)
  const repayDebt = useEconomyStore((s) => s.repayDebt)
  const resupplyShip = usePlayerStore((s) => s.resupplyShip)
  const visitTavern = usePlayerStore((s) => s.visitTavern)
  const repairShip = usePlayerStore((s) => s.repairShip)
  const purchaseShip = usePlayerStore((s) => s.purchaseShip)
  const setActiveShip = usePlayerStore((s) => s.setActiveShip)
  const sellInventoryItem = usePlayerStore((s) => s.sellInventoryItem)
  const outfitShip = usePlayerStore((s) => s.outfitShip)
  const ensurePortQuests = useQuestStore((s) => s.ensurePortQuests)
  const availableByPort = useQuestStore((s) => s.availableByPort)
  const activeQuest = useQuestStore((s) => s.activeQuest)
  const acceptQuest = useQuestStore((s) => s.acceptQuest)
  const deliverTradeQuestCargo = useQuestStore((s) => s.deliverTradeQuestCargo)
  const turnInQuest = useQuestStore((s) => s.turnInQuest)
  const lastQuestNotice = useQuestStore((s) => s.lastQuestNotice)
  const clearQuestNotice = useQuestStore((s) => s.clearQuestNotice)

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [tradeMessageState, setTradeMessageState] = useState<{ portId: string | null; message: string | null }>({ portId: null, message: null })
  const [activeSection, setActiveSection] = useState<TownSection>('overview')

  const port = ports.find((item) => item.id === portId)
  const activeShip = ships.find((ship) => ship.instanceId === activeShipId)
  const shipType = activeShip ? getShip(activeShip.typeId) : undefined
  const facilities = useMemo(() => port?.facilities.filter((facility) => facility.available) ?? [], [port])
  const marketFacility = facilities.find((facility) => facility.type === 'market')
  const tavernFacility = facilities.find((facility) => facility.type === 'tavern')
  const shipyardFacility = facilities.find((facility) => facility.type === 'shipyard')
  const bankFacility = facilities.find((facility) => facility.type === 'bank')
  const availableQuests = portId ? availableByPort[portId] ?? [] : []
  const hasGuild = facilities.some((facility) => facility.type === 'guild')
  const hasMarket = Boolean(marketFacility)
  const hasBank = Boolean(bankFacility)
  const tavernLevel = tavernFacility?.level ?? 1
  const shipyardLevel = shipyardFacility?.level ?? 1

  useEffect(() => {
    if (port?.id) ensurePortQuests(port.id, day)
  }, [day, ensurePortQuests, port?.id])

  const marketRows = useMemo(
    () => (market?.items ?? []).map((item) => {
      const good = getTradeGood(item.goodId)
      if (!good) return null
      const quantity = quantities[item.goodId] ?? 1
      const quote = portId ? getBuyQuote(portId, item.goodId, quantity) : null
      const limit = portId ? getPurchaseLimit(portId, item.goodId) : 0
      return { item, good, quantity, quote, limit }
    }).filter((row): row is NonNullable<typeof row> => Boolean(row)).sort((a, b) => a.quote!.unitPrice - b.quote!.unitPrice),
    [getBuyQuote, getPurchaseLimit, getTradeGood, market?.items, portId, quantities],
  )

  const cargoRows = useMemo(
    () => (activeShip?.cargo ?? []).map((slot) => {
      const good = getTradeGood(slot.goodId)
      if (!good) return null
      const quantity = quantities[slot.goodId] ?? 1
      const quote = portId ? getSellQuote(portId, slot.goodId, quantity) : null
      return { slot, good, quantity, quote }
    }).filter((row): row is NonNullable<typeof row> => Boolean(row)).sort((a, b) => b.quote!.unitPrice - a.quote!.unitPrice),
    [activeShip?.cargo, getSellQuote, getTradeGood, portId, quantities],
  )

  const inventoryRows = useMemo(() => {
    const entries = player?.inventory ?? []
    return entries
      .map((stack) => {
        const good = getTradeGood(stack.itemId)
        const unitValue = Math.max(10, Math.round((good?.basePrice ?? 50) * INVENTORY_SELL_FACTOR))
        return {
          itemId: stack.itemId,
          quantity: stack.quantity,
          unitValue,
          totalValue: unitValue * stack.quantity,
          name: good?.name ?? stack.itemId,
          description: good?.description ?? '説明はまだありません。',
        }
      })
      .filter((entry) => entry.quantity > 0)
      .sort((a, b) => b.totalValue - a.totalValue)
  }, [getTradeGood, player?.inventory])
  const inventoryTotalValue = inventoryRows.reduce((sum, entry) => sum + entry.totalValue, 0)

  if (!port) return <div style={styles.container}><div style={styles.card}>港が選択されていません。</div></div>

  const setQuantity = (goodId: string, nextValue: number) => setQuantities((current) => ({ ...current, [goodId]: Math.max(1, Math.min(200, Math.floor(nextValue) || 1)) }))
  const handleAction = (message: { message: string }) => {
    clearQuestNotice()
    setTradeMessageState({ portId: port.id, message: message.message })
  }

  const cargoUsage = `${activeShip?.usedCapacity ?? 0}/${activeShip?.maxCapacity ?? 0}`
  const questCategory = activeQuest?.metadata?.category
  const questGood = activeQuest?.metadata?.goodId ? getTradeGood(activeQuest.metadata.goodId) : null
  const questDestination = activeQuest?.metadata?.destinationPortId ? ports.find((item) => item.id === activeQuest.metadata?.destinationPortId) : null
  const questReportPortId = getQuestReportPortId(activeQuest)
  const questReportPort = questReportPortId ? ports.find((item) => item.id === questReportPortId) : null
  const isQuestDelivered = Boolean(activeQuest?.metadata?.delivered || activeQuest?.status === 'ready_to_turn_in')
  const canDeliverQuest = Boolean(activeQuest && (questCategory === 'trade_delivery' || questCategory === 'trade_procurement') && questReportPortId === port.id && questGood && !isQuestDelivered)
  const canReportQuest = Boolean(activeQuest && isQuestDelivered && questReportPortId === port.id)
  const rewardSummary = (activeQuest?.rewards ?? []).map(formatReward).join(' / ')
  const activeQuestDaysRemaining = getDaysRemaining(activeQuest, day)
  const availableSections = ([
    'overview',
    'departure',
    hasMarket ? 'market' : null,
    hasGuild ? 'guild' : null,
    tavernFacility ? 'tavern' : null,
    shipyardFacility ? 'shipyard' : null,
    hasBank ? 'bank' : null,
    'inventory',
  ] as const).filter((section): section is TownSection => section !== null)
  const visibleSection = availableSections.includes(activeSection) ? activeSection : 'overview'
  const notice = (tradeMessageState.portId === port.id ? tradeMessageState.message : null) ?? lastQuestNotice
  const missingDurability = Math.max(0, (activeShip?.maxDurability ?? 0) - (activeShip?.currentDurability ?? 0))
  const emergencyPreview = Math.min(missingDurability, 12)
  const emergencyRepairGain = missingDurability > 0 ? Math.min(missingDurability, Math.max(4, Math.floor(emergencyPreview * (VOYAGE_CONFIG.EMERGENCY_REPAIR_EFFICIENCY + shipyardLevel * 0.03)))) : 0
  const emergencyRepairCost = emergencyRepairGain * Math.max(2, VOYAGE_CONFIG.EMERGENCY_REPAIR_COST_PER_POINT - Math.floor(shipyardLevel / 2))
  const standardRepairUnitCost = Math.max(2, VOYAGE_CONFIG.STANDARD_REPAIR_COST_PER_POINT - Math.floor(shipyardLevel / 2))
  const standardRepairPreview = REPAIR_AMOUNTS.map((amount) => ({ amount, cost: Math.min(amount, missingDurability) * standardRepairUnitCost }))
  const overhaulCost = missingDurability * Math.max(VOYAGE_CONFIG.STANDARD_REPAIR_COST_PER_POINT, VOYAGE_CONFIG.OVERHAUL_COST_PER_POINT - Math.floor(shipyardLevel / 2))
  const tavernMealCost = Math.max(20, Math.ceil(Math.max(1, activeShip?.currentCrew ?? 1) * VOYAGE_CONFIG.TAVERN_MEAL_COST_PER_CREW * (1 - tavernLevel * 0.04)))
  const tavernRoundsCost = Math.max(60, Math.ceil(VOYAGE_CONFIG.TAVERN_ROUND_BASE_COST * (1 + (activeShip?.maxCrew ?? 1) * 0.04) * (1 - tavernLevel * 0.03)))
  const tavernRecruitUnitCost = Math.max(10, 18 - tavernLevel * VOYAGE_CONFIG.TAVERN_RECRUIT_DISCOUNT_PER_LEVEL)
  const captainLevel = Math.max(player?.stats.tradeLevel ?? 0, player?.stats.combatLevel ?? 0, player?.stats.adventureLevel ?? 0)
  const ownedShipTypeIds = new Set(ships.map((ship) => ship.typeId))
  const shipyardOffers = shipCatalog.filter((ship) => !ownedShipTypeIds.has(ship.id)).sort((a, b) => a.requiredLevel - b.requiredLevel || a.price - b.price)
  const riggingLevel = activeShip?.upgrades?.rigging ?? 0
  const cargoLevel = activeShip?.upgrades?.cargo ?? 0
  const gunneryLevel = activeShip?.upgrades?.gunnery ?? 0
  const outfitCost = (option: 'rigging' | 'cargo' | 'gunnery', level: number) => OUTFIT_BASE_COST[option] + level * OUTFIT_STEP[option]
  const outfitLocked = (optionLevel: number) => optionLevel >= OUTFIT_MAX_LEVEL
  const loadRatio = activeShip ? activeShip.usedCapacity / Math.max(1, activeShip.maxCapacity) : 0

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>{uiText.town.labels.portOfCall}</p>
            <h2 style={styles.title}>{port.name}</h2>
            <p style={styles.subtitle}>{port.nameEn} / {port.culture} / 税率 {(port.taxRate * 100).toFixed(0)}%</p>
          </div>
          <div style={styles.heroActions}>
            <button style={styles.secondaryButton} onClick={onManualSave}>{uiText.town.labels.manualSave}</button>
            <button style={styles.secondaryButton} onClick={onLoadLatest}>{uiText.town.labels.loadLatest}</button>
          </div>
        </div>

        <div style={styles.statStrip}>
          <div style={styles.statCard}><span style={styles.statLabel}>{uiText.town.labels.money}</span><strong>{player?.money ?? 0} d</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>{uiText.town.labels.ship}</span><strong>{shipType?.name ?? activeShip?.name ?? uiText.town.labels.none}</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>{uiText.town.labels.cargo}</span><strong>{cargoUsage}</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>{uiText.town.labels.crew}</span><strong>{activeShip?.currentCrew ?? 0}/{activeShip?.maxCrew ?? 0}</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>{uiText.town.labels.morale}</span><strong>{formatMorale(activeShip?.morale)}</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>{uiText.town.labels.supplies}</span><strong>食 {activeShip?.supplies.food.toFixed(0) ?? 0} / 水 {activeShip?.supplies.water.toFixed(0) ?? 0}</strong></div>
        </div>

        <section style={styles.questBanner}>
          <div style={styles.questBannerHeader}>
            <div>
              <p style={styles.bannerLabel}>{uiText.town.labels.activeQuest}</p>
              <strong>{activeQuest?.title ?? uiText.town.labels.noActiveQuest}</strong>
            </div>
            {activeQuest && <span style={styles.bannerMeta}>{formatQuestCategory(questCategory)} / {formatQuestRank(activeQuest.rank)} / {activeQuestDaysRemaining ?? '-'} {uiText.town.labels.daysLeft}</span>}
          </div>
          {!activeQuest && <p style={styles.bannerText}>ギルド依頼を受けると、ここに進行状況がまとまって表示されます。</p>}
          {activeQuest && (
            <>
              <div style={styles.bannerFacts}>
                <span>{questDestination?.name ?? '-'} {uiText.town.labels.routeArrow} {questReportPort?.name ?? '-'}</span>
                <span>{questGood?.name ?? '-'} x {activeQuest.metadata?.quantity ?? 0}</span>
                <span>{rewardSummary}</span>
              </div>
              <div style={styles.bannerFacts}>
                {activeQuest.objectives.map((objective) => <span key={`${activeQuest.id}-${objective.type}`}>{objective.current}/{objective.count} {formatObjectiveLabel(objective.type)}</span>)}
              </div>
              <div style={styles.bannerActions}>
                {(questCategory === 'trade_delivery' || questCategory === 'trade_procurement') && (
                  <button style={styles.secondaryButton} disabled={!canDeliverQuest} onClick={() => handleAction(deliverTradeQuestCargo())}>{getQuestActionLabel(questCategory)}</button>
                )}
                <button style={styles.primaryButton} disabled={!canReportQuest} onClick={() => handleAction(turnInQuest())}>{uiText.town.labels.reportComplete}</button>
              </div>
            </>
          )}
        </section>

        {notice && <div style={styles.notice}>{notice}</div>}

        <div style={styles.shell}>
          <aside style={styles.sidebar}>
            {availableSections.map((section) => (
              <button key={section} style={section === activeSection ? { ...styles.navButton, ...styles.navButtonActive } : styles.navButton} onClick={() => setActiveSection(section)}>
                {SECTION_LABELS[section]}
              </button>
            ))}
            <div style={styles.sidebarMeta}>
              <span>{uiText.town.labels.facilities}</span>
              <div style={styles.facilities}>{facilities.map((facility) => <span key={facility.type} style={styles.facilityChip}>{uiText.town.facilityNames[facility.type as keyof typeof uiText.town.facilityNames] ?? facility.type} Lv.{facility.level}</span>)}</div>
            </div>
          </aside>

          <main style={styles.content}>
            {visibleSection === 'overview' && (
              <div style={styles.contentStack}>
                <section style={{ ...styles.panel, ...styles.overviewHero }}>
                  <div style={styles.overviewCopy}>
                    <p style={styles.overviewEyebrow}>{uiText.town.labels.harborView}</p>
                    <h3 style={styles.overviewTitle}>{port.name} に停泊中</h3>
                    <p style={styles.overviewText}>ここは将来、街の2Dビジュアルや3D移動を載せるための導入画面です。今は必要最小限の港情報だけを表示しています。</p>
                  </div>
                  <div style={styles.overviewFacts}>
                    <div style={styles.infoBlock}><span style={styles.infoLabel}>{uiText.town.labels.port}</span><strong>{port.nationality} / 発展度 {port.prosperity}</strong><small>{summarizeFacilities(facilities)}</small></div>
                    <div style={styles.infoBlock}><span style={styles.infoLabel}>{uiText.town.labels.captain}</span><strong>{player?.name ?? uiText.town.labels.unknown}</strong><small>交易経験 {player?.stats.tradeExp ?? 0} / 名声 {player?.stats.fame ?? 0}</small></div>
                    <div style={styles.infoBlock}><span style={styles.infoLabel}>{uiText.town.labels.ship}</span><strong>{shipType?.name ?? activeShip?.name ?? uiText.town.labels.none}</strong><small>耐久 {activeShip?.currentDurability ?? 0}/{activeShip?.maxDurability ?? 0} / 士気 {formatMorale(activeShip?.morale)}</small></div>
                  </div>
                </section>
              </div>
            )}

            {visibleSection === 'guild' && hasGuild && (
              <div style={styles.contentStack}>
                <section style={styles.panel}>
                  <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>{uiText.town.labels.guildBoard}</h3><span style={styles.panelHint}>条件と報酬を圧縮表示</span></div>
                  <div style={styles.list}>
                    {availableQuests.map((quest) => {
                      const daysRemaining = getDaysRemaining(quest, day)
                      return (
                        <div key={quest.id} style={styles.compactActionRow}>
                          <div style={styles.tradeMeta}>
                            <strong>{quest.title}</strong>
                            <span style={styles.tradeSub}>{formatQuestCategory(quest.metadata?.category)} / {formatQuestRank(quest.rank)} / 名声 {quest.requiredFame ?? 0} / 必要Lv {quest.requiredLevel ?? 1} / 残り {daysRemaining ?? '-'} 日</span>
                            <span style={styles.tradeSub}>{quest.rewards.map(formatReward).join(' / ')}</span>
                          </div>
                          <button style={styles.primaryButton} disabled={Boolean(activeQuest)} onClick={() => handleAction(acceptQuest(quest.id, port.id))}>受注する</button>
                        </div>
                      )
                    })}
                    {availableQuests.length === 0 && <div style={styles.emptyState}>本日の新規クエストはありません。</div>}
                  </div>
                </section>
              </div>
            )}

            {visibleSection === 'departure' && (
              <div style={styles.contentStack}>
                <section style={{ ...styles.panel, ...styles.featurePanel }}>
                  <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>{uiText.town.labels.shipMaintenance}</h3><span style={styles.panelHint}>補給と修理を済ませてから出航</span></div>
                  <div style={styles.serviceColumns}>
                    <div style={styles.featureBanner}>
                      <span style={shipyardFacility ? styles.featureBadge : styles.featureBadgeMuted}>{shipyardFacility ? uiText.town.labels.shipyard : uiText.town.labels.workshop}</span>
                      <div>
                        <strong>{shipyardFacility ? `${uiText.town.labels.shipyard} Lv.${shipyardLevel}` : uiText.town.labels.emergencyWorkshop}</strong>
                        <div style={styles.featureText}>{shipyardFacility ? '通常修理とオーバーホールが利用できます。' : 'この港では応急修理のみ可能です。'}</div>
                      </div>
                    </div>
                    <div style={styles.infoGridCompact}>
                      <div style={styles.infoBlock}><span style={styles.infoLabel}>{uiText.town.labels.supplies}</span><strong>{activeShip?.supplies.food.toFixed(0) ?? 0} / {activeShip?.supplies.water.toFixed(0) ?? 0}</strong><small>{SUPPLY_STEP} 単位補給または満タン補給</small></div>
                      <div style={styles.infoBlock}><span style={styles.infoLabel}>{uiText.nav.durability}</span><strong>{activeShip?.currentDurability ?? 0} / {activeShip?.maxDurability ?? 0}</strong><small>{shipyardFacility ? `${uiText.town.labels.shipyard} Lv.${shipyardLevel}` : '簡易工房のみ'}</small></div>
                    </div>
                    <div>
                      <p style={styles.serviceLabel}>{uiText.town.labels.suppliesAction}</p>
                      <div style={styles.serviceGrid}>
                        <button style={styles.secondaryButton} onClick={() => handleAction(resupplyShip('food', SUPPLY_STEP))}>食料 +{SUPPLY_STEP}</button>
                        <button style={styles.secondaryButton} onClick={() => handleAction(resupplyShip('water', SUPPLY_STEP))}>水 +{SUPPLY_STEP}</button>
                        <button style={styles.primaryButton} onClick={() => handleAction(resupplyShip('all'))}>{uiText.town.labels.fullResupply}</button>
                      </div>
                    </div>
                    <div>
                      <p style={styles.serviceLabel}>{uiText.town.labels.repair}</p>
                      <div style={styles.serviceGrid}>
                        <button style={styles.secondaryButton} disabled={missingDurability <= 0} onClick={() => handleAction(repairShip('emergency', emergencyPreview || undefined, shipyardLevel))}>応急修理 {emergencyRepairCost} d</button>
                        {shipyardFacility && standardRepairPreview.map(({ amount, cost }) => <button key={`repair-${amount}`} style={styles.secondaryButton} disabled={missingDurability <= 0} onClick={() => handleAction(repairShip('standard', amount, shipyardLevel))}>{uiText.town.labels.repair} {amount} {cost} d</button>)}
                        {shipyardFacility && <button style={styles.primaryButton} disabled={missingDurability <= 0} onClick={() => handleAction(repairShip('overhaul', undefined, shipyardLevel))}>{uiText.town.labels.overhaul} {overhaulCost} d</button>}
                      </div>
                      <div style={styles.serviceNote}>{shipyardFacility ? 'オーバーホールは耐久を全快し、消耗の蓄積も整えます。' : '造船所がない港では応急修理のみ可能です。'}</div>
                    </div>
                    <div style={styles.departRow}>
                      <button style={styles.leaveButton} onClick={() => {
                        const nav = useNavigationStore.getState()
                        nav.departPort(nav.heading)
                        setPhase('playing')
                      }}>{uiText.town.labels.depart}</button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {visibleSection === 'market' && hasMarket && (
              <div style={styles.contentStack}>
                <div style={styles.twoCol}>
                  <section style={styles.panel}>
                    <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>{uiText.town.labels.buy}</h3><span style={styles.panelHint}>1行で判断できる形</span></div>
                    <div style={styles.list}>
                      {marketRows.map(({ item, good, quantity, quote, limit }) => {
                        const totalWeight = good.weight * quantity
                        const purchaseCap = Math.max(0, Math.min(item.stock, limit))
                        const exceedsCap = quantity > purchaseCap && purchaseCap > 0
                        return (
                          <div key={good.id} style={styles.marketRowDense}>
                            <div style={styles.tradeMeta}>
                              <strong>{good.name}</strong>
                              <span style={styles.tradeSub}>{quote?.unitPrice ?? item.currentPrice} d / 在庫 {item.stock} / 上限 {limit} / {item.trend}</span>
                              {purchaseCap <= 0 && <span style={styles.tradeBlocked}>この港では今日はこれ以上買えません。</span>}
                              {exceedsCap && <span style={styles.tradeBlocked}>数量が購入上限を超えています。</span>}
                            </div>
                            <div style={styles.tradeControlsDense}>
                              <input type="number" min={1} max={Math.max(1, purchaseCap)} value={quantity} onChange={(e) => setQuantity(good.id, Number(e.target.value))} style={styles.quantityInput} disabled={purchaseCap <= 0} />
                              <span style={styles.compactFigure}>{quote?.totalPrice ?? item.currentPrice} d</span>
                              <span style={styles.compactFigure}>積載 {totalWeight.toFixed(1)}</span>
                              <button style={styles.primaryButton} disabled={purchaseCap <= 0 || exceedsCap} onClick={() => handleAction(buyGood(port.id, good.id, quantity))}>{uiText.town.labels.buyAction}</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  <section style={styles.panel}>
                    <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>{uiText.town.labels.sell}</h3><span style={styles.panelHint}>利益が見える形</span></div>
                    <div style={styles.list}>
                      {cargoRows.length === 0 && <div style={styles.emptyState}>積荷はまだありません。</div>}
                      {cargoRows.map(({ slot, good, quantity, quote }) => {
                        const estimatedProfit = quote ? (quote.unitPrice - slot.buyPrice) * quantity : 0
                        return (
                          <div key={good.id} style={styles.marketRowDense}>
                            <div style={styles.tradeMeta}>
                              <strong>{good.name}</strong>
                              <span style={styles.tradeSub}>所持 {slot.quantity} / 売値 {quote?.unitPrice ?? 0} d / 利益 {estimatedProfit >= 0 ? '+' : ''}{estimatedProfit} d</span>
                            </div>
                            <div style={styles.tradeControlsDense}>
                              <input type="number" min={1} max={slot.quantity} value={quantity} onChange={(e) => setQuantity(good.id, Number(e.target.value))} style={styles.quantityInput} />
                              <span style={styles.compactFigure}>{quote?.totalPrice ?? 0} d</span>
                              <span style={styles.compactFigure}>積載 {(good.weight * quantity).toFixed(1)}</span>
                              <button style={styles.secondaryButton} onClick={() => handleAction(sellGood(port.id, good.id, quantity))}>売却</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {visibleSection === 'tavern' && tavernFacility && (
              <div style={styles.contentStack}>
                <section style={{ ...styles.panel, ...styles.featurePanel }}>
                  <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>{uiText.town.labels.tavern}</h3><span style={styles.panelHint}>士気と雇用</span></div>
                  <div style={styles.serviceColumns}>
                    <div style={styles.featureBanner}>
                      <span style={styles.featureBadge}>{uiText.town.labels.tavern}</span>
                      <div>
                        <strong>{uiText.town.labels.tavern} Lv.{tavernLevel}</strong>
                        <div style={styles.featureText}>士気 {getMoraleTone(activeShip?.morale)} / 新規雇用 {tavernRecruitUnitCost} d</div>
                      </div>
                    </div>
                    <div style={styles.infoGridCompact}>
                      <div style={styles.infoBlock}><span style={styles.infoLabel}>{uiText.town.labels.mood}</span><strong>{formatMorale(activeShip?.morale)}</strong><small>食事で小回復 / 景気づけで大回復</small></div>
                      <div style={styles.infoBlock}><span style={styles.infoLabel}>雇用単価</span><strong>{tavernRecruitUnitCost} d / 人</strong><small>酒場 Lv.{tavernLevel} の割引を反映</small></div>
                    </div>
                    <div>
                      <p style={styles.serviceLabel}>士気回復</p>
                      <div style={styles.serviceGrid}>
                        <button style={styles.secondaryButton} onClick={() => handleAction(visitTavern('meal', undefined, tavernLevel))}>船員に食事 {tavernMealCost} d</button>
                        <button style={styles.primaryButton} onClick={() => handleAction(visitTavern('rounds', undefined, tavernLevel))}>景気づけ {tavernRoundsCost} d</button>
                      </div>
                    </div>
                    <div>
                      <p style={styles.serviceLabel}>船員雇用</p>
                      <div style={styles.serviceGrid}>
                        {CREW_HIRE_AMOUNTS.map((amount) => <button key={`crew-${amount}`} style={styles.secondaryButton} onClick={() => handleAction(visitTavern('recruit', amount, tavernLevel))}>{amount} 人雇う</button>)}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {visibleSection === 'shipyard' && shipyardFacility && (
              <div style={styles.contentStack}>
                <section style={styles.panel}>
                  <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>{uiText.town.labels.shipyard}</h3><span style={styles.panelHint}>購入と旗艦切替</span></div>
                  <div style={styles.contentStack}>
                      <div>
                        <p style={styles.serviceLabel}>{uiText.town.labels.ownedShips}</p>
                        <div style={styles.list}>
                          {ships.map((ship) => {
                            const type = getShip(ship.typeId)
                            const isActive = ship.instanceId === activeShipId
                            return (
                              <div key={ship.instanceId} style={styles.compactActionRow}>
                                <div style={styles.tradeMeta}>
                                  <strong>{type?.name ?? ship.name}{isActive ? ` / ${uiText.town.labels.active}` : ''}</strong>
                                  <span style={styles.tradeSub}>船員 {ship.currentCrew}/{ship.maxCrew} / 船体 {ship.currentDurability}/{ship.maxDurability} / 積荷 {ship.usedCapacity}/{ship.maxCapacity}</span>
                                  <span style={styles.tradeSub}>速力 {type?.speed ?? '-'} / 旋回 {type?.turnRate ?? '-'} / 砲門 {type?.cannonSlots ?? '-'}</span>
                                </div>
                                <button style={isActive ? styles.secondaryButton : styles.primaryButton} disabled={isActive} onClick={() => { setActiveShip(ship.instanceId); handleAction({ message: `${type?.name ?? ship.name} を旗艦に設定しました。` }) }}>{uiText.town.labels.setActive}</button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <p style={styles.serviceLabel}>{uiText.town.labels.shipyardOffers}</p>
                          <div style={styles.list}>
                            {shipyardOffers.length === 0 && <div style={styles.emptyState}>現在購入できる未保有船はありません。</div>}
                            {shipyardOffers.map((ship) => {
                              const requiredFacility = getShipyardRequirement(ship.category)
                              const blockedByLevel = captainLevel < ship.requiredLevel
                              const blockedByFacility = shipyardLevel < requiredFacility
                            return (
                              <div key={ship.id} style={styles.compactActionRow}>
                                <div style={styles.tradeMeta}>
                                  <strong>{ship.name}</strong>
                                  <span style={styles.tradeSub}>{ship.price} d / 必要Lv {ship.requiredLevel} / 造船所Lv {requiredFacility}</span>
                                  <span style={styles.tradeSub}>積載 {ship.capacity} / 船体 {ship.durability.max} / 船員 {ship.crew.min}-{ship.crew.max} / 砲門 {ship.cannonSlots} / 速力 {ship.speed}</span>
                                  {(blockedByLevel || blockedByFacility) && <span style={styles.tradeBlocked}>{blockedByLevel ? 'レベル不足' : '造船所レベル不足'}</span>}
                                </div>
                                <button style={styles.primaryButton} disabled={blockedByLevel || blockedByFacility || (player?.money ?? 0) < ship.price} onClick={() => handleAction(purchaseShip(ship.id, shipyardLevel))}>{uiText.town.labels.buyAction}</button>
                              </div>
                              )
                            })}
                          </div>
                            <div style={styles.outfitPanel}>
                              <div style={styles.outfitHeader}>
                                <span>{uiText.town.labels.outfitting}</span>
                                <span>帆装 Lv {riggingLevel} / 船倉 Lv {cargoLevel} / 砲装 Lv {gunneryLevel}</span>
                              </div>
                              <div style={styles.outfitSummary}>
                                <span>{uiText.town.labels.currentBonus}: 速力 +{riggingLevel * 4}% / 旋回 +{riggingLevel * 6}%</span>
                                <span>{uiText.town.labels.loadState}: {(loadRatio * 100).toFixed(0)}% / 船倉補強 Lv {cargoLevel}</span>
                                <span>{uiText.town.labels.batteryDrill}: 砲撃 +{gunneryLevel * 8}% / 白兵圧 +{gunneryLevel * 4}%</span>
                              </div>
                              <div style={styles.outfitGrid}>
                                {OUTFIT_OPTIONS.map((option) => {
                                const level = option.option === 'rigging' ? riggingLevel : option.option === 'cargo' ? cargoLevel : gunneryLevel
                                const cost = outfitCost(option.option, level)
                                const isMaxed = outfitLocked(level)
                                const disabled = !activeShip || isMaxed || (player?.money ?? 0) < cost
                                return (
                                  <div key={option.option} style={styles.outfitCard}>
                                    <strong>{option.label}</strong>
                                    <span style={styles.outfitNote}>{option.description}</span>
                                    <span style={styles.outfitMeta}>{isMaxed ? uiText.town.labels.maxed : `費用 ${cost} d / Lv ${level + 1}`}</span>
                                    <button style={styles.primaryButton} disabled={disabled} onClick={() => handleAction(outfitShip(option.option))}>
                                      {isMaxed ? uiText.town.labels.maxed : uiText.town.labels.apply}
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                    </div>
                </section>
              </div>
            )}

            {visibleSection === 'bank' && hasBank && (
              <div style={styles.contentStack}>
                <section style={styles.panel}>
                  <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>{uiText.town.labels.financeAndInvestment}</h3><span style={styles.panelHint}>港でまとめて済ませる</span></div>
                  <div style={styles.serviceColumns}>
                    <div>
                      <p style={styles.serviceLabel}>{uiText.town.labels.investment}</p>
                      <div style={styles.serviceGrid}>{INVEST_AMOUNTS.map((amount) => <button key={amount} style={styles.secondaryButton} onClick={() => handleAction(investInPort(port.id, amount))}>{amount} {uiText.town.labels.investAction}</button>)}</div>
                    </div>
                    <div>
                      <p style={styles.serviceLabel}>{uiText.town.labels.bank}</p>
                      <div style={styles.serviceGrid}>
                        {BANK_AMOUNTS.map((amount) => <button key={`d-${amount}`} style={styles.secondaryButton} onClick={() => handleAction(depositMoney(amount))}>{amount} {uiText.town.labels.deposit}</button>)}
                        {BANK_AMOUNTS.map((amount) => <button key={`w-${amount}`} style={styles.secondaryButton} onClick={() => handleAction(withdrawMoney(amount))}>{amount} {uiText.town.labels.withdraw}</button>)}
                        {BANK_AMOUNTS.map((amount) => <button key={`b-${amount}`} style={styles.secondaryButton} onClick={() => handleAction(borrowMoney(amount))}>{amount} {uiText.town.labels.borrow}</button>)}
                        {BANK_AMOUNTS.map((amount) => <button key={`r-${amount}`} style={styles.secondaryButton} onClick={() => handleAction(repayDebt(amount))}>{amount} {uiText.town.labels.repay}</button>)}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}
            {visibleSection === 'inventory' && (
              <div style={styles.contentStack}>
                <section style={styles.panel}>
                  <div style={styles.panelHeader}>
                    <h3 style={styles.sectionTitle}>{uiText.town.labels.inventory}</h3>
                    <span style={styles.panelHint}>クエスト報酬や保管品を確認・売却</span>
                  </div>
                  {inventoryRows.length === 0 ? (
                    <div style={styles.emptyState}>保管中のアイテムはありません。</div>
                  ) : (
                    <>
                      <div style={styles.infoBlock}>
                        <span style={styles.infoLabel}>{uiText.town.labels.totalValue}</span>
                        <strong>{inventoryTotalValue} d</strong>
                        <small>78% の価格で即時入金されます。</small>
                      </div>
                      <div style={styles.list}>
                        {inventoryRows.map((entry) => (
                          <div key={entry.itemId} style={styles.compactActionRow}>
                            <div style={styles.tradeMeta}>
                              <strong>{entry.name}</strong>
                              <span style={styles.tradeSub}>{entry.description}</span>
                              <span style={styles.tradeSub}>x{entry.quantity} / 単価 {entry.unitValue} d / 合計 {entry.totalValue} d</span>
                            </div>
                            <button style={styles.primaryButton} onClick={() => handleAction(sellInventoryItem(entry.itemId, entry.quantity, entry.unitValue))}>
                              {uiText.town.labels.sellAll}
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              </div>
            )}
            </main>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, rgba(6,15,28,0.96), rgba(17,30,50,0.98))', zIndex: 700, padding: 24 },
  card: { width: 'min(1240px, 100%)', maxHeight: '100%', overflow: 'auto', padding: 24, borderRadius: 28, background: 'linear-gradient(180deg, rgba(8,18,32,0.96), rgba(11,24,42,0.98))', color: '#edf3fb', border: '1px solid rgba(128, 176, 222, 0.22)', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' },
  hero: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, marginBottom: 16 },
  eyebrow: { margin: 0, color: '#7fb6f5', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em' },
  title: { margin: '6px 0 0', fontSize: 36 },
  subtitle: { margin: '8px 0 0', color: '#96b2d6' },
  heroActions: { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  statStrip: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 },
  statCard: { padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 4 },
  statLabel: { color: '#89a6c9', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em' },
  questBanner: { padding: 16, borderRadius: 18, background: 'linear-gradient(135deg, rgba(27,64,115,0.32), rgba(10,34,63,0.4))', border: '1px solid rgba(102, 167, 235, 0.2)', marginBottom: 16 },
  questBannerHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' },
  bannerLabel: { margin: 0, color: '#8cbaf0', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em' },
  bannerMeta: { color: '#c8ddf6', fontSize: 12 },
  bannerText: { margin: '8px 0 0', color: '#d9e6f7' },
  bannerFacts: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, color: '#9bb7d9', fontSize: 12 },
  bannerActions: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  notice: { marginBottom: 16, padding: '10px 12px', borderRadius: 12, background: 'rgba(37, 99, 235, 0.16)', color: '#dbeafe' },
  shell: { display: 'grid', gridTemplateColumns: '210px minmax(0, 1fr)', gap: 16 },
  sidebar: { padding: 14, borderRadius: 18, background: 'rgba(255,255,255,0.035)', display: 'flex', flexDirection: 'column', gap: 8, alignSelf: 'start', position: 'sticky', top: 0 },
  navButton: { padding: '11px 12px', textAlign: 'left', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#d8e5f6', cursor: 'pointer' },
  navButtonActive: { background: 'linear-gradient(135deg, rgba(37,99,235,0.7), rgba(14,165,233,0.45))', border: '1px solid rgba(91, 178, 255, 0.35)' },
  sidebarMeta: { marginTop: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8, color: '#9db7d8', fontSize: 12 },
  content: { minWidth: 0 },
  contentStack: { display: 'flex', flexDirection: 'column', gap: 16 },
  panel: { padding: 16, borderRadius: 18, background: 'rgba(255,255,255,0.04)' },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 },
  sectionTitle: { margin: 0, fontSize: 15 },
  panelHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 10 },
  panelHint: { color: '#8ca4c4', fontSize: 12 },
  infoGridCompact: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 },
  infoBlock: { display: 'flex', flexDirection: 'column', gap: 4, padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.03)' },
  infoLabel: { color: '#8ca4c4', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' },
  facilities: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  facilityChip: { padding: '6px 9px', borderRadius: 999, background: 'rgba(57, 116, 184, 0.26)', color: '#dbeafe', fontSize: 11 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  denseList: { display: 'flex', flexDirection: 'column', gap: 2 },
  denseRow: { display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  inlineMeta: { display: 'block', color: '#89a6c9', fontSize: 11, marginTop: 2 },
  compactActionRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.035)' },
  tradeMeta: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  tradeSub: { color: '#93a8c4', fontSize: 12 },
  marketRowDense: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.035)' },
  tradeControlsDense: { display: 'flex', alignItems: 'center', gap: 8 },
  quantityInput: { width: 60, padding: '7px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: '#fff' },
  compactFigure: { minWidth: 72, textAlign: 'right', color: '#eef4ff', fontSize: 12 },
  emptyState: { color: '#7b8fab', fontSize: 13, padding: '14px 4px' },
  serviceGrid: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  serviceColumns: { display: 'grid', gridTemplateColumns: '1fr', gap: 16 },
  departRow: { display: 'flex', justifyContent: 'flex-end', paddingTop: 4 },
  featurePanel: { border: '1px solid rgba(112, 170, 228, 0.16)', background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.035))' },
  featureBanner: { display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, background: 'linear-gradient(135deg, rgba(29,78,216,0.18), rgba(14,165,233,0.10))', border: '1px solid rgba(112, 170, 228, 0.16)' },
  featureBadge: { padding: '6px 10px', borderRadius: 999, background: 'rgba(37, 99, 235, 0.7)', color: '#fff', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' },
  featureBadgeMuted: { padding: '6px 10px', borderRadius: 999, background: 'rgba(148, 163, 184, 0.25)', color: '#d8e5f6', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' },
  featureText: { color: '#9cc0e6', fontSize: 12, marginTop: 3 },
  serviceLabel: { margin: '0 0 8px', color: '#9db7d8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em' },
  serviceNote: { color: '#8ca4c4', fontSize: 12 },
  leaveButton: { padding: '11px 15px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' },
  primaryButton: { padding: '11px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #2563eb, #0ea5e9)', color: '#fff', cursor: 'pointer' },
  secondaryButton: { padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer' },
  outfitPanel: { marginTop: 12, padding: 14, borderRadius: 16, border: '1px solid rgba(148, 163, 184, 0.25)', background: 'rgba(15, 23, 42, 0.8)' },
  outfitHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, color: '#cfd8ff', fontSize: 13 },
  outfitSummary: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10, color: '#9fb2d0', fontSize: 12 },
  outfitGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 },
  outfitCard: { padding: 10, borderRadius: 12, border: '1px solid rgba(148, 163, 184, 0.35)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: 6 },
  outfitNote: { fontSize: 11, color: '#8aa0c4' },
  outfitMeta: { fontSize: 12, color: '#dbeafe' },
}












