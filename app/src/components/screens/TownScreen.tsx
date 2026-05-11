import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { useEconomyStore } from '@/stores/useEconomyStore.ts'
import { useQuestStore } from '@/stores/useQuestStore.ts'
import { VOYAGE_CONFIG } from '@/config/gameConfig.ts'
import { formatOfficerStats, getAssignedOfficer } from '@/game/officers/officerEffects.ts'
import { generateTavernOfficerOffers, getOfficerSpecialtyLabel, localizeOfficerName } from '@/game/officers/officerGenerator.ts'
import type { Officer, OfficerStats } from '@/types/character.ts'
import type { Quest, QuestRank, QuestReward, TradeQuestCategory } from '@/types/quest.ts'
import { uiText } from '@/i18n/uiText.ts'

interface TownScreenProps {
  onManualSave: () => void
  onLoadLatest: () => void
}

type TownSection = 'overview' | 'departure' | 'market' | 'guild' | 'tavern' | 'shipyard' | 'bank' | 'inventory'
type HireDialogueStep = 'player_line' | 'officer_line' | 'system_message'
type HireDialogueState = {
  officer: Officer
  step: HireDialogueStep
}
type CityHotspot = {
  section: TownSection
  label: string
  caption: string
  x: number
  y: number
  tone: string
  emblem: string
}

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
const PLAYER_PORTRAIT_URL = 'generated/portraits/player-diego.jpg'
const OFFICER_STAT_AXES: { key: keyof OfficerStats; label: string }[] = [
  { key: 'navigation', label: '航海' },
  { key: 'trade', label: '交易' },
  { key: 'gunnery', label: '砲術' },
  { key: 'repair', label: '修理' },
  { key: 'leadership', label: '統率' },
]
const LISBON_CITY_HOTSPOTS: CityHotspot[] = [
  { section: 'departure', label: '出航所', caption: '河岸の桟橋', x: 78, y: 72, tone: '#38bdf8', emblem: '⚓' },
  { section: 'market', label: '市場', caption: '港前広場', x: 38, y: 60, tone: '#f59e0b', emblem: '◇' },
  { section: 'guild', label: 'ギルド', caption: '商館街', x: 53, y: 49, tone: '#a78bfa', emblem: '✦' },
  { section: 'tavern', label: '酒場', caption: '坂道の路地', x: 63, y: 64, tone: '#fb7185', emblem: '♬' },
  { section: 'shipyard', label: '造船所', caption: '河口の船渠', x: 23, y: 72, tone: '#22c55e', emblem: '▱' },
  { section: 'bank', label: '銀行', caption: '城壁内の両替商', x: 55, y: 34, tone: '#facc15', emblem: '¤' },
  { section: 'inventory', label: '保管庫', caption: '倉庫街', x: 27, y: 48, tone: '#60a5fa', emblem: '□' },
]
const NATIONALITY_LABELS: Record<string, string> = {
  portugal: 'ポルトガル',
  spain: 'スペイン',
  england: 'イングランド',
  netherlands: 'ネーデルラント',
  france: 'フランス',
  venice: 'ヴェネツィア',
  ottoman: 'オスマン',
}

function formatNationalityLabel(nationality: string): string {
  return NATIONALITY_LABELS[nationality] ?? nationality
}

function formatOfficerName(officer: Officer): string {
  return localizeOfficerName(officer.name)
}

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

function formatQuestRequirement(value?: number): string {
  return value && value > 0 ? `${value}` : 'なし'
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

function getShipyardRequirement(category: string): number {
  if (category === 'small_sail') return 1
  if (category === 'medium_sail' || category === 'galley') return 2
  if (category === 'oriental') return 3
  return 4
}

function resolvePortraitUrl(url?: string): string {
  const fallback = 'generated/portraits/sample-navigator.jpg'
  const source = url || fallback
  if (/^(https?:|data:|blob:)/.test(source)) return source
  return `${import.meta.env.BASE_URL}${source.replace(/^\/+/, '')}`
}

function getRadarPoint(index: number, total: number, value: number, radius: number, center: number): string {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total
  const normalized = Math.max(0, Math.min(10, value)) / 10
  const x = center + Math.cos(angle) * radius * normalized
  const y = center + Math.sin(angle) * radius * normalized
  return `${x.toFixed(1)},${y.toFixed(1)}`
}

function OfficerRadarChart({ stats }: { stats: OfficerStats }) {
  const size = 148
  const center = size / 2
  const radius = 48
  const total = OFFICER_STAT_AXES.length
  const valuePoints = OFFICER_STAT_AXES.map((axis, index) => getRadarPoint(index, total, stats[axis.key], radius, center)).join(' ')
  const gridLevels = [0.25, 0.5, 0.75, 1]

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="航海士能力レーダーチャート" style={styles.officerRadar}>
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={OFFICER_STAT_AXES.map((_, index) => getRadarPoint(index, total, 10 * level, radius, center)).join(' ')}
          fill="none"
          stroke="rgba(148, 163, 184, 0.28)"
          strokeWidth="1"
        />
      ))}
      {OFFICER_STAT_AXES.map((axis, index) => {
        const axisPoint = getRadarPoint(index, total, 10, radius, center)
        const [x, y] = axisPoint.split(',').map(Number)
        const labelPoint = getRadarPoint(index, total, 12, radius, center)
        const [labelX, labelY] = labelPoint.split(',').map(Number)
        return (
          <g key={axis.key}>
            <line x1={center} y1={center} x2={x} y2={y} stroke="rgba(148, 163, 184, 0.22)" strokeWidth="1" />
            <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="central" fill="#cbd5e1" fontSize="10">{axis.label}</text>
          </g>
        )
      })}
      <polygon points={valuePoints} fill="rgba(96, 165, 250, 0.36)" stroke="#60a5fa" strokeWidth="2" />
      {OFFICER_STAT_AXES.map((axis, index) => {
        const [x, y] = getRadarPoint(index, total, stats[axis.key], radius, center).split(',').map(Number)
        return <circle key={`${axis.key}-value`} cx={x} cy={y} r="2.8" fill="#facc15" />
      })}
    </svg>
  )
}

