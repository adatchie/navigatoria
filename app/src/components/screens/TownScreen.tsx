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

interface TownScreenProps {
  onManualSave: () => void
  onLoadLatest: () => void
}

type TownSection = 'overview' | 'guild' | 'market' | 'services' | 'inventory'

const INVEST_AMOUNTS = [1000, 5000]
const BANK_AMOUNTS = [1000, 5000]
const CREW_HIRE_AMOUNTS = [1, 5, 10]
const REPAIR_AMOUNTS = [10, 30]
const SUPPLY_STEP = 12
const SECTION_LABELS: Record<TownSection, string> = {
  overview: 'Overview',
  guild: 'Guild',
  market: 'Market',
  services: 'Services',
  inventory: 'Inventory',
}

const INVENTORY_SELL_FACTOR = 0.78
const OUTFIT_OPTIONS = [
  { option: 'rigging' as const, label: 'Rigging Tune', description: 'Hull耐久と士気が微増' },
  { option: 'cargo' as const, label: 'Cargo Rig', description: 'Cargo容量＋6' },
]
const OUTFIT_BASE_COST = { rigging: 320, cargo: 280 }
const OUTFIT_STEP = { rigging: 90, cargo: 70 }
const OUTFIT_MAX_LEVEL = 3

function formatQuestRank(rank?: QuestRank): string {
  if (rank === 'premium') return 'Premium'
  if (rank === 'urgent') return 'Urgent'
  return 'Standard'
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
  if (reward.type === 'fame') return `Fame +${reward.amount ?? 0}`
  if (reward.type === 'influence') return `${reward.portId ?? 'port'} +${reward.amount ?? 0}`
  if (reward.type === 'item') return `${reward.itemId ?? 'item'} x${reward.amount ?? 1}`
  return reward.type
}

function getQuestReportPortId(quest: Quest | null): string | undefined {
  return quest?.metadata?.reportPortId ?? quest?.metadata?.destinationPortId ?? quest?.giverPort
}

function getQuestActionLabel(category?: TradeQuestCategory): string {
  if (category === 'trade_procurement') return 'Deliver Purchased Goods'
  return 'Deliver Cargo'
}

function summarizeFacilities(facilities: { type: string; level: number }[]): string {
  return facilities.map((facility) => `${facility.type} Lv.${facility.level}`).join(' / ')
}

function formatMorale(morale?: number): string {
  if (morale == null) return '-'
  if (morale >= 80) return `${morale.toFixed(0)} high`
  if (morale >= 45) return `${morale.toFixed(0)} steady`
  return `${morale.toFixed(0)} low`
}

function getMoraleTone(morale?: number): string {
  if (morale == null) return 'Unknown'
  if (morale >= 80) return 'Excellent'
  if (morale >= 45) return 'Stable'
  return 'Low'
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
  const tavernFacility = facilities.find((facility) => facility.type === 'tavern')
  const shipyardFacility = facilities.find((facility) => facility.type === 'shipyard')
  const availableQuests = portId ? availableByPort[portId] ?? [] : []
  const hasGuild = facilities.some((facility) => facility.type === 'guild')
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
          description: good?.description ?? 'No description.',
        }
      })
      .filter((entry) => entry.quantity > 0)
      .sort((a, b) => b.totalValue - a.totalValue)
  }, [getTradeGood, player?.inventory])
  const inventoryTotalValue = inventoryRows.reduce((sum, entry) => sum + entry.totalValue, 0)

  if (!port) return <div style={styles.container}><div style={styles.card}>No port selected.</div></div>

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
  const visibleSection = activeSection === 'guild' && !hasGuild ? 'overview' : activeSection
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
  const outfitCost = (option: 'rigging' | 'cargo', level: number) => OUTFIT_BASE_COST[option] + level * OUTFIT_STEP[option]
  const outfitLocked = (optionLevel: number) => optionLevel >= OUTFIT_MAX_LEVEL

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>Port Of Call</p>
            <h2 style={styles.title}>{port.name}</h2>
            <p style={styles.subtitle}>{port.nameEn} / {port.culture} / tax {(port.taxRate * 100).toFixed(0)}%</p>
          </div>
          <div style={styles.heroActions}>
            <button style={styles.secondaryButton} onClick={onManualSave}>Manual Save</button>
            <button style={styles.secondaryButton} onClick={onLoadLatest}>Load Latest</button>
            <button style={styles.leaveButton} onClick={() => setPhase('playing')}>Back To Sea</button>
          </div>
        </div>

        <div style={styles.statStrip}>
          <div style={styles.statCard}><span style={styles.statLabel}>Money</span><strong>{player?.money ?? 0} d</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>Ship</span><strong>{shipType?.name ?? activeShip?.name ?? 'None'}</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>Cargo</span><strong>{cargoUsage}</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>Crew</span><strong>{activeShip?.currentCrew ?? 0}/{activeShip?.maxCrew ?? 0}</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>Morale</span><strong>{formatMorale(activeShip?.morale)}</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>Supplies</span><strong>F {activeShip?.supplies.food.toFixed(0) ?? 0} / W {activeShip?.supplies.water.toFixed(0) ?? 0}</strong></div>
        </div>

        <section style={styles.questBanner}>
          <div style={styles.questBannerHeader}>
            <div>
              <p style={styles.bannerLabel}>Active Quest</p>
              <strong>{activeQuest?.title ?? 'No active quest'}</strong>
            </div>
            {activeQuest && <span style={styles.bannerMeta}>{formatQuestCategory(questCategory)} / {formatQuestRank(activeQuest.rank)} / {activeQuestDaysRemaining ?? '-'} days left</span>}
          </div>
          {!activeQuest && <p style={styles.bannerText}>ギルド依頼を受けると、ここに進行状況がまとまって表示されます。</p>}
          {activeQuest && (
            <>
              <div style={styles.bannerFacts}>
                <span>{questDestination?.name ?? '-'} {' -> '} {questReportPort?.name ?? '-'}</span>
                <span>{questGood?.name ?? '-'} x {activeQuest.metadata?.quantity ?? 0}</span>
                <span>{rewardSummary}</span>
              </div>
              <div style={styles.bannerFacts}>
                {activeQuest.objectives.map((objective) => <span key={`${activeQuest.id}-${objective.type}`}>{objective.current}/{objective.count} {objective.type}</span>)}
              </div>
              <div style={styles.bannerActions}>
                {(questCategory === 'trade_delivery' || questCategory === 'trade_procurement') && (
                  <button style={styles.secondaryButton} disabled={!canDeliverQuest} onClick={() => handleAction(deliverTradeQuestCargo())}>{getQuestActionLabel(questCategory)}</button>
                )}
                <button style={styles.primaryButton} disabled={!canReportQuest} onClick={() => handleAction(turnInQuest())}>Report Complete</button>
              </div>
            </>
          )}
        </section>

        {notice && <div style={styles.notice}>{notice}</div>}

        <div style={styles.shell}>
          <aside style={styles.sidebar}>
            {(Object.keys(SECTION_LABELS) as TownSection[]).filter((section) => section !== 'guild' || hasGuild).map((section) => (
              <button key={section} style={section === activeSection ? { ...styles.navButton, ...styles.navButtonActive } : styles.navButton} onClick={() => setActiveSection(section)}>
                {SECTION_LABELS[section]}
              </button>
            ))}
            <div style={styles.sidebarMeta}>
              <span>Facilities</span>
              <div style={styles.facilities}>{facilities.map((facility) => <span key={facility.type} style={styles.facilityChip}>{facility.type} Lv.{facility.level}</span>)}</div>
            </div>
          </aside>

          <main style={styles.content}>
            {visibleSection === 'overview' && (
              <div style={styles.contentStack}>
                <section style={{ ...styles.panel, ...styles.overviewHero }}>
                  <div style={styles.overviewCopy}>
                    <p style={styles.overviewEyebrow}>Harbor View</p>
                    <h3 style={styles.overviewTitle}>{port.name} に停泊中</h3>
                    <p style={styles.overviewText}>ここは将来、街の2Dビジュアルや3D移動を載せるための導入画面です。今は必要最小限の港情報だけを表示しています。</p>
                  </div>
                  <div style={styles.overviewFacts}>
                    <div style={styles.infoBlock}><span style={styles.infoLabel}>Port</span><strong>{port.nationality} / prosperity {port.prosperity}</strong><small>{summarizeFacilities(facilities)}</small></div>
                    <div style={styles.infoBlock}><span style={styles.infoLabel}>Captain</span><strong>{player?.name ?? 'Unknown'}</strong><small>trade exp {player?.stats.tradeExp ?? 0} / fame {player?.stats.fame ?? 0}</small></div>
                    <div style={styles.infoBlock}><span style={styles.infoLabel}>Ship</span><strong>{shipType?.name ?? activeShip?.name ?? 'None'}</strong><small>durability {activeShip?.currentDurability ?? 0}/{activeShip?.maxDurability ?? 0} / morale {formatMorale(activeShip?.morale)}</small></div>
                  </div>
                </section>
              </div>
            )}

            {visibleSection === 'guild' && hasGuild && (
              <div style={styles.contentStack}>
                <section style={styles.panel}>
                  <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>Guild Board</h3><span style={styles.panelHint}>条件と報酬を圧縮表示</span></div>
                  <div style={styles.list}>
                    {availableQuests.map((quest) => {
                      const daysRemaining = getDaysRemaining(quest, day)
                      return (
                        <div key={quest.id} style={styles.compactActionRow}>
                          <div style={styles.tradeMeta}>
                            <strong>{quest.title}</strong>
                            <span style={styles.tradeSub}>{formatQuestCategory(quest.metadata?.category)} / {formatQuestRank(quest.rank)} / fame {quest.requiredFame ?? 0} / lv {quest.requiredLevel ?? 1} / {daysRemaining ?? '-'} days</span>
                            <span style={styles.tradeSub}>{quest.rewards.map(formatReward).join(' / ')}</span>
                          </div>
                          <button style={styles.primaryButton} disabled={Boolean(activeQuest)} onClick={() => handleAction(acceptQuest(quest.id, port.id))}>Accept</button>
                        </div>
                      )
                    })}
                    {availableQuests.length === 0 && <div style={styles.emptyState}>本日の新規クエストはありません。</div>}
                  </div>
                </section>
              </div>
            )}

            {visibleSection === 'market' && (
              <div style={styles.contentStack}>
                <div style={styles.twoCol}>
                  <section style={styles.panel}>
                    <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>Buy</h3><span style={styles.panelHint}>1行で判断できる形</span></div>
                    <div style={styles.list}>
                      {marketRows.map(({ item, good, quantity, quote, limit }) => {
                        const totalWeight = good.weight * quantity
                        const purchaseCap = Math.max(0, Math.min(item.stock, limit))
                        const exceedsCap = quantity > purchaseCap && purchaseCap > 0
                        return (
                          <div key={good.id} style={styles.marketRowDense}>
                            <div style={styles.tradeMeta}>
                              <strong>{good.name}</strong>
                              <span style={styles.tradeSub}>{quote?.unitPrice ?? item.currentPrice} d / stock {item.stock} / limit {limit} / {item.trend}</span>
                              {purchaseCap <= 0 && <span style={styles.tradeBlocked}>この港では今日はこれ以上買えません。</span>}
                              {exceedsCap && <span style={styles.tradeBlocked}>数量が購入上限を超えています。</span>}
                            </div>
                            <div style={styles.tradeControlsDense}>
                              <input type="number" min={1} max={Math.max(1, purchaseCap)} value={quantity} onChange={(e) => setQuantity(good.id, Number(e.target.value))} style={styles.quantityInput} disabled={purchaseCap <= 0} />
                              <span style={styles.compactFigure}>{quote?.totalPrice ?? item.currentPrice} d</span>
                              <span style={styles.compactFigure}>{totalWeight.toFixed(1)} cargo</span>
                              <button style={styles.primaryButton} disabled={purchaseCap <= 0 || exceedsCap} onClick={() => handleAction(buyGood(port.id, good.id, quantity))}>Buy</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  <section style={styles.panel}>
                    <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>Sell</h3><span style={styles.panelHint}>利益が見える形</span></div>
                    <div style={styles.list}>
                      {cargoRows.length === 0 && <div style={styles.emptyState}>積荷はまだありません。</div>}
                      {cargoRows.map(({ slot, good, quantity, quote }) => {
                        const estimatedProfit = quote ? (quote.unitPrice - slot.buyPrice) * quantity : 0
                        return (
                          <div key={good.id} style={styles.marketRowDense}>
                            <div style={styles.tradeMeta}>
                              <strong>{good.name}</strong>
                              <span style={styles.tradeSub}>have {slot.quantity} / sell {quote?.unitPrice ?? 0} d / profit {estimatedProfit >= 0 ? '+' : ''}{estimatedProfit} d</span>
                            </div>
                            <div style={styles.tradeControlsDense}>
                              <input type="number" min={1} max={slot.quantity} value={quantity} onChange={(e) => setQuantity(good.id, Number(e.target.value))} style={styles.quantityInput} />
                              <span style={styles.compactFigure}>{quote?.totalPrice ?? 0} d</span>
                              <span style={styles.compactFigure}>{(good.weight * quantity).toFixed(1)} cargo</span>
                              <button style={styles.secondaryButton} onClick={() => handleAction(sellGood(port.id, good.id, quantity))}>Sell</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {visibleSection === 'services' && (
              <div style={styles.contentStack}>
                <div style={styles.twoCol}>
                  <section style={{ ...styles.panel, ...styles.featurePanel }}>
                    <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>Tavern</h3><span style={styles.panelHint}>士気と雇用</span></div>
                    {tavernFacility ? (
                      <div style={styles.serviceColumns}>
                        <div style={styles.featureBanner}>
                          <span style={styles.featureBadge}>Open</span>
                          <div>
                            <strong>Harbor Tavern Lv.{tavernLevel}</strong>
                            <div style={styles.featureText}>士気 {getMoraleTone(activeShip?.morale)} / 新規雇用 {tavernRecruitUnitCost} d</div>
                          </div>
                        </div>
                        <div style={styles.infoGridCompact}>
                          <div style={styles.infoBlock}><span style={styles.infoLabel}>Mood</span><strong>{formatMorale(activeShip?.morale)}</strong><small>meal で小回復 / rounds で大回復</small></div>
                          <div style={styles.infoBlock}><span style={styles.infoLabel}>Recruitment</span><strong>{tavernRecruitUnitCost} d / crew</strong><small>酒場 Lv.{tavernLevel} の割引を反映</small></div>
                        </div>
                        <div>
                          <p style={styles.serviceLabel}>Morale Care</p>
                          <div style={styles.serviceGrid}>
                            <button style={styles.secondaryButton} onClick={() => handleAction(visitTavern('meal', undefined, tavernLevel))}>Crew Meal {tavernMealCost} d</button>
                            <button style={styles.primaryButton} onClick={() => handleAction(visitTavern('rounds', undefined, tavernLevel))}>Buy Rounds {tavernRoundsCost} d</button>
                          </div>
                        </div>
                        <div>
                          <p style={styles.serviceLabel}>Recruit</p>
                          <div style={styles.serviceGrid}>
                            {CREW_HIRE_AMOUNTS.map((amount) => <button key={`crew-${amount}`} style={styles.secondaryButton} onClick={() => handleAction(visitTavern('recruit', amount, tavernLevel))}>Hire {amount}</button>)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={styles.emptyState}>この港には酒場がありません。船員の士気調整と雇用はできません。</div>
                    )}
                  </section>

                  <section style={{ ...styles.panel, ...styles.featurePanel }}>
                    <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>Ship Maintenance</h3><span style={styles.panelHint}>補給と修理</span></div>
                    <div style={styles.serviceColumns}>
                      <div style={styles.featureBanner}>
                        <span style={shipyardFacility ? styles.featureBadge : styles.featureBadgeMuted}>{shipyardFacility ? 'Shipyard' : 'Workshop'}</span>
                        <div>
                          <strong>{shipyardFacility ? `Shipyard Lv.${shipyardLevel}` : 'Emergency Workshop'}</strong>
                          <div style={styles.featureText}>{shipyardFacility ? '通常修理とオーバーホールが利用できます。' : 'この港では応急修理のみ可能です。'}</div>
                        </div>
                      </div>
                      <div style={styles.infoGridCompact}>
                        <div style={styles.infoBlock}><span style={styles.infoLabel}>Supplies</span><strong>{activeShip?.supplies.food.toFixed(0) ?? 0} / {activeShip?.supplies.water.toFixed(0) ?? 0}</strong><small>{SUPPLY_STEP} 単位補給または満タン補給</small></div>
                        <div style={styles.infoBlock}><span style={styles.infoLabel}>Durability</span><strong>{activeShip?.currentDurability ?? 0} / {activeShip?.maxDurability ?? 0}</strong><small>{shipyardFacility ? `shipyard Lv.${shipyardLevel}` : '簡易工房のみ'}</small></div>
                      </div>
                      <div>
                        <p style={styles.serviceLabel}>Supplies</p>
                        <div style={styles.serviceGrid}>
                          <button style={styles.secondaryButton} onClick={() => handleAction(resupplyShip('food', SUPPLY_STEP))}>Food +{SUPPLY_STEP}</button>
                          <button style={styles.secondaryButton} onClick={() => handleAction(resupplyShip('water', SUPPLY_STEP))}>Water +{SUPPLY_STEP}</button>
                          <button style={styles.primaryButton} onClick={() => handleAction(resupplyShip('all'))}>Full Resupply</button>
                        </div>
                      </div>
                      <div>
                        <p style={styles.serviceLabel}>Repair</p>
                        <div style={styles.serviceGrid}>
                          <button style={styles.secondaryButton} disabled={missingDurability <= 0} onClick={() => handleAction(repairShip('emergency', emergencyPreview || undefined, shipyardLevel))}>Emergency Patch {emergencyRepairCost} d</button>
                          {shipyardFacility && standardRepairPreview.map(({ amount, cost }) => <button key={`repair-${amount}`} style={styles.secondaryButton} disabled={missingDurability <= 0} onClick={() => handleAction(repairShip('standard', amount, shipyardLevel))}>Repair {amount} {cost} d</button>)}
                          {shipyardFacility && <button style={styles.primaryButton} disabled={missingDurability <= 0} onClick={() => handleAction(repairShip('overhaul', undefined, shipyardLevel))}>Overhaul {overhaulCost} d</button>}
                        </div>
                        <div style={styles.serviceNote}>{shipyardFacility ? 'オーバーホールは耐久を全快し、消耗の蓄積も整えます。' : '造船所がない港では応急修理のみ可能です。'}</div>
                      </div>
                    </div>
                  </section>
                </div>


                <section style={styles.panel}>
                  <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>Shipyard</h3><span style={styles.panelHint}>購入と旗艦切替</span></div>
                  {!shipyardFacility && <div style={styles.emptyState}>この港では新造船の購入はできません。</div>}
                  {shipyardFacility && (
                    <div style={styles.contentStack}>
                      <div>
                        <p style={styles.serviceLabel}>Owned Ships</p>
                        <div style={styles.list}>
                          {ships.map((ship) => {
                            const type = getShip(ship.typeId)
                            const isActive = ship.instanceId === activeShipId
                            return (
                              <div key={ship.instanceId} style={styles.compactActionRow}>
                                <div style={styles.tradeMeta}>
                                  <strong>{type?.name ?? ship.name}{isActive ? ' / Active' : ''}</strong>
                                  <span style={styles.tradeSub}>crew {ship.currentCrew}/{ship.maxCrew} / hull {ship.currentDurability}/{ship.maxDurability} / cargo {ship.usedCapacity}/{ship.maxCapacity}</span>
                                  <span style={styles.tradeSub}>speed {type?.speed ?? '-'} / turn {type?.turnRate ?? '-'} / cannons {type?.cannonSlots ?? '-'}</span>
                                </div>
                                <button style={isActive ? styles.secondaryButton : styles.primaryButton} disabled={isActive} onClick={() => { setActiveShip(ship.instanceId); handleAction({ message: `${type?.name ?? ship.name} を旗艦に設定しました。` }) }}>Set Active</button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <p style={styles.serviceLabel}>Shipyard Offers</p>
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
                                  <span style={styles.tradeSub}>{ship.price} d / req lv {ship.requiredLevel} / shipyard lv {requiredFacility}</span>
                                  <span style={styles.tradeSub}>cargo {ship.capacity} / hull {ship.durability.max} / crew {ship.crew.min}-{ship.crew.max} / cannons {ship.cannonSlots} / speed {ship.speed}</span>
                                  {(blockedByLevel || blockedByFacility) && <span style={styles.tradeBlocked}>{blockedByLevel ? 'レベル不足' : '造船所レベル不足'}</span>}
                                </div>
                                <button style={styles.primaryButton} disabled={blockedByLevel || blockedByFacility || (player?.money ?? 0) < ship.price} onClick={() => handleAction(purchaseShip(ship.id, shipyardLevel))}>Buy</button>
                              </div>
                              )
                            })}
                          </div>
                          <div style={styles.outfitPanel}>
                            <div style={styles.outfitHeader}>
                              <span>Outfitting</span>
                              <span>Rigging Lv {riggingLevel} / Cargo Lv {cargoLevel}</span>
                            </div>
                            <div style={styles.outfitGrid}>
                              {OUTFIT_OPTIONS.map((option) => {
                                const level = option.option === 'rigging' ? riggingLevel : cargoLevel
                                const cost = outfitCost(option.option, level)
                                const isMaxed = outfitLocked(level)
                                const disabled = !activeShip || isMaxed || (player?.money ?? 0) < cost
                                return (
                                  <div key={option.option} style={styles.outfitCard}>
                                    <strong>{option.label}</strong>
                                    <span style={styles.outfitNote}>{option.description}</span>
                                    <span style={styles.outfitMeta}>{isMaxed ? 'Maxed' : `Cost ${cost} d / Lv ${level + 1}`}</span>
                                    <button style={styles.primaryButton} disabled={disabled} onClick={() => handleAction(outfitShip(option.option))}>
                                      {isMaxed ? 'Maxed' : 'Apply'}
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                    </div>
                  )}
                </section>
                <section style={styles.panel}>
                  <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>Finance & Investment</h3><span style={styles.panelHint}>港でまとめて済ませる</span></div>
                  <div style={styles.serviceColumns}>
                    <div>
                      <p style={styles.serviceLabel}>Investment</p>
                      <div style={styles.serviceGrid}>{INVEST_AMOUNTS.map((amount) => <button key={amount} style={styles.secondaryButton} onClick={() => handleAction(investInPort(port.id, amount))}>{amount} Invest</button>)}</div>
                    </div>
                    <div>
                      <p style={styles.serviceLabel}>Bank</p>
                      <div style={styles.serviceGrid}>
                        {BANK_AMOUNTS.map((amount) => <button key={`d-${amount}`} style={styles.secondaryButton} onClick={() => handleAction(depositMoney(amount))}>{amount} Deposit</button>)}
                        {BANK_AMOUNTS.map((amount) => <button key={`w-${amount}`} style={styles.secondaryButton} onClick={() => handleAction(withdrawMoney(amount))}>{amount} Withdraw</button>)}
                        {BANK_AMOUNTS.map((amount) => <button key={`b-${amount}`} style={styles.secondaryButton} onClick={() => handleAction(borrowMoney(amount))}>{amount} Borrow</button>)}
                        {BANK_AMOUNTS.map((amount) => <button key={`r-${amount}`} style={styles.secondaryButton} onClick={() => handleAction(repayDebt(amount))}>{amount} Repay</button>)}
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
                    <h3 style={styles.sectionTitle}>Inventory</h3>
                    <span style={styles.panelHint}>クエスト報酬や保管品を確認・売却</span>
                  </div>
                  {inventoryRows.length === 0 ? (
                    <div style={styles.emptyState}>保管中のアイテムはありません。</div>
                  ) : (
                    <>
                      <div style={styles.infoBlock}>
                        <span style={styles.infoLabel}>Total Value</span>
                        <strong>{inventoryTotalValue} d</strong>
                        <small>Sell は 78% の価格で即時入金されます。</small>
                      </div>
                      <div style={styles.list}>
                        {inventoryRows.map((entry) => (
                          <div key={entry.itemId} style={styles.compactActionRow}>
                            <div style={styles.tradeMeta}>
                              <strong>{entry.name}</strong>
                              <span style={styles.tradeSub}>{entry.description}</span>
                              <span style={styles.tradeSub}>x{entry.quantity} / {entry.unitValue} d each / {entry.totalValue} d total</span>
                            </div>
                            <button style={styles.primaryButton} onClick={() => handleAction(sellInventoryItem(entry.itemId, entry.quantity, entry.unitValue))}>
                              Sell All
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
  outfitGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 },
  outfitCard: { padding: 10, borderRadius: 12, border: '1px solid rgba(148, 163, 184, 0.35)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: 6 },
  outfitNote: { fontSize: 11, color: '#8aa0c4' },
  outfitMeta: { fontSize: 12, color: '#dbeafe' },
}