function OfficerPortrait({ officer }: { officer: Officer }) {
  const officerName = formatOfficerName(officer)
  return (
    <div style={styles.officerPortraitFrame}>
      <img src={resolvePortraitUrl(officer.portraitUrl)} alt={`${officerName} portrait`} style={styles.officerPortraitImage} />
    </div>
  )
}

function DialogueLineWindow({ portraitUrl, speaker, message, side = 'left' }: { portraitUrl: string; speaker: string; message: string; side?: 'left' | 'right' }) {
  return (
    <div style={side === 'right' ? { ...styles.dialogueLine, ...styles.dialogueLineRight } : styles.dialogueLine}>
      <div style={styles.dialoguePortraitFrame}>
        <img src={resolvePortraitUrl(portraitUrl)} alt={`${speaker} portrait`} style={styles.officerPortraitImage} />
      </div>
      <div style={styles.dialogueTextBox}>
        <strong>{speaker}</strong>
        <span>{message}</span>
      </div>
    </div>
  )
}

export function TownScreen({ onManualSave, onLoadLatest }: TownScreenProps) {
  const portId = useNavigationStore((s) => s.dockedPortId)
  const ports = useWorldStore((s) => s.ports)
  const player = usePlayerStore((s) => s.player)
  const ships = usePlayerStore((s) => s.ships)
  const officers = usePlayerStore((s) => s.officers)
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
  const hireOfficer = usePlayerStore((s) => s.hireOfficer)
  const assignOfficerToShip = usePlayerStore((s) => s.assignOfficerToShip)
  const unassignOfficer = usePlayerStore((s) => s.unassignOfficer)
  const repairShip = usePlayerStore((s) => s.repairShip)
  const purchaseShip = usePlayerStore((s) => s.purchaseShip)
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
  const questBoardPortRef = useRef<string | null>(null)
  const [repairTargetShipId, setRepairTargetShipId] = useState<string | null>(null)
  const [tavernTargetShipId, setTavernTargetShipId] = useState<string | null>(null)
  const [shipyardTargetShipId, setShipyardTargetShipId] = useState<string | null>(null)
  const [marketTargetShipId, setMarketTargetShipId] = useState<string | null>(null)
  const [hireDialogue, setHireDialogue] = useState<HireDialogueState | null>(null)

  const port = ports.find((item) => item.id === portId)
  const activeShip = ships.find((ship) => ship.instanceId === activeShipId)
  const shipType = activeShip ? getShip(activeShip.typeId) : undefined
  const fallbackShipId = activeShipId ?? ships[0]?.instanceId ?? null
  const repairTargetShip = ships.find((ship) => ship.instanceId === (repairTargetShipId ?? fallbackShipId)) ?? activeShip
  const tavernTargetShip = ships.find((ship) => ship.instanceId === (tavernTargetShipId ?? fallbackShipId)) ?? activeShip
  const shipyardTargetShip = ships.find((ship) => ship.instanceId === (shipyardTargetShipId ?? fallbackShipId)) ?? activeShip
  const marketTargetShip = ships.find((ship) => ship.instanceId === (marketTargetShipId ?? fallbackShipId)) ?? activeShip
  const fleetSupply = ships.reduce(
    (total, ship) => ({
      food: total.food + ship.supplies.food,
      water: total.water + ship.supplies.water,
      maxFood: total.maxFood + ship.supplies.maxFood,
      maxWater: total.maxWater + ship.supplies.maxWater,
    }),
    { food: 0, water: 0, maxFood: 0, maxWater: 0 },
  )
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
    if (!port?.id) {
      questBoardPortRef.current = null
      return
    }

    if (questBoardPortRef.current === port.id) return
    questBoardPortRef.current = port.id
    ensurePortQuests(port.id, day)
  }, [day, ensurePortQuests, port?.id])

  const marketRows = useMemo(
    () => (market?.items ?? []).map((item) => {
      const good = getTradeGood(item.goodId)
      if (!good) return null
      const quantity = quantities[item.goodId] ?? 1
      const quote = portId ? getBuyQuote(portId, item.goodId, quantity, marketTargetShip?.instanceId) : null
      const limit = portId ? getPurchaseLimit(portId, item.goodId) : 0
      return { item, good, quantity, quote, limit }
    }).filter((row): row is NonNullable<typeof row> => Boolean(row)).sort((a, b) => a.quote!.unitPrice - b.quote!.unitPrice),
    [getBuyQuote, getPurchaseLimit, getTradeGood, market?.items, marketTargetShip?.instanceId, portId, quantities],
  )

  const cargoRows = useMemo(
    () => (marketTargetShip?.cargo ?? []).map((slot) => {
      const good = getTradeGood(slot.goodId)
      if (!good) return null
      const quantity = quantities[slot.goodId] ?? 1
      const quote = portId ? getSellQuote(portId, slot.goodId, quantity, marketTargetShip?.instanceId) : null
      return { slot, good, quantity, quote }
    }).filter((row): row is NonNullable<typeof row> => Boolean(row)).sort((a, b) => b.quote!.unitPrice - a.quote!.unitPrice),
    [getSellQuote, getTradeGood, marketTargetShip?.cargo, marketTargetShip?.instanceId, portId, quantities],
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
  const beginHireDialogue = (officer: Officer) => {
    clearQuestNotice()
    setTradeMessageState({ portId: port.id, message: null })
    setHireDialogue({ officer: { ...officer, name: formatOfficerName(officer) }, step: 'player_line' })
  }
  const advanceHireDialogue = () => {
    if (!hireDialogue) return
    if (hireDialogue.step === 'player_line') {
      setHireDialogue({ officer: hireDialogue.officer, step: 'officer_line' })
      return
    }
    if (hireDialogue.step === 'officer_line') {
      const result = hireOfficer(hireDialogue.officer)
      if (!result.ok) {
        setHireDialogue(null)
        handleAction(result)
        return
      }
      setHireDialogue({ officer: hireDialogue.officer, step: 'system_message' })
      return
    }
    setHireDialogue(null)
  }

  const fleetStats = ships.reduce(
    (total, ship) => ({
      durability: total.durability + ship.currentDurability,
      maxDurability: total.maxDurability + ship.maxDurability,
      crew: total.crew + ship.currentCrew,
      maxCrew: total.maxCrew + ship.maxCrew,
      cargo: total.cargo + ship.usedCapacity,
      maxCargo: total.maxCargo + ship.maxCapacity,
      morale: total.morale + ship.morale,
    }),
    { durability: 0, maxDurability: 0, crew: 0, maxCrew: 0, cargo: 0, maxCargo: 0, morale: 0 },
  )
  const fleetMorale = ships.length > 0 ? fleetStats.morale / ships.length : undefined
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
  const missingDurability = Math.max(0, (repairTargetShip?.maxDurability ?? 0) - (repairTargetShip?.currentDurability ?? 0))
  const emergencyPreview = Math.min(missingDurability, 12)
  const emergencyRepairGain = missingDurability > 0 ? Math.min(missingDurability, Math.max(4, Math.floor(emergencyPreview * (VOYAGE_CONFIG.EMERGENCY_REPAIR_EFFICIENCY + shipyardLevel * 0.03)))) : 0
  const emergencyRepairCost = emergencyRepairGain * Math.max(2, VOYAGE_CONFIG.EMERGENCY_REPAIR_COST_PER_POINT - Math.floor(shipyardLevel / 2))
  const standardRepairUnitCost = Math.max(2, VOYAGE_CONFIG.STANDARD_REPAIR_COST_PER_POINT - Math.floor(shipyardLevel / 2))
  const standardRepairPreview = REPAIR_AMOUNTS.map((amount) => ({ amount, cost: Math.min(amount, missingDurability) * standardRepairUnitCost }))
  const overhaulCost = missingDurability * Math.max(VOYAGE_CONFIG.STANDARD_REPAIR_COST_PER_POINT, VOYAGE_CONFIG.OVERHAUL_COST_PER_POINT - Math.floor(shipyardLevel / 2))
  const tavernMealCost = Math.max(20, Math.ceil(Math.max(1, tavernTargetShip?.currentCrew ?? 1) * VOYAGE_CONFIG.TAVERN_MEAL_COST_PER_CREW * (1 - tavernLevel * 0.04)))
  const tavernRoundsCost = Math.max(60, Math.ceil(VOYAGE_CONFIG.TAVERN_ROUND_BASE_COST * (1 + (tavernTargetShip?.maxCrew ?? 1) * 0.04) * (1 - tavernLevel * 0.03)))
  const tavernRecruitUnitCost = Math.max(10, 18 - tavernLevel * VOYAGE_CONFIG.TAVERN_RECRUIT_DISCOUNT_PER_LEVEL)
  const tavernOfficerOffers = tavernFacility ? generateTavernOfficerOffers(port, day, tavernLevel, player?.stats.fame ?? 0) : []
  const hiredOfficerIds = new Set(officers.map((officer) => officer.id))
  const consortShips = ships.filter((ship) => ship.instanceId !== activeShipId)
  const officerDailySalary = officers.reduce((sum, officer) => sum + officer.salary, 0)
  const captainLevel = Math.max(player?.stats.tradeLevel ?? 0, player?.stats.combatLevel ?? 0, player?.stats.adventureLevel ?? 0)
  const ownedShipTypeIds = new Set(ships.map((ship) => ship.typeId))
  const shipyardOffers = shipCatalog
    .filter((ship) => !ownedShipTypeIds.has(ship.id))
    .filter((ship) => !ship.cultures?.length || ship.cultures.includes(port.culture))
    .sort((a, b) => a.requiredLevel - b.requiredLevel || a.price - b.price)
  const selectedShipyardTargetType = shipyardTargetShip ? getShip(shipyardTargetShip.typeId) : undefined
  const riggingLevel = shipyardTargetShip?.upgrades?.rigging ?? 0
  const cargoLevel = shipyardTargetShip?.upgrades?.cargo ?? 0
  const gunneryLevel = shipyardTargetShip?.upgrades?.gunnery ?? 0
  const outfitCost = (option: 'rigging' | 'cargo' | 'gunnery', level: number) => OUTFIT_BASE_COST[option] + level * OUTFIT_STEP[option]
  const outfitLocked = (optionLevel: number) => optionLevel >= OUTFIT_MAX_LEVEL
  const loadRatio = shipyardTargetShip ? shipyardTargetShip.usedCapacity / Math.max(1, shipyardTargetShip.maxCapacity) : 0
  const renderFacilityShipSelect = (selectedShipId: string | null, onSelect: (shipId: string) => void) => (
    <label style={styles.commandTargetLabel}>
      対象船
      <select style={styles.commandTargetSelect} value={selectedShipId ?? ''} onChange={(event) => onSelect(event.target.value)}>
        {ships.map((ship, index) => {
          const type = getShip(ship.typeId)
          const role = ship.instanceId === activeShipId ? '旗艦' : '僚船'
          return <option key={ship.instanceId} value={ship.instanceId}>第{index + 1}船 {role}: {type?.name ?? ship.name}</option>
        })}
      </select>
    </label>
  )

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
          <div style={styles.statCard}><span style={styles.statLabel}>艦隊</span><strong>{ships.length}/5 隻</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>旗艦</span><strong>{shipType?.name ?? activeShip?.name ?? uiText.town.labels.none}</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>{uiText.nav.durability}</span><strong>{fleetStats.durability}/{fleetStats.maxDurability}</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>{uiText.town.labels.crew}</span><strong>{fleetStats.crew}/{fleetStats.maxCrew}</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>{uiText.town.labels.cargo}</span><strong>{fleetStats.cargo.toFixed(1)}/{fleetStats.maxCargo.toFixed(1)}</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>{uiText.town.labels.morale}</span><strong>{formatMorale(fleetMorale)}</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>航海士</span><strong>{officers.length} 名 / 日給 {officerDailySalary} d</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>{uiText.town.labels.supplies}</span><strong>食 {fleetSupply.food.toFixed(0)}/{fleetSupply.maxFood.toFixed(0)} / 水 {fleetSupply.water.toFixed(0)}/{fleetSupply.maxWater.toFixed(0)}</strong></div>
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
                <section style={styles.cityPanel}>
                  {port.id === 'lisbon' ? (
                    <>
                      <div style={styles.cityIntro}>
                        <div>
                          <p style={styles.overviewEyebrow}>Lisboa city vista prototype</p>
                          <h3 style={styles.overviewTitle}>リスボン</h3>
                          <p style={styles.overviewText}>テージョ川に面したポルトガル王国の都。丘陵に広がる街並みと賑わう港には、遠洋航海を支える施設が集まっています。</p>
                        </div>
                        <div style={styles.cityBadge}>試作: 都市別アート差し替え前提</div>
                      </div>
                      <div
                        style={{
                          ...styles.cityVista,
                          backgroundImage: `linear-gradient(180deg, rgba(17, 24, 39, 0.08), rgba(17, 24, 39, 0.22)), url(${import.meta.env.BASE_URL}generated/town/lisbon-etching.png)`,
                        }}
                        aria-label="リスボン街全景"
                      >
                        <div style={styles.cityEtchingVignette} />
                        {LISBON_CITY_HOTSPOTS.map((spot) => {
                          const isAvailable = availableSections.includes(spot.section)
                          return (
                            <button
                              key={spot.section}
                              type="button"
                              style={{
                                ...styles.cityHotspot,
                                left: `${spot.x}%`,
                                top: `${spot.y}%`,
                                borderColor: `${spot.tone}cc`,
                                boxShadow: `0 0 0 1px ${spot.tone}44, 0 12px 30px rgba(0,0,0,0.28)`,
                                opacity: isAvailable ? 1 : 0.35,
                                cursor: isAvailable ? 'pointer' : 'not-allowed',
                              }}
                              disabled={!isAvailable}
                              onClick={() => setActiveSection(spot.section)}
                            >
                              <span style={{ ...styles.cityHotspotIcon, background: spot.tone }}>{spot.emblem}</span>
                              <span style={styles.cityHotspotText}><strong>{spot.label}</strong><small>{spot.caption}</small></span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <div style={styles.overviewCopy}>
                      <p style={styles.overviewEyebrow}>{uiText.town.labels.harborView}</p>
                      <h3 style={styles.overviewTitle}>{port.name} に停泊中</h3>
                      <p style={styles.overviewText}>都市別の全景図はリスボンで試作中です。この港は従来の概要表示を使います。</p>
                    </div>
                  )}
                </section>
                <section style={styles.panel}>
                  <div style={styles.infoGridCompact}>
                    <div style={styles.infoBlock}><span style={styles.infoLabel}>{uiText.town.labels.port}</span><strong>{port.nationality} / 発展度 {port.prosperity}</strong><small>{summarizeFacilities(facilities)}</small></div>
                    <div style={styles.infoBlock}><span style={styles.infoLabel}>{uiText.town.labels.captain}</span><strong>{player?.name ?? uiText.town.labels.unknown}</strong><small>交易経験 {player?.stats.tradeExp ?? 0} / 名声 {player?.stats.fame ?? 0}</small></div>
                    <div style={styles.infoBlock}><span style={styles.infoLabel}>艦隊</span><strong>{ships.length}/5 隻 / 旗艦 {shipType?.name ?? activeShip?.name ?? uiText.town.labels.none}</strong><small>船体 {fleetStats.durability}/{fleetStats.maxDurability} / 士気 {formatMorale(fleetMorale)}</small></div>
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
                            <span style={styles.tradeSub}>{formatQuestCategory(quest.metadata?.category)} / {formatQuestRank(quest.rank)} / 名声 {formatQuestRequirement(quest.requiredFame)} / 必要Lv {formatQuestRequirement(quest.requiredLevel)} / 残り {daysRemaining ?? '-'} 日</span>
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
                      <div style={styles.infoBlock}><span style={styles.infoLabel}>{uiText.town.labels.supplies}</span><strong>食 {fleetSupply.food.toFixed(0)}/{fleetSupply.maxFood.toFixed(0)} / 水 {fleetSupply.water.toFixed(0)}/{fleetSupply.maxWater.toFixed(0)}</strong><small>艦隊全体に補給します</small></div>
                      <div style={styles.infoBlock}><span style={styles.infoLabel}>{uiText.nav.durability}</span><strong>{repairTargetShip?.currentDurability ?? 0} / {repairTargetShip?.maxDurability ?? 0}</strong><small>修理対象: {repairTargetShip?.name ?? '未選択'} / {shipyardFacility ? `${uiText.town.labels.shipyard} Lv.${shipyardLevel}` : '簡易工房のみ'}</small></div>
                    </div>
                    <div>
                      <p style={styles.serviceLabel}>保有船</p>
                      <div style={styles.list}>
                        {ships.map((ship) => {
                          const type = getShip(ship.typeId)
                          const isRepairTarget = ship.instanceId === repairTargetShip?.instanceId
                          const captain = getAssignedOfficer(ship, officers)
                          return (
                            <div key={ship.instanceId} style={styles.compactActionRow}>
                              <div style={styles.tradeMeta}>
                                <strong>{type?.name ?? ship.name}{ship.instanceId === activeShipId ? ` / ${uiText.town.labels.active}` : ''}{isRepairTarget ? ' / 操作対象' : ''}</strong>
                                <span style={styles.tradeSub}>船員 {ship.currentCrew}/{ship.maxCrew} / 船体 {ship.currentDurability}/{ship.maxDurability} / 積荷 {ship.usedCapacity}/{ship.maxCapacity}</span>
                                <span style={styles.tradeSub}>速力 {type?.speed ?? '-'} / 旋回 {type?.turnRate ?? '-'} / 砲門 {type?.cannonSlots ?? '-'} / 船長 {captain?.name ?? (ship.instanceId === activeShipId ? 'プレイヤー' : '未任命')}</span>
                              </div>
                              <button style={isRepairTarget ? styles.secondaryButton : styles.primaryButton} disabled={isRepairTarget} onClick={() => setRepairTargetShipId(ship.instanceId)}>操作対象にする</button>
                            </div>
                          )
                        })}
                      </div>
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
                      <div style={styles.facilityTargetRow}>
                        <span style={styles.serviceNote}>修理対象の船</span>
                        {renderFacilityShipSelect(repairTargetShip?.instanceId ?? fallbackShipId, setRepairTargetShipId)}
                      </div>
                      <p style={styles.serviceLabel}>{uiText.town.labels.repair}</p>
                      <div style={styles.serviceGrid}>
                        <button style={styles.secondaryButton} disabled={missingDurability <= 0} onClick={() => handleAction(repairShip('emergency', emergencyPreview || undefined, shipyardLevel, repairTargetShip?.instanceId))}>応急修理 {emergencyRepairCost} d</button>
                        {shipyardFacility && standardRepairPreview.map(({ amount, cost }) => <button key={`repair-${amount}`} style={styles.secondaryButton} disabled={missingDurability <= 0} onClick={() => handleAction(repairShip('standard', amount, shipyardLevel, repairTargetShip?.instanceId))}>{uiText.town.labels.repair} {amount} {cost} d</button>)}
                        {shipyardFacility && <button style={styles.primaryButton} disabled={missingDurability <= 0} onClick={() => handleAction(repairShip('overhaul', undefined, shipyardLevel, repairTargetShip?.instanceId))}>{uiText.town.labels.overhaul} {overhaulCost} d</button>}
                      </div>
                      <div style={styles.serviceNote}>{shipyardFacility ? 'オーバーホールは耐久を全快し、消耗の蓄積も整えます。' : '造船所がない港では応急修理のみ可能です。'}</div>
                    </div>
                    <div style={styles.departRow}>
                      <button style={styles.leaveButton} onClick={() => {
                        const nav = useNavigationStore.getState()
                        nav.setPosition(port.position)
                        nav.departPort(nav.heading)
                        const departedNav = useNavigationStore.getState()
                        usePlayerStore.getState().setPosition(departedNav.position)
                        usePlayerStore.getState().setHeading(departedNav.heading)
                        usePlayerStore.getState().updatePlayer({ currentPortId: undefined, position: departedNav.position, heading: departedNav.heading })
                        setPhase('playing')
                      }}>{uiText.town.labels.depart}</button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {visibleSection === 'market' && hasMarket && (
              <div style={styles.contentStack}>
                <div style={styles.facilityTargetRow}>
                  <span style={styles.serviceNote}>市場で積荷を扱う船</span>
                  {renderFacilityShipSelect(marketTargetShip?.instanceId ?? fallbackShipId, setMarketTargetShipId)}
                </div>
                <div style={styles.infoGridCompact}>
                  <div style={styles.infoBlock}>
                    <span style={styles.infoLabel}>選択中の船</span>
                    <strong>{marketTargetShip?.name ?? '未選択'}</strong>
                    <small>買付した交易品はこの船の船倉に入ります</small>
                  </div>
                  <div style={styles.infoBlock}>
                    <span style={styles.infoLabel}>船倉</span>
                    <strong>{(marketTargetShip?.usedCapacity ?? 0).toFixed(1)} / {(marketTargetShip?.maxCapacity ?? 0).toFixed(1)}</strong>
                    <small>売却リストもこの船の積荷を表示します</small>
                  </div>
                </div>
                <div style={styles.twoCol}>
                  <section style={styles.panel}>
                    <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>{uiText.town.labels.buy}</h3><span style={styles.panelHint}>1行で判断できる形</span></div>
                    <div style={styles.list}>
                      {marketRows.map(({ item, good, quantity, quote, limit }) => {
                        const totalWeight = good.weight * quantity
                        const purchaseCap = Math.max(0, Math.min(item.stock, limit))
                        const exceedsCap = quantity > purchaseCap && purchaseCap > 0
                        const remainingCapacity = (marketTargetShip?.maxCapacity ?? 0) - (marketTargetShip?.usedCapacity ?? 0)
                        const exceedsCapacity = totalWeight > remainingCapacity
                        return (
                          <div key={good.id} style={styles.marketRowDense}>
                            <div style={styles.tradeMeta}>
                              <strong>{good.name}</strong>
                              <span style={styles.tradeSub}>{quote?.unitPrice ?? item.currentPrice} d / 在庫 {item.stock} / 上限 {limit} / {item.trend}</span>
                              {purchaseCap <= 0 && <span style={styles.tradeBlocked}>この港では今日はこれ以上買えません。</span>}
                              {exceedsCap && <span style={styles.tradeBlocked}>数量が購入上限を超えています。</span>}
                              {exceedsCapacity && <span style={styles.tradeBlocked}>選択中の船の船倉容量が足りません。</span>}
                            </div>
                            <div style={styles.tradeControlsDense}>
                              <input type="number" min={1} max={Math.max(1, purchaseCap)} value={quantity} onChange={(e) => setQuantity(good.id, Number(e.target.value))} style={styles.quantityInput} disabled={purchaseCap <= 0} />
                              <span style={styles.compactFigure}>{quote?.totalPrice ?? item.currentPrice} d</span>
                              <span style={styles.compactFigure}>積載 {totalWeight.toFixed(1)}</span>
                              <button style={styles.primaryButton} disabled={!marketTargetShip || purchaseCap <= 0 || exceedsCap || exceedsCapacity} onClick={() => handleAction(buyGood(port.id, good.id, quantity, marketTargetShip?.instanceId))}>{uiText.town.labels.buyAction}</button>
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
                              <button style={styles.secondaryButton} onClick={() => handleAction(sellGood(port.id, good.id, quantity, marketTargetShip?.instanceId))}>売却</button>
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
                        <div style={styles.featureText}>操作対象: {tavernTargetShip?.name ?? '未選択'} / 新規雇用 {tavernRecruitUnitCost} d</div>
                      </div>
                    </div>
                    <div style={styles.facilityTargetRow}>
                      <span style={styles.serviceNote}>酒場で操作する船</span>
                      {renderFacilityShipSelect(tavernTargetShip?.instanceId ?? fallbackShipId, setTavernTargetShipId)}
                    </div>
                    <div style={styles.infoGridCompact}>
                      <div style={styles.infoBlock}><span style={styles.infoLabel}>{uiText.town.labels.mood}</span><strong>{formatMorale(tavernTargetShip?.morale)}</strong><small>食事で小回復 / 景気づけで大回復</small></div>
                      <div style={styles.infoBlock}><span style={styles.infoLabel}>雇用単価</span><strong>{tavernRecruitUnitCost} d / 人</strong><small>対象船の空き船員枠に雇用します。</small></div>
                    </div>
                    <div>
                      <p style={styles.serviceLabel}>士気回復</p>
                      <div style={styles.serviceGrid}>
                        <button style={styles.secondaryButton} onClick={() => handleAction(visitTavern('meal', undefined, tavernLevel, tavernTargetShip?.instanceId))}>船員に食事 {tavernMealCost} d</button>
                        <button style={styles.primaryButton} onClick={() => handleAction(visitTavern('rounds', undefined, tavernLevel, tavernTargetShip?.instanceId))}>景気づけ {tavernRoundsCost} d</button>
                      </div>
                    </div>
                    <div>
                      <p style={styles.serviceLabel}>船員雇用</p>
                      <div style={styles.serviceGrid}>
                        {CREW_HIRE_AMOUNTS.map((amount) => <button key={`crew-${amount}`} style={styles.secondaryButton} onClick={() => handleAction(visitTavern('recruit', amount, tavernLevel, tavernTargetShip?.instanceId))}>{amount} 人雇う</button>)}
                      </div>
                    </div>
                    <div>
                      <p style={styles.serviceLabel}>航海士雇用</p>
                      <div style={styles.list}>
                        {tavernOfficerOffers.map((officer) => {
                          const hired = hiredOfficerIds.has(officer.id)
                          const officerName = formatOfficerName(officer)
                          return (
                            <div key={officer.id} style={styles.officerOfferCard}>
                              <div style={styles.officerPortraitColumn}>
                                <OfficerPortrait officer={officer} />
                                <span style={styles.officerPortraitCaption}>{formatNationalityLabel(officer.nationality)}</span>
                              </div>
                              <div style={styles.officerOfferBody}>
                                <div style={styles.officerOfferHeader}>
                                  <div style={styles.tradeMeta}>
                                    <strong>{officerName} / {getOfficerSpecialtyLabel(officer.specialty)} Lv.{officer.level}</strong>
                                    <span style={styles.tradeSub}>{officer.description}</span>
                                  </div>
                                  <button style={styles.primaryButton} disabled={hired || (player?.money ?? 0) < officer.hireCost} onClick={() => beginHireDialogue(officer)}>{hired ? '雇用済み' : '雇用する'}</button>
                                </div>
                                <div style={styles.officerOfferMain}>
                                  <OfficerRadarChart stats={officer.stats} />
                                  <div style={styles.officerStatList}>
                                    {OFFICER_STAT_AXES.map((axis) => (
                                      <div key={`${officer.id}-${axis.key}`} style={styles.officerStatRow}>
                                        <span>{axis.label}</span>
                                        <strong>{officer.stats[axis.key]}</strong>
                                      </div>
                                    ))}
                                  </div>
                                  <div style={styles.officerCostBox}>
                                    <span>雇用 {officer.hireCost} d</span>
                                    <span>日給 {officer.salary} d</span>
                                    <small>{formatOfficerStats(officer)}</small>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <p style={styles.serviceLabel}>僚艦船長任命</p>
                      <div style={styles.list}>
                        {officers.length === 0 && <div style={styles.emptyState}>雇用済みの航海士はいません。</div>}
                        {officers.map((officer) => {
                          const assignedShip = ships.find((ship) => ship.captainOfficerId === officer.id)
                          const officerName = formatOfficerName(officer)
                          return (
                            <div key={officer.id} style={styles.compactActionRow}>
                              <div style={styles.assignedOfficerSummary}>
                                <OfficerPortrait officer={officer} />
                                <div style={styles.tradeMeta}>
                                  <strong>{officerName} / 現在 {assignedShip?.name ?? '未任命'}</strong>
                                  <span style={styles.tradeSub}>{getOfficerSpecialtyLabel(officer.specialty)} / {formatOfficerStats(officer)}</span>
                                  <span style={styles.tradeSub}>効果: 航海=速力・旋回 / 交易=売買価格・積載補助 / 砲術=戦術砲門 / 修理=修理効率 / 統率=士気低下軽減</span>
                                </div>
                              </div>
                              <div style={styles.inlineButtonGroup}>
                                {consortShips.map((ship) => (
                                  <button key={`${officer.id}-${ship.instanceId}`} style={ship.captainOfficerId === officer.id ? styles.secondaryButton : styles.primaryButton} disabled={ship.captainOfficerId === officer.id} onClick={() => handleAction(assignOfficerToShip(officer.id, ship.instanceId))}>{ship.name}</button>
                                ))}
                                <button style={styles.secondaryButton} disabled={!assignedShip} onClick={() => handleAction(unassignOfficer(officer.id))}>任を解く</button>
                              </div>
                            </div>
                          )
                        })}
                        {officers.length > 0 && consortShips.length === 0 && <div style={styles.emptyState}>船長を任命できる僚艦がありません。</div>}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {visibleSection === 'shipyard' && shipyardFacility && (
              <div style={styles.contentStack}>
                <section style={styles.panel}>
                  <div style={styles.panelHeader}><h3 style={styles.sectionTitle}>{uiText.town.labels.shipyard}</h3><span style={styles.panelHint}>船の購入と艤装</span></div>
                  <div style={styles.contentStack}>
                      <div style={styles.facilityTargetRow}>
                        <span style={styles.serviceNote}>艤装対象の船</span>
                        {renderFacilityShipSelect(shipyardTargetShip?.instanceId ?? fallbackShipId, setShipyardTargetShipId)}
                      </div>
                      <div style={styles.infoGridCompact}>
                        <div style={styles.infoBlock}><span style={styles.infoLabel}>選択中の船</span><strong>{selectedShipyardTargetType?.name ?? shipyardTargetShip?.name ?? '未選択'}</strong><small>艤装はこの船に適用されます。</small></div>
                        <div style={styles.infoBlock}><span style={styles.infoLabel}>船体状態</span><strong>{shipyardTargetShip?.currentDurability ?? 0}/{shipyardTargetShip?.maxDurability ?? 0}</strong><small>船員 {shipyardTargetShip?.currentCrew ?? 0}/{shipyardTargetShip?.maxCrew ?? 0} / 積荷 {shipyardTargetShip?.usedCapacity ?? 0}/{shipyardTargetShip?.maxCapacity ?? 0}</small></div>
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
                                const disabled = !shipyardTargetShip || isMaxed || (player?.money ?? 0) < cost
                                return (
                                  <div key={option.option} style={styles.outfitCard}>
                                    <strong>{option.label}</strong>
                                    <span style={styles.outfitNote}>{option.description}</span>
                                    <span style={styles.outfitMeta}>{isMaxed ? uiText.town.labels.maxed : `費用 ${cost} d / Lv ${level + 1}`}</span>
                                    <button style={styles.primaryButton} disabled={disabled} onClick={() => handleAction(outfitShip(option.option, shipyardTargetShip?.instanceId))}>
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
        {hireDialogue && (
          <div
            style={styles.dialogueOverlay}
            role="button"
            tabIndex={0}
            aria-label="会話を進める"
            onClick={advanceHireDialogue}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') advanceHireDialogue()
            }}
          >
            <div style={styles.dialogueStage}>
              {hireDialogue.step === 'system_message' ? (
                <div style={styles.systemMessageWindow}>
                  <strong>{formatOfficerName(hireDialogue.officer)}が仲間になりました</strong>
                  <span>配置する船を選んでください</span>
                </div>
              ) : (
                <div style={styles.dialogueStack}>
                  <DialogueLineWindow portraitUrl={PLAYER_PORTRAIT_URL} speaker="ディエゴ" message="仲間にならないか？" />
                  {hireDialogue.step === 'officer_line' && (
                    <DialogueLineWindow portraitUrl={hireDialogue.officer.portraitUrl ?? ''} speaker={formatOfficerName(hireDialogue.officer)} message="いいぜ" side="right" />
                  )}
                </div>
              )}
              <span style={styles.dialogueAdvanceHint}>クリック / Enter で送る</span>
            </div>
          </div>
        )}
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
  cityPanel: { padding: 16, borderRadius: 22, background: 'linear-gradient(180deg, rgba(22, 35, 55, 0.92), rgba(9, 20, 36, 0.96))', border: '1px solid rgba(244, 184, 96, 0.18)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' },
  cityIntro: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12 },
  cityBadge: { padding: '8px 10px', borderRadius: 999, background: 'rgba(180, 83, 9, 0.22)', border: '1px solid rgba(251, 191, 36, 0.24)', color: '#f8ddb3', fontSize: 11, whiteSpace: 'nowrap' },
  cityVista: { position: 'relative', minHeight: 430, overflow: 'hidden', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#d1b98b', backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' },
  cityEtchingVignette: { position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 50% 42%, transparent 54%, rgba(20, 12, 5, 0.32) 100%), linear-gradient(90deg, rgba(67, 40, 17, 0.18), transparent 18%, transparent 82%, rgba(67, 40, 17, 0.18))', mixBlendMode: 'multiply' },
  citySky: { position: 'absolute', inset: 0, background: 'radial-gradient(circle at 18% 16%, rgba(255,244,207,0.58), transparent 15%), linear-gradient(180deg, rgba(125, 180, 202, 0.85), rgba(214, 174, 118, 0.46) 48%, transparent 49%)' },
  citySun: { position: 'absolute', left: '10%', top: '11%', width: 58, height: 58, borderRadius: '50%', background: '#ffe3a3', boxShadow: '0 0 44px rgba(255, 207, 120, 0.55)' },
  cityHillsBack: { position: 'absolute', left: '-4%', right: '-4%', top: '30%', height: '24%', background: 'linear-gradient(180deg, #8a9a72, #617856)', clipPath: 'polygon(0 58%, 14% 39%, 27% 50%, 40% 24%, 52% 42%, 66% 19%, 79% 38%, 100% 25%, 100% 100%, 0 100%)', opacity: 0.9 },
  cityHillsFront: { position: 'absolute', left: '8%', right: '8%', top: '39%', height: '29%', background: 'linear-gradient(180deg, #c7b079, #8f734b)', clipPath: 'polygon(0 64%, 10% 43%, 24% 54%, 37% 25%, 51% 48%, 63% 30%, 76% 55%, 92% 36%, 100% 58%, 100% 100%, 0 100%)' },
  cityRiver: { position: 'absolute', left: '-5%', right: '-5%', bottom: '-3%', height: '36%', background: 'linear-gradient(135deg, rgba(38, 112, 145, 0.95), rgba(15, 58, 91, 0.98))', clipPath: 'polygon(0 23%, 18% 8%, 34% 28%, 50% 16%, 70% 32%, 100% 12%, 100% 100%, 0 100%)' },
  cityQuay: { position: 'absolute', left: '8%', right: '10%', top: '66%', height: '7%', background: 'linear-gradient(90deg, #5b4630, #b28b57 40%, #6f5131)', transform: 'skewY(-3deg)', borderTop: '2px solid rgba(255,255,255,0.16)' },
  cityWall: { position: 'absolute', left: '16%', top: '48%', width: '60%', height: '13%', background: 'linear-gradient(180deg, #ead8b1, #b99365)', clipPath: 'polygon(0 42%, 14% 28%, 31% 43%, 49% 20%, 70% 42%, 88% 26%, 100% 44%, 100% 100%, 0 100%)', boxShadow: '0 12px 20px rgba(44, 25, 12, 0.24)' },
  cityBlock: { position: 'absolute', background: 'linear-gradient(180deg, #f7ead3, #c7aa7a)', border: '1px solid rgba(91, 55, 25, 0.28)', clipPath: 'polygon(0 32%, 20% 18%, 34% 30%, 52% 12%, 74% 28%, 100% 18%, 100% 100%, 0 100%)', boxShadow: 'inset 0 18px 0 rgba(159, 64, 37, 0.36)' },
  cityTower: { position: 'absolute', width: '6%', height: '21%', background: 'linear-gradient(180deg, #f3e5c5, #9d7b50)', clipPath: 'polygon(18% 0, 82% 0, 82% 100%, 18% 100%)', boxShadow: 'inset 0 14px 0 rgba(127, 47, 31, 0.42)' },
  cityCrane: { position: 'absolute', width: '10%', height: '18%', borderLeft: '5px solid #5d3b21', borderTop: '4px solid #5d3b21', transform: 'skewX(-12deg)' },
  cityShip: { position: 'absolute', width: '11%', height: '7%', background: '#40230f', clipPath: 'polygon(0 46%, 72% 46%, 100% 22%, 86% 80%, 12% 80%)', boxShadow: '22px -36px 0 -25px #ead9bd' },
  cityHotspot: { position: 'absolute', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', gap: 8, minWidth: 126, padding: '8px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.24)', background: 'rgba(10, 23, 38, 0.82)', color: '#fff', backdropFilter: 'blur(8px)' },
  cityHotspotIcon: { width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#08111f', fontWeight: 800, flex: '0 0 auto' },
  cityHotspotText: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, lineHeight: 1.1 },
  overviewCopy: { maxWidth: 620 },
  overviewEyebrow: { margin: 0, color: '#e6b979', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em' },
  overviewTitle: { margin: '5px 0 0', fontSize: 24 },
  overviewText: { margin: '8px 0 0', color: '#d1dceb', lineHeight: 1.7 },
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
  officerOfferCard: { display: 'grid', gridTemplateColumns: '112px minmax(0, 1fr)', gap: 14, alignItems: 'stretch', padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(148, 163, 184, 0.12)' },
  officerPortraitColumn: { display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' },
  officerPortraitFrame: { width: 96, aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(244, 201, 130, 0.32)', background: 'linear-gradient(180deg, rgba(69, 52, 35, 0.65), rgba(20, 28, 42, 0.9))', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' },
  officerPortraitImage: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  officerPortraitCaption: { color: '#9fb3cf', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' },
  officerOfferBody: { display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 },
  officerOfferHeader: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' },
  officerOfferMain: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, alignItems: 'center' },
  officerRadar: { display: 'block', maxWidth: '100%' },
  officerStatList: { display: 'grid', gridTemplateColumns: '1fr', gap: 5 },
  officerStatRow: { display: 'grid', gridTemplateColumns: '42px 1fr', alignItems: 'center', gap: 8, color: '#b8c7dc', fontSize: 12 },
  officerCostBox: { display: 'flex', flexDirection: 'column', gap: 5, color: '#dbeafe', fontSize: 12, padding: 10, borderRadius: 12, background: 'rgba(15, 23, 42, 0.34)', border: '1px solid rgba(148, 163, 184, 0.12)' },
  assignedOfficerSummary: { display: 'grid', gridTemplateColumns: '104px minmax(0, 1fr)', gap: 10, alignItems: 'center', minWidth: 0 },
  dialogueOverlay: { position: 'fixed', inset: 0, zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px min(5vw, 56px)', background: 'rgba(2, 6, 23, 0.58)', backdropFilter: 'blur(2px)', cursor: 'pointer' },
  dialogueStage: { width: 'min(940px, 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '18px 18px 14px', borderRadius: 20, background: 'linear-gradient(180deg, rgba(4, 12, 24, 0.42), rgba(7, 16, 31, 0.28))', border: '1px solid rgba(191, 219, 254, 0.16)', boxShadow: '0 28px 90px rgba(0,0,0,0.48)' },
  dialogueStack: { width: 'min(920px, 100%)', display: 'flex', flexDirection: 'column', gap: 12 },
  dialogueLine: { width: 'min(720px, 100%)', display: 'grid', gridTemplateColumns: '104px minmax(0, 1fr)', gap: 12, alignItems: 'stretch' },
  dialogueLineRight: { alignSelf: 'flex-end', gridTemplateColumns: '104px minmax(0, 1fr)' },
  dialoguePortraitFrame: { width: 104, aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(244, 201, 130, 0.42)', background: 'rgba(15, 23, 42, 0.78)', boxShadow: '0 12px 28px rgba(0,0,0,0.34)' },
  dialogueTextBox: { minHeight: 104, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, padding: '16px 18px', borderRadius: 12, background: 'linear-gradient(180deg, rgba(10, 22, 38, 0.96), rgba(13, 28, 48, 0.98))', border: '1px solid rgba(191, 219, 254, 0.28)', color: '#eef6ff', boxShadow: '0 16px 44px rgba(0,0,0,0.38)', fontSize: 18, lineHeight: 1.5 },
  systemMessageWindow: { width: 'min(640px, 100%)', display: 'flex', flexDirection: 'column', gap: 8, padding: '20px 22px', borderRadius: 14, background: 'linear-gradient(180deg, rgba(13, 30, 52, 0.98), rgba(7, 17, 31, 0.98))', border: '1px solid rgba(250, 204, 21, 0.34)', color: '#f8fbff', boxShadow: '0 20px 60px rgba(0,0,0,0.42)', fontSize: 18, lineHeight: 1.5 },
  dialogueAdvanceHint: { color: '#b7c9e3', fontSize: 12, letterSpacing: '0.08em' },
  tradeMeta: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  tradeSub: { color: '#93a8c4', fontSize: 12 },
  marketRowDense: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.035)' },
  tradeControlsDense: { display: 'flex', alignItems: 'center', gap: 8 },
  quantityInput: { width: 60, padding: '7px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: '#fff' },
  compactFigure: { minWidth: 72, textAlign: 'right', color: '#eef4ff', fontSize: 12 },
  emptyState: { color: '#7b8fab', fontSize: 13, padding: '14px 4px' },
  serviceGrid: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  inlineButtonGroup: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  serviceColumns: { display: 'grid', gridTemplateColumns: '1fr', gap: 16 },
  facilityTargetRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: 12, borderRadius: 14, border: '1px solid rgba(96, 165, 250, 0.24)', background: 'rgba(37, 99, 235, 0.08)' },
  commandTargetLabel: { display: 'flex', alignItems: 'center', gap: 8, color: '#b7c9e3', fontSize: 12 },
  commandTargetSelect: { minWidth: 220, padding: '9px 10px', borderRadius: 10, border: '1px solid rgba(147, 197, 253, 0.45)', background: '#10233d', color: '#edf3fb' },
  fleetDockGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 },
  fleetDockCard: { padding: 10, borderRadius: 12, border: '1px solid rgba(148, 163, 184, 0.22)', background: 'rgba(255,255,255,0.035)', color: '#e8f1ff', cursor: 'pointer', textAlign: 'left' },
  fleetDockCardActive: { border: '1px solid rgba(96, 165, 250, 0.72)', background: 'rgba(37, 99, 235, 0.18)' },
  fleetDockEmpty: { padding: 10, borderRadius: 12, border: '1px dashed rgba(148, 163, 184, 0.18)', color: '#71839d' },
  fleetDockHeader: { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8, fontSize: 12 },
  fleetDockStat: { display: 'grid', gridTemplateColumns: '78px 1fr', alignItems: 'center', gap: 8, color: '#a9bad2', fontSize: 11, marginTop: 5 },
  fleetDockMeter: { height: 6, borderRadius: 999, background: 'rgba(148, 163, 184, 0.18)', overflow: 'hidden' },
  fleetDockMeterFill: { height: '100%', borderRadius: 999, background: '#60a5fa' },
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












