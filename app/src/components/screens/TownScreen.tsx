import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { SUPPLY_UNIT_COSTS, usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useUIStore } from '@/stores/useUIStore.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { useEconomyStore } from '@/stores/useEconomyStore.ts'
import { MAX_ACTIVE_QUESTS, useQuestStore } from '@/stores/useQuestStore.ts'
import { VOYAGE_CONFIG } from '@/config/gameConfig.ts'
import { OFFICER_ROLE_DEFINITIONS, formatOfficerRoleEffect, formatOfficerStats, getAssignedOfficer, getAssignedOfficerForRole, getOfficerAssignmentLabel, getOfficerShipEffects } from '@/game/officers/officerEffects.ts'
import { generateTavernOfficerOffers, getOfficerSpecialtyLabel, localizeOfficerName } from '@/game/officers/officerGenerator.ts'
import { isQuestDeadlineNotice } from '@/game/quest/questNotices.ts'
import { EXPERIENCE_TRACKS, getTrackProgress } from '@/game/player/progression.ts'
import { ShipModelRenderer, ShipRenderer } from '@/rendering/ShipRenderer.tsx'
import { CombatQuestIcon } from '@/components/CombatQuestIcon.tsx'
import { TradeGoodIcon } from '@/components/TradeGoodIcon.tsx'
import { AdventureQuestIcon, DiscoveryIcon } from '@/components/DiscoveryIcon.tsx'
import { useResponsiveUiMetrics } from '@/ui/responsive.ts'
import { antiqueAssets, antiqueColors, antiqueFonts, antiqueStyles } from '@/ui/antiqueTheme.ts'
import type { Officer, OfficerStats } from '@/types/character.ts'
import type { Discovery, DiscoveryCategory } from '@/types/discovery.ts'
import type { Port } from '@/types/port.ts'
import type { Quest, QuestCategory, QuestRank, QuestReward, TradeQuestCategory } from '@/types/quest.ts'
import type { OfficerRoleSlot, ShipInstance, ShipType } from '@/types/ship.ts'
import type { PriceTrend } from '@/types/trade.ts'
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
type ActionResult = {
  ok?: boolean
  message: string
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
const SUPPLY_STEP = 12
const EMERGENCY_REPAIR_REQUEST = 12
const TOWN_ACTION_NOTICE_DURATION_MS = 2600
const TOWN_ACTION_WARNING_NOTICE_DURATION_MS = 4200
const SHIP_PREVIEW_POSITION: [number, number, number] = [0, -0.62, 0]
const SHIP_PREVIEW_SCALE = 0.56
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
  { section: 'departure', label: '出航所', caption: '河岸の桟橋', x: 78, y: 72, tone: '#2f5d7c', emblem: '⚓' },
  { section: 'market', label: '市場', caption: '港前広場', x: 38, y: 60, tone: '#7a4f00', emblem: '◇' },
  { section: 'guild', label: 'ギルド', caption: '商館街', x: 53, y: 49, tone: '#6f4f83', emblem: '✦' },
  { section: 'tavern', label: '酒場', caption: '坂道の路地', x: 63, y: 64, tone: '#8b1a1a', emblem: '♬' },
  { section: 'shipyard', label: '造船所', caption: '河口の船渠', x: 23, y: 72, tone: '#2f6b45', emblem: '▱' },
  { section: 'bank', label: '銀行', caption: '城壁内の両替商', x: 55, y: 34, tone: '#6f520f', emblem: '¤' },
  { section: 'inventory', label: '保管庫', caption: '倉庫街', x: 27, y: 48, tone: '#3b6b76', emblem: '□' },
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

function formatQuestCategory(category?: QuestCategory): string {
  if (category === 'adventure_discovery') return '冒険'
  if (category === 'combat_bounty') return '討伐'
  if (category === 'trade_procurement') return '仕入'
  if (category === 'trade_sales') return '売却'
  return '納品'
}

function formatDiscoveryCategory(category: DiscoveryCategory): string {
  if (category === 'geography') return '地理'
  if (category === 'ruins') return '遺跡'
  if (category === 'treasure') return '財宝'
  if (category === 'natural') return '自然'
  return '伝承'
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

function getPortName(ports: Port[], portId?: string): string {
  if (!portId) return '-'
  return ports.find((port) => port.id === portId)?.name ?? portId
}

function isDiscoveryQuestFound(quest: Quest): boolean {
  return quest.status === 'ready_to_turn_in' || quest.objectives.some((objective) => objective.type === 'discover' && objective.current >= objective.count)
}

function getAdventureQuestSubject(quest: Quest): string {
  const method = quest.metadata?.discoveryMethod === 'search' ? '探索' : '視認'
  const target = isDiscoveryQuestFound(quest) ? quest.metadata?.discoveryName ?? '発見物' : '未確認の発見物'
  return `${target} / ${method}`
}

function formatTradeQuestRoute(quest: Quest, ports: Port[]): string {
  if (quest.metadata?.category === 'adventure_discovery') {
    const target = isDiscoveryQuestFound(quest) ? quest.metadata.discoveryName ?? '発見物' : '手がかりの示す発見物'
    return `調査対象 ${target} / 報告先 ${getPortName(ports, getQuestReportPortId(quest))}`
  }
  if (quest.metadata?.category === 'combat_bounty') {
    const appearanceName = getPortName(ports, quest.metadata.combatTargetAppearancePortId)
    const patrolName = getPortName(ports, quest.metadata.combatTargetPatrolPortId)
    return `${appearanceName}港付近に出没 / ${patrolName}方面を巡回`
  }

  const sourceName = getPortName(ports, quest.metadata?.sourcePortId)
  const destinationName = getPortName(ports, quest.metadata?.destinationPortId ?? getQuestReportPortId(quest))
  if (quest.metadata?.category === 'trade_procurement') {
    return `仕入先 ${sourceName} / 納品先 ${destinationName}`
  }
  if (quest.metadata?.category === 'trade_sales') {
    return `売却先 ${destinationName}`
  }
  return `仕入 ${sourceName} / 納品先 ${destinationName}`
}

function formatTradeQuestInstruction(quest: Quest, ports: Port[], goodName?: string): string {
  if (quest.metadata?.category === 'adventure_discovery') {
    const method = quest.metadata.discoveryMethod === 'search' ? '探索' : '視認'
    return `${quest.metadata.discoveryHint ?? '手がかりの示す海域へ向かう'} 周辺で${method}を行う`
  }
  if (quest.metadata?.category === 'combat_bounty') {
    const targetName = quest.metadata.combatTargetName ?? '討伐対象'
    const appearanceName = getPortName(ports, quest.metadata.combatTargetAppearancePortId)
    return `${appearanceName}港付近で ${targetName} の艦隊を捕捉して撃破する`
  }

  const sourceName = getPortName(ports, quest.metadata?.sourcePortId)
  const destinationName = getPortName(ports, quest.metadata?.destinationPortId ?? getQuestReportPortId(quest))
  const quantity = quest.metadata?.quantity ?? 0
  const itemName = goodName ?? quest.metadata?.goodId ?? '指定品'
  if (quest.metadata?.category === 'trade_procurement') {
    return `${sourceName} で ${itemName} x${quantity} を買い、${destinationName} へ持ち帰る`
  }
  if (quest.metadata?.category === 'trade_sales') {
    return `${destinationName} で ${itemName} x${quantity} を売却する`
  }
  return `${sourceName} で ${itemName} x${quantity} を買い、${destinationName} へ届ける`
}

function getQuestActionLabel(category?: TradeQuestCategory): string {
  if (category === 'trade_procurement') return '仕入品を納品'
  return '納品する'
}

function formatObjectiveLabel(type: string): string {
  if (type === 'buy_item') return '買い付け'
  if (type === 'sell_item') return '売却'
  if (type === 'deliver_item' || type === 'deliver_cargo') return '納品'
  if (type === 'discover') return '発見'
  if (type === 'defeat_enemy') return '討伐'
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

function formatExpProgress(current: number, required: number): string {
  if (required <= 0) return 'MAX'
  return `${Math.floor(current)} / ${required}`
}

function formatFactorBonus(factor: number, inverse = false): string {
  const value = inverse ? (1 - factor) * 100 : (factor - 1) * 100
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

function getMarketTrendBadge(trend: PriceTrend): { icon: string; label: string; tone: string; title: string } {
  if (trend === 'boom') return { icon: '↑', label: '高騰', tone: '#8b1a1a', title: '相場が高く、売却向きです。' }
  if (trend === 'rising') return { icon: '↗', label: '上昇', tone: '#9c6b0f', title: '相場が上がっています。' }
  if (trend === 'falling') return { icon: '↘', label: '下落', tone: '#235c57', title: '相場が下がっています。' }
  if (trend === 'crash') return { icon: '↓', label: '暴落', tone: '#2f5d7c', title: '相場が大きく下がり、買付向きです。' }
  return { icon: '・', label: '安定', tone: '#6b5a3d', title: '相場は安定しています。' }
}

function getSliderQuantity(value: number, max: number): number {
  return Math.max(1, Math.min(Math.max(1, max), Math.floor(value) || 1))
}

function getOfficerRoleSelectValue(officerId?: string): string {
  return officerId ?? ''
}

function getRoleOfficerId(ship: ShipInstance | undefined, role: OfficerRoleSlot): string | undefined {
  if (!ship) return undefined
  if (role === 'captain') return ship.officerAssignments?.captain ?? ship.captainOfficerId
  return ship.officerAssignments?.[role]
}

function getGaugeRatio(current?: number, max?: number): number {
  return Math.max(0, Math.min(1, (current ?? 0) / Math.max(1, max ?? 1)))
}

function getGaugeTone(ratio: number): string {
  if (ratio < 0.3) return '#ef4444'
  if (ratio < 0.6) return '#f59e0b'
  return '#60a5fa'
}

function estimateEmergencyRepairGain(missingDurability: number, facilityLevel: number, repairFactor = 1): number {
  if (missingDurability <= 0) return 0
  const requested = Math.min(missingDurability, EMERGENCY_REPAIR_REQUEST)
  const baseGain = Math.min(
    missingDurability,
    Math.max(4, Math.floor(requested * (VOYAGE_CONFIG.EMERGENCY_REPAIR_EFFICIENCY + facilityLevel * 0.03))),
  )
  return Math.min(missingDurability, Math.max(1, Math.floor(baseGain * repairFactor)))
}

function getShipyardRequirement(category: string): number {
  if (category === 'small_sail') return 1
  if (category === 'medium_sail' || category === 'galley') return 2
  if (category === 'oriental') return 3
  return 4
}

function estimateShipSalePrice(ship: ShipInstance, shipType: ShipType | undefined): number {
  if (!shipType) return 0
  const durabilityRatio = ship.currentDurability / Math.max(1, ship.maxDurability)
  const upgradeValue = (ship.upgrades?.rigging ?? 0) * 1200 + (ship.upgrades?.cargo ?? 0) * 1400 + (ship.upgrades?.gunnery ?? 0) * 1600
  return Math.max(250, Math.round((shipType.price * 0.48 + upgradeValue) * (0.72 + durabilityRatio * 0.28)))
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
          stroke="rgba(90, 61, 43, 0.34)"
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
            <line x1={center} y1={center} x2={x} y2={y} stroke="rgba(90, 61, 43, 0.28)" strokeWidth="1" />
            <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="central" fill="#3f2b20" fontSize="10" fontWeight="700">{axis.label}</text>
          </g>
        )
      })}
      <polygon points={valuePoints} fill="rgba(35, 92, 87, 0.34)" stroke="#235c57" strokeWidth="2.4" />
      {OFFICER_STAT_AXES.map((axis, index) => {
        const [x, y] = getRadarPoint(index, total, stats[axis.key], radius, center).split(',').map(Number)
        return <circle key={`${axis.key}-value`} cx={x} cy={y} r="3.2" fill="#b8860b" stroke="#3f2b20" strokeWidth="0.7" />
      })}
    </svg>
  )
}

function ShipGaugeRow({ label, current, max }: { label: string; current: number; max: number }) {
  const ratio = getGaugeRatio(current, max)
  return (
    <div style={styles.shipGaugeRow}>
      <span style={styles.shipGaugeLabel}>{label}</span>
      <div style={styles.shipGaugeTrack}>
        <div style={{ ...styles.shipGaugeFill, width: `${Math.round(ratio * 100)}%`, background: getGaugeTone(ratio) }} />
      </div>
      <strong style={styles.shipGaugeValue}>{current}/{max}</strong>
    </div>
  )
}

function ShipPreviewCamera() {
  const { camera } = useThree()

  useEffect(() => {
    camera.lookAt(0, -0.18, 0)
    camera.updateProjectionMatrix()
  }, [camera])

  return null
}

function ShipModelPreview({ modelId, compact = false }: { modelId?: string; compact?: boolean }) {
  return (
    <div style={compact ? styles.shipModelViewportCompact : styles.shipModelViewport}>
      <Canvas camera={{ position: [5.8, 2.9, 7.2], fov: 42, near: 0.1, far: 100 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#071323']} />
        <ShipPreviewCamera />
        <ambientLight intensity={0.82} />
        <directionalLight position={[4, 7, 5]} intensity={2.1} />
        <directionalLight position={[-5, 3, -4]} intensity={0.65} color="#7dd3fc" />
        <Suspense fallback={<ShipRenderer position={SHIP_PREVIEW_POSITION} heading={34} scale={SHIP_PREVIEW_SCALE} />}>
          <ShipModelRenderer position={SHIP_PREVIEW_POSITION} heading={34} scale={SHIP_PREVIEW_SCALE} modelId={modelId} />
        </Suspense>
      </Canvas>
    </div>
  )
}

function SelectedShipConditionPanel({ ship, shipType, roleLabel }: { ship?: ShipInstance; shipType?: ShipType; roleLabel: string }) {
  if (!ship) {
    return <div style={styles.selectedShipPanel}><div style={styles.emptyState}>船が選択されていません。</div></div>
  }
  return (
    <div style={styles.selectedShipPanel}>
      <ShipModelPreview modelId={shipType?.modelId} />
      <div style={styles.selectedShipInfo}>
        <div style={styles.selectedShipTitleRow}>
          <span style={styles.featureBadge}>{roleLabel}</span>
          <div style={styles.tradeMeta}>
            <strong>{shipType?.name ?? ship.name}</strong>
            <span style={styles.tradeSub}>速力 {shipType?.speed ?? '-'} / 旋回 {shipType?.turnRate ?? '-'} / 砲門 {shipType?.cannonSlots ?? '-'}</span>
          </div>
        </div>
        <ShipGaugeRow label="耐久" current={ship.currentDurability} max={ship.maxDurability} />
        <ShipGaugeRow label="船員" current={ship.currentCrew} max={ship.maxCrew} />
      </div>
    </div>
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

function DialogueLineWindow({ portraitUrl, speaker, message }: { portraitUrl: string; speaker: string; message: string }) {
  return (
    <div style={styles.dialogueLine}>
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

function getActionButtonStyle(baseStyle: React.CSSProperties, disabled: boolean): React.CSSProperties {
  return disabled ? { ...baseStyle, ...styles.disabledButton } : baseStyle
}

export function TownScreen({ onManualSave, onLoadLatest }: TownScreenProps) {
  const responsiveUi = useResponsiveUiMetrics()
  const compactLayout = responsiveUi.isCompact
  const portId = useNavigationStore((s) => s.dockedPortId)
  const ports = useWorldStore((s) => s.ports)
  const player = usePlayerStore((s) => s.player)
  const ships = usePlayerStore((s) => s.ships)
  const officers = usePlayerStore((s) => s.officers)
  const activeShipId = usePlayerStore((s) => s.activeShipId)
  const setActiveShip = usePlayerStore((s) => s.setActiveShip)
  const setPhase = useGameStore((s) => s.setPhase)
  const day = useGameStore((s) => Math.floor(s.timeState.totalDays))
  const getShip = useDataStore((s) => s.getShip)
  const getTradeGood = useDataStore((s) => s.getTradeGood)
  const shipCatalog = useDataStore((s) => s.masterData.ships)
  const discoveries = useDataStore((s) => s.masterData.discoveries)
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
  const assignOfficerToRole = usePlayerStore((s) => s.assignOfficerToRole)
  const unassignOfficerRole = usePlayerStore((s) => s.unassignOfficerRole)
  const repairShip = usePlayerStore((s) => s.repairShip)
  const repairFleet = usePlayerStore((s) => s.repairFleet)
  const purchaseShip = usePlayerStore((s) => s.purchaseShip)
  const sellShip = usePlayerStore((s) => s.sellShip)
  const sellInventoryItem = usePlayerStore((s) => s.sellInventoryItem)
  const outfitShip = usePlayerStore((s) => s.outfitShip)
  const ensurePortQuests = useQuestStore((s) => s.ensurePortQuests)
  const availableByPort = useQuestStore((s) => s.availableByPort)
  const activeQuests = useQuestStore((s) => s.activeQuests)
  const activeQuest = useQuestStore((s) => s.activeQuest)
  const acceptQuest = useQuestStore((s) => s.acceptQuest)
  const selectActiveQuest = useQuestStore((s) => s.selectActiveQuest)
  const deliverTradeQuestCargo = useQuestStore((s) => s.deliverTradeQuestCargo)
  const turnInQuest = useQuestStore((s) => s.turnInQuest)
  const lastQuestNotice = useQuestStore((s) => s.lastQuestNotice)
  const clearQuestNotice = useQuestStore((s) => s.clearQuestNotice)

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [tradeMessageState, setTradeMessageState] = useState<{ portId: string | null; message: string | null; ok?: boolean }>({ portId: null, message: null })
  const [activeSection, setActiveSection] = useState<TownSection>('overview')
  const questBoardPortRef = useRef<string | null>(null)
  const actionNoticeTimeoutRef = useRef<number | null>(null)
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
  const missingFoodSupply = Math.max(0, Math.ceil(fleetSupply.maxFood - fleetSupply.food))
  const missingWaterSupply = Math.max(0, Math.ceil(fleetSupply.maxWater - fleetSupply.water))
  const fullResupplyCost = missingFoodSupply * SUPPLY_UNIT_COSTS.food + missingWaterSupply * SUPPLY_UNIT_COSTS.water
  const fullResupplyShortage = Math.max(0, fullResupplyCost - (player?.money ?? 0))
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

  useEffect(() => () => {
    if (actionNoticeTimeoutRef.current !== null) {
      window.clearTimeout(actionNoticeTimeoutRef.current)
      actionNoticeTimeoutRef.current = null
    }
  }, [])

  const marketRows = (market?.items ?? [])
    .map((item) => {
      const good = getTradeGood(item.goodId)
      if (!good) return null
      const quantity = quantities[item.goodId] ?? 1
      const quote = portId ? getBuyQuote(portId, item.goodId, quantity, marketTargetShip?.instanceId) : null
      const limit = portId ? getPurchaseLimit(portId, item.goodId) : 0
      return { item, good, quantity, quote, limit }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.quote!.unitPrice - b.quote!.unitPrice)

  const cargoRows = (marketTargetShip?.cargo ?? [])
    .map((slot) => {
      const good = getTradeGood(slot.goodId)
      if (!good) return null
      const quantity = quantities[slot.goodId] ?? 1
      const quote = portId ? getSellQuote(portId, slot.goodId, quantity, marketTargetShip?.instanceId) : null
      return { slot, good, quantity, quote }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => b.quote!.unitPrice - a.quote!.unitPrice)

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
  const discoveredDiscoveries = useMemo<Discovery[]>(() => {
    const discoveredIds = player?.discoveredDiscoveryIds ?? []
    return discoveredIds
      .map((discoveryId) => discoveries.find((discovery) => discovery.id === discoveryId))
      .filter((discovery): discovery is Discovery => Boolean(discovery))
  }, [discoveries, player?.discoveredDiscoveryIds])

  if (!port) return <div style={styles.container}><div style={styles.card}>港が選択されていません。</div></div>

  const setQuantity = (goodId: string, nextValue: number, max = 200) => setQuantities((current) => ({ ...current, [goodId]: getSliderQuantity(nextValue, max) }))
  const handleAction = (result: ActionResult) => {
    clearQuestNotice()
    if (actionNoticeTimeoutRef.current !== null) {
      window.clearTimeout(actionNoticeTimeoutRef.current)
    }
    setTradeMessageState({ portId: port.id, message: result.message, ok: result.ok })
    const noticePortId = port.id
    const noticeMessage = result.message
    actionNoticeTimeoutRef.current = window.setTimeout(() => {
      setTradeMessageState((current) => (
        current.portId === noticePortId && current.message === noticeMessage
          ? { portId: null, message: null }
          : current
      ))
      actionNoticeTimeoutRef.current = null
    }, result.ok === false ? TOWN_ACTION_WARNING_NOTICE_DURATION_MS : TOWN_ACTION_NOTICE_DURATION_MS)
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
  const acceptedQuests = activeQuests.length > 0 ? activeQuests : activeQuest ? [activeQuest] : []
  const selectedQuest = activeQuest && acceptedQuests.some((quest) => quest.id === activeQuest.id) ? activeQuest : acceptedQuests[0] ?? null
  const selectedQuestCategory = selectedQuest?.metadata?.category
  const questGood = selectedQuest?.metadata?.goodId ? getTradeGood(selectedQuest.metadata.goodId) : null
  const questReportPortId = getQuestReportPortId(selectedQuest)
  const isQuestDelivered = Boolean(selectedQuest?.metadata?.delivered || selectedQuest?.status === 'ready_to_turn_in')
  const canDeliverQuest = Boolean(selectedQuest && (selectedQuestCategory === 'trade_delivery' || selectedQuestCategory === 'trade_procurement') && questReportPortId === port.id && questGood && !isQuestDelivered)
  const canReportQuest = Boolean(selectedQuest && isQuestDelivered && questReportPortId === port.id)
  const rewardSummary = (selectedQuest?.rewards ?? []).map(formatReward).join(' / ')
  const activeQuestRoute = selectedQuest ? formatTradeQuestRoute(selectedQuest, ports) : ''
  const activeQuestInstruction = selectedQuest ? formatTradeQuestInstruction(selectedQuest, ports, questGood?.name) : ''
  const activeQuestSubject = selectedQuestCategory === 'combat_bounty'
    ? `${selectedQuest?.metadata?.combatTargetName ?? '討伐対象'} / 報告不要`
    : selectedQuestCategory === 'adventure_discovery'
      ? getAdventureQuestSubject(selectedQuest)
      : `${questGood?.name ?? '-'} x ${selectedQuest?.metadata?.quantity ?? 0}`
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
  const actionNotice = tradeMessageState.portId === port.id && tradeMessageState.message ? tradeMessageState : null
  const notice = actionNotice?.message ?? lastQuestNotice
  const noticeStyle = actionNotice?.ok === false || (!actionNotice && isQuestDeadlineNotice(lastQuestNotice)) ? { ...styles.notice, ...styles.noticeWarning } : styles.notice
  const repairTargetShipType = repairTargetShip ? getShip(repairTargetShip.typeId) : undefined
  const tavernTargetShipType = tavernTargetShip ? getShip(tavernTargetShip.typeId) : undefined
  const missingDurability = Math.max(0, (repairTargetShip?.maxDurability ?? 0) - (repairTargetShip?.currentDurability ?? 0))
  const fleetMissingDurability = ships.reduce((sum, ship) => sum + Math.max(0, ship.maxDurability - ship.currentDurability), 0)
  const damagedShipCount = ships.filter((ship) => ship.currentDurability < ship.maxDurability).length
  const repairTargetRepairFactor = getOfficerShipEffects(repairTargetShip, officers).repairFactor
  const emergencyRepairGain = estimateEmergencyRepairGain(missingDurability, shipyardLevel, repairTargetRepairFactor)
  const emergencyRepairCostPerPoint = Math.max(2, VOYAGE_CONFIG.EMERGENCY_REPAIR_COST_PER_POINT - Math.floor(shipyardLevel / 2))
  const overhaulCostPerPoint = Math.max(VOYAGE_CONFIG.STANDARD_REPAIR_COST_PER_POINT, VOYAGE_CONFIG.OVERHAUL_COST_PER_POINT - Math.floor(shipyardLevel / 2))
  const emergencyRepairCost = emergencyRepairGain * emergencyRepairCostPerPoint
  const overhaulCost = missingDurability * overhaulCostPerPoint
  const fleetEmergencyRepairGain = ships.reduce((sum, ship) => sum + estimateEmergencyRepairGain(Math.max(0, ship.maxDurability - ship.currentDurability), shipyardLevel, getOfficerShipEffects(ship, officers).repairFactor), 0)
  const fleetEmergencyRepairCost = fleetEmergencyRepairGain * emergencyRepairCostPerPoint
  const fleetOverhaulCost = fleetMissingDurability * overhaulCostPerPoint
  const tavernMealCost = Math.max(20, Math.ceil(Math.max(1, tavernTargetShip?.currentCrew ?? 1) * VOYAGE_CONFIG.TAVERN_MEAL_COST_PER_CREW * (1 - tavernLevel * 0.04)))
  const tavernRoundsCost = Math.max(60, Math.ceil(VOYAGE_CONFIG.TAVERN_ROUND_BASE_COST * (1 + (tavernTargetShip?.maxCrew ?? 1) * 0.04) * (1 - tavernLevel * 0.03)))
  const tavernRecruitUnitCost = Math.max(10, 18 - tavernLevel * VOYAGE_CONFIG.TAVERN_RECRUIT_DISCOUNT_PER_LEVEL)
  const tavernOfficerOffers = tavernFacility
    ? generateTavernOfficerOffers(port, day, tavernLevel, player?.stats.fame ?? 0, officers.flatMap((officer) => [officer.id, officer.name]))
    : []
  const hiredOfficerIds = new Set(officers.map((officer) => officer.id))
  const consortShips = ships.filter((ship) => ship.instanceId !== activeShipId)
  const officerMonthlySalary = officers.reduce((sum, officer) => sum + officer.salary, 0)
  const progressionRows = player
    ? EXPERIENCE_TRACKS.map((track) => {
        const level = player.stats[track.levelKey]
        const progress = getTrackProgress(player.stats, track.id)
        return {
          id: track.id,
          label: track.label,
          level,
          exp: progress.current,
          requiredExp: progress.required,
        }
      })
    : []
  const flagshipOfficerEffects = getOfficerShipEffects(activeShip, officers)
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
  const renderFacilityShipSelect = (selectedShipId: string | null, onSelect: (shipId: string) => void, label = '対象船') => (
    <label style={styles.commandTargetLabel}>
      {label}
      <select style={styles.commandTargetSelect} value={selectedShipId ?? ''} onChange={(event) => onSelect(event.target.value)}>
        {ships.map((ship, index) => {
          const type = getShip(ship.typeId)
          const role = ship.instanceId === activeShipId ? '旗艦' : '僚船'
          return <option key={ship.instanceId} value={ship.instanceId}>第{index + 1}船 {role}: {type?.name ?? ship.name}</option>
        })}
      </select>
    </label>
  )
  const containerStyle = compactLayout ? { ...styles.container, ...styles.containerCompact } : styles.container
  const cardStyle = compactLayout ? { ...styles.card, ...styles.cardCompact } : styles.card
  const heroStyle = compactLayout ? { ...styles.hero, ...styles.heroCompact } : styles.hero
  const titleStyle = compactLayout ? { ...styles.title, ...styles.titleCompact } : styles.title
  const shellStyle = compactLayout ? { ...styles.shell, ...styles.shellCompact } : styles.shell
  const sidebarStyle = compactLayout ? { ...styles.sidebar, ...styles.sidebarCompact } : styles.sidebar
  const compactActionRowStyle = compactLayout ? { ...styles.compactActionRow, ...styles.compactActionRowCompact } : styles.compactActionRow
  const shipServiceCardStyle = compactLayout ? { ...styles.shipServiceCard, ...styles.shipServiceCardCompact } : styles.shipServiceCard
  const officerOfferCardStyle = compactLayout ? { ...styles.officerOfferCard, ...styles.officerOfferCardCompact } : styles.officerOfferCard

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={heroStyle}>
          <div>
            <p style={styles.eyebrow}>{uiText.town.labels.portOfCall}</p>
            <h2 style={titleStyle}>{port.name}</h2>
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
          <div style={styles.statCard}><span style={styles.statLabel}>航海士</span><strong>{officers.length} 名 / 月給 {officerMonthlySalary} d</strong></div>
          <div style={styles.statCard}><span style={styles.statLabel}>{uiText.town.labels.supplies}</span><strong>食 {fleetSupply.food.toFixed(0)}/{fleetSupply.maxFood.toFixed(0)} / 水 {fleetSupply.water.toFixed(0)}/{fleetSupply.maxWater.toFixed(0)}</strong></div>
        </div>

        <section style={styles.questBanner}>
          {acceptedQuests.length > 0 && (
            <div style={styles.activeQuestTabs}>
              {acceptedQuests.map((quest, index) => {
                const daysRemaining = getDaysRemaining(quest, day)
                const selected = selectedQuest?.id === quest.id
                return (
                  <button
                    key={quest.id}
                    type="button"
                    style={selected ? styles.activeQuestTabSelected : styles.activeQuestTab}
                    onClick={() => selectActiveQuest(quest.id)}
                  >
                    <span>{index + 1}. {formatQuestCategory(quest.metadata?.category)}</span>
                    <strong>{quest.title}</strong>
                    <small>残り {daysRemaining ?? '-'} 日</small>
                  </button>
                )
              })}
            </div>
          )}
          {!selectedQuest && <p style={styles.bannerText}>ギルド依頼を受けると、ここに進行状況がまとまって表示されます。</p>}
          {selectedQuest && (
            <>
              <div style={styles.bannerFacts}>
                {questGood && <TradeGoodIcon goodId={questGood.id} label={questGood.name} size={36} />}
                {selectedQuestCategory === 'adventure_discovery' && (
                  <AdventureQuestIcon method={selectedQuest.metadata?.discoveryMethod} size={36} />
                )}
                {selectedQuestCategory === 'combat_bounty' && (
                  <CombatQuestIcon label={selectedQuest.metadata?.combatTargetName ?? '討伐クエスト'} size={36} />
                )}
                <span>{activeQuestRoute}</span>
                <span>{activeQuestSubject}</span>
                <span>{rewardSummary}</span>
              </div>
              <div style={styles.bannerFacts}>
                <span>{activeQuestInstruction}</span>
              </div>
              <div style={styles.bannerFacts}>
                {selectedQuest.objectives.map((objective) => <span key={`${selectedQuest.id}-${objective.type}`}>{objective.current}/{objective.count} {formatObjectiveLabel(objective.type)}</span>)}
              </div>
              <div style={styles.bannerActions}>
                {(selectedQuestCategory === 'trade_delivery' || selectedQuestCategory === 'trade_procurement') && (
                  <button style={styles.secondaryButton} disabled={!canDeliverQuest} onClick={() => handleAction(deliverTradeQuestCargo())}>{getQuestActionLabel(selectedQuestCategory)}</button>
                )}
                {selectedQuestCategory !== 'combat_bounty' && (
                  <button
                    style={getActionButtonStyle(styles.primaryButton, !canReportQuest)}
                    disabled={!canReportQuest}
                    title={canReportQuest ? undefined : 'クエスト達成後に報告できます'}
                    onClick={() => handleAction(turnInQuest())}
                  >
                    {uiText.town.labels.reportComplete}
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {notice && <div style={noticeStyle}>{notice}</div>}

        <div style={shellStyle}>
          <aside style={sidebarStyle}>
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
                          ...(compactLayout ? styles.cityVistaCompact : {}),
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
                                ...(compactLayout ? styles.cityHotspotCompact : {}),
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
                    <div style={styles.infoBlock}><span style={styles.infoLabel}>{uiText.town.labels.captain}</span><strong>{player?.name ?? uiText.town.labels.unknown}</strong><small>名声 {player?.stats.fame ?? 0} / 悪名 {player?.stats.notoriety ?? 0}</small></div>
                    <div style={styles.infoBlock}><span style={styles.infoLabel}>艦隊</span><strong>{ships.length}/5 隻 / 旗艦 {shipType?.name ?? activeShip?.name ?? uiText.town.labels.none}</strong><small>船体 {fleetStats.durability}/{fleetStats.maxDurability} / 士気 {formatMorale(fleetMorale)}</small></div>
                  </div>
                </section>
                <section style={styles.panel}>
                  <div style={styles.panelHeader}>
                    <h3 style={styles.sectionTitle}>成長と役職効果</h3>
                    <span style={styles.panelHint}>経験値と旗艦補正</span>
                  </div>
                  <div style={styles.progressGrid}>
                    {progressionRows.map((row) => (
                      <div key={row.id} style={styles.progressCard}>
                        <div style={styles.progressHeader}>
                          <span>{row.label}</span>
                          <strong>Lv.{row.level}</strong>
                        </div>
                        <div style={styles.progressTrack}>
                          <div style={{ ...styles.progressFill, width: row.requiredExp > 0 ? `${Math.min(100, (row.exp / row.requiredExp) * 100)}%` : '100%' }} />
                        </div>
                        <span style={styles.tradeSub}>次Lv {formatExpProgress(row.exp, row.requiredExp)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={styles.effectGrid}>
                    <span>速力 {formatFactorBonus(flagshipOfficerEffects.speedFactor)}</span>
                    <span>旋回 {formatFactorBonus(flagshipOfficerEffects.turnFactor)}</span>
                    <span>売買 {formatFactorBonus(flagshipOfficerEffects.tradePriceFactor)}</span>
                    <span>砲術 {formatFactorBonus(flagshipOfficerEffects.gunneryFactor)}</span>
                    <span>修理 {formatFactorBonus(flagshipOfficerEffects.repairFactor)}</span>
                    <span>士気低下 {formatFactorBonus(flagshipOfficerEffects.moraleLossFactor, true)}</span>
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
                      const boardQuestGood = quest.metadata?.goodId ? getTradeGood(quest.metadata.goodId) : null
                      const isAdventureQuest = quest.metadata?.category === 'adventure_discovery'
                      const isCombatQuest = quest.metadata?.category === 'combat_bounty'
                      const routeSummary = formatTradeQuestRoute(quest, ports)
                      const questInstruction = formatTradeQuestInstruction(quest, ports, boardQuestGood?.name)
                      return (
                          <div key={quest.id} style={compactActionRowStyle}>
                          <div style={styles.tradeGoodSummary}>
                            {boardQuestGood && <TradeGoodIcon goodId={boardQuestGood.id} label={boardQuestGood.name} size={42} />}
                            {isAdventureQuest && <AdventureQuestIcon method={quest.metadata?.discoveryMethod} size={42} />}
                            {isCombatQuest && <CombatQuestIcon label={quest.metadata?.combatTargetName ?? '討伐クエスト'} size={42} />}
                            <div style={styles.tradeMeta}>
                              <div style={styles.questTitleRow}>
                                <span style={styles.questCategoryBadge}>{formatQuestCategory(quest.metadata?.category)}</span>
                                <strong>{quest.title}</strong>
                              </div>
                              <span style={styles.tradeSub}>{routeSummary}</span>
                              <span style={styles.tradeSub}>{questInstruction}</span>
                              <span style={styles.tradeSub}>{formatQuestRank(quest.rank)} / 名声 {formatQuestRequirement(quest.requiredFame)} / 必要Lv {formatQuestRequirement(quest.requiredLevel)} / 残り {daysRemaining ?? '-'} 日</span>
                              <span style={styles.tradeSub}>{quest.rewards.map(formatReward).join(' / ')}</span>
                            </div>
                          </div>
                          <button style={styles.primaryButton} disabled={acceptedQuests.length >= MAX_ACTIVE_QUESTS} onClick={() => handleAction(acceptQuest(quest.id, port.id))}>受注する</button>
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
                  <div style={styles.serviceColumns}>
                    <div style={styles.featureBanner}>
                      <span style={shipyardFacility ? styles.featureBadge : styles.featureBadgeMuted}>{shipyardFacility ? '整備' : '応急'}</span>
                      <div>
                        <strong>{shipyardFacility ? `港内整備 Lv.${shipyardLevel}` : uiText.town.labels.emergencyWorkshop}</strong>
                        <div style={styles.featureText}>{shipyardFacility ? '応急修理とオーバーホールが利用できます。' : 'この港では応急修理のみ可能です。'}</div>
                      </div>
                    </div>
                    <SelectedShipConditionPanel
                      ship={repairTargetShip}
                      shipType={repairTargetShipType}
                      roleLabel={repairTargetShip?.instanceId === activeShipId ? '旗艦' : '修理対象'}
                    />
                    <div style={styles.infoGridCompact}>
                      <div style={styles.infoBlock}><span style={styles.infoLabel}>{uiText.town.labels.supplies}</span><strong>食 {fleetSupply.food.toFixed(0)}/{fleetSupply.maxFood.toFixed(0)} / 水 {fleetSupply.water.toFixed(0)}/{fleetSupply.maxWater.toFixed(0)}</strong><small>満タンまで 食 {missingFoodSupply} / 水 {missingWaterSupply} / 費用 {fullResupplyCost} d</small></div>
                      <div style={styles.infoBlock}><span style={styles.infoLabel}>艦隊船体</span><strong>損傷 {damagedShipCount} 隻 / 不足 {fleetMissingDurability}</strong><small>{shipyardFacility ? '全艦オーバーホールに対応しています。' : '全艦応急修理に対応しています。'}</small></div>
                    </div>
                    <div>
                      <p style={styles.serviceLabel}>保有船</p>
                      <div style={styles.list}>
                        {ships.map((ship) => {
                          const type = getShip(ship.typeId)
                          const isRepairTarget = ship.instanceId === repairTargetShip?.instanceId
                          const captain = getAssignedOfficer(ship, officers)
                          return (
                            <div key={ship.instanceId} style={{ ...shipServiceCardStyle, ...(isRepairTarget ? styles.shipServiceCardActive : {}) }}>
                              <ShipModelPreview modelId={type?.modelId} compact />
                              <div style={styles.shipServiceBody}>
                                <div style={styles.shipServiceHeader}>
                                  <div style={styles.tradeMeta}>
                                    <strong>{type?.name ?? ship.name}</strong>
                                    <span style={styles.tradeSub}>{ship.instanceId === activeShipId ? uiText.town.labels.active : captain ? `船長 ${captain.name}` : '僚艦'}</span>
                                  </div>
                                  {isRepairTarget && <span style={styles.targetPill}>修理対象</span>}
                                </div>
                                <div style={styles.compactGaugeStack}>
                                  <ShipGaugeRow label="耐久" current={ship.currentDurability} max={ship.maxDurability} />
                                  <ShipGaugeRow label="船員" current={ship.currentCrew} max={ship.maxCrew} />
                                </div>
                                <span style={styles.tradeSub}>速力 {type?.speed ?? '-'} / 旋回 {type?.turnRate ?? '-'} / 砲門 {type?.cannonSlots ?? '-'}</span>
                              </div>
                              <div style={styles.shipServiceActions}>
                                <button style={isRepairTarget ? styles.secondaryButton : styles.primaryButton} disabled={isRepairTarget} onClick={() => setRepairTargetShipId(ship.instanceId)}>
                                  {isRepairTarget ? '選択中' : '修理対象に選ぶ'}
                                </button>
                              </div>
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
                        <button style={styles.primaryButton} onClick={() => handleAction(resupplyShip('all'))}>{uiText.town.labels.fullResupply} {fullResupplyCost} d</button>
                      </div>
                      {fullResupplyShortage > 0 && (
                        <div style={styles.serviceNote}>一括補給にはあと {fullResupplyShortage} d 必要です。食料/水の個別補給なら所持金の範囲で実行できます。</div>
                      )}
                    </div>
                    <div>
                      <div style={styles.facilityTargetRow}>
                        <span style={styles.serviceNote}>修理対象の船</span>
                        {renderFacilityShipSelect(repairTargetShip?.instanceId ?? fallbackShipId, setRepairTargetShipId, '修理対象')}
                      </div>
                      <p style={styles.serviceLabel}>{uiText.town.labels.repair}</p>
                      <div style={styles.serviceGrid}>
                        <button style={styles.secondaryButton} disabled={missingDurability <= 0} onClick={() => handleAction(repairShip('emergency', EMERGENCY_REPAIR_REQUEST, shipyardLevel, repairTargetShip?.instanceId))}>応急修理 {emergencyRepairCost} d</button>
                        {shipyardFacility && <button style={styles.primaryButton} disabled={missingDurability <= 0} onClick={() => handleAction(repairShip('overhaul', undefined, shipyardLevel, repairTargetShip?.instanceId))}>{uiText.town.labels.overhaul} {overhaulCost} d</button>}
                        <button style={styles.secondaryButton} disabled={damagedShipCount <= 0} onClick={() => handleAction(repairFleet('emergency', EMERGENCY_REPAIR_REQUEST, shipyardLevel))}>全艦応急修理 {fleetEmergencyRepairCost} d</button>
                        {shipyardFacility && <button style={styles.primaryButton} disabled={damagedShipCount <= 0} onClick={() => handleAction(repairFleet('overhaul', undefined, shipyardLevel))}>全艦オーバーホール {fleetOverhaulCost} d</button>}
                      </div>
                      <div style={styles.serviceNote}>{shipyardFacility ? 'オーバーホールは耐久を全快し、消耗の蓄積も整えます。全艦ボタンは損傷している船だけを対象にします。' : '造船所がない港では応急修理のみ可能です。'}</div>
                    </div>
                    <div style={styles.departRow}>
                      <button style={styles.leaveButton} onClick={() => {
                        const nav = useNavigationStore.getState()
                        useUIStore.getState().setResumed()
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
                <section style={styles.panel}>
                  <div style={styles.panelHeader}>
                    <h3 style={styles.sectionTitle}>発見記録</h3>
                    <span style={styles.panelHint}>発見済みの発見物のみ表示</span>
                  </div>
                  {discoveredDiscoveries.length > 0 ? (
                    <div style={styles.discoveryGrid}>
                      {discoveredDiscoveries.map((discovery) => (
                        <div key={discovery.id} style={styles.discoveryCard}>
                          <DiscoveryIcon discoveryId={discovery.id} label={discovery.name} size={54} />
                          <div style={styles.discoveryMeta}>
                            <div style={styles.questTitleRow}>
                              <span style={styles.discoveryCategoryBadge}>{formatDiscoveryCategory(discovery.category)}</span>
                              <strong>{discovery.name}</strong>
                            </div>
                            <span style={styles.tradeSub}>{discovery.description}</span>
                            <span style={styles.tradeSub}>報告先 {getPortName(ports, discovery.reportPortId)} / ランク {discovery.rank}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={styles.emptyState}>発見済みの発見物はありません。</div>
                  )}
                </section>
              </div>
            )}

            {visibleSection === 'market' && hasMarket && (
              <div style={styles.contentStack}>
                <div style={styles.facilityTargetRow}>
                  <span style={styles.serviceNote}>市場で積荷を扱う船</span>
                  {renderFacilityShipSelect(marketTargetShip?.instanceId ?? fallbackShipId, setMarketTargetShipId, '積荷を扱う船')}
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
                        const purchaseCap = Math.max(0, Math.min(item.stock, limit))
                        const remainingCapacity = (marketTargetShip?.maxCapacity ?? 0) - (marketTargetShip?.usedCapacity ?? 0)
                        const capacityCap = Math.max(0, Math.floor(remainingCapacity / Math.max(0.1, good.weight)))
                        const unitPrice = quote?.unitPrice ?? item.currentPrice
                        const moneyCap = Math.max(0, Math.floor((player?.money ?? 0) / Math.max(1, unitPrice)))
                        const maxBuyQuantity = Math.max(0, Math.min(purchaseCap, capacityCap, moneyCap))
                        const selectedQuantity = maxBuyQuantity > 0 ? getSliderQuantity(quantity, maxBuyQuantity) : 1
                        const selectedQuote = portId && selectedQuantity !== quantity ? getBuyQuote(portId, item.goodId, selectedQuantity, marketTargetShip?.instanceId) : quote
                        const totalWeight = good.weight * selectedQuantity
                        const exceedsCap = selectedQuantity > purchaseCap && purchaseCap > 0
                        const exceedsCapacity = totalWeight > remainingCapacity
                        const trendBadge = getMarketTrendBadge(item.trend)
                        return (
                          <div key={good.id} style={styles.marketRowDense}>
                            <div style={styles.tradeGoodSummary}>
                              <TradeGoodIcon goodId={good.id} label={good.name} />
                              <div style={styles.tradeMeta}>
                                <strong style={styles.tradeGoodName}>{good.name}</strong>
                                <span style={styles.marketQuoteLine}>
                                  <span>{quote?.unitPrice ?? item.currentPrice} d</span>
                                  <span>在庫 {item.stock}</span>
                                  <span>上限 {limit}</span>
                                  <span title={trendBadge.title} style={{ ...styles.marketTrendBadge, borderColor: `${trendBadge.tone}88`, color: trendBadge.tone, background: `${trendBadge.tone}1f` }}>
                                    <span style={styles.marketTrendIcon}>{trendBadge.icon}</span>
                                    {trendBadge.label}
                                  </span>
                                </span>
                                {purchaseCap <= 0 && <span style={styles.tradeBlocked}>この港では今日はこれ以上買えません。</span>}
                                {exceedsCap && <span style={styles.tradeBlocked}>数量が購入上限を超えています。</span>}
                                {exceedsCapacity && <span style={styles.tradeBlocked}>選択中の船の船倉容量が足りません。</span>}
                              </div>
                            </div>
                            <div style={styles.tradeControlsDense}>
                              <div style={styles.quantitySliderGroup}>
                                <div style={styles.quantitySliderHeader}>
                                  <span>数量 {maxBuyQuantity > 0 ? selectedQuantity : 0}</span>
                                  <button style={styles.miniButton} disabled={maxBuyQuantity <= 0} onClick={() => setQuantity(good.id, maxBuyQuantity, maxBuyQuantity)}>MAX</button>
                                </div>
                                <input type="range" min={1} max={Math.max(1, maxBuyQuantity)} value={maxBuyQuantity > 0 ? selectedQuantity : 1} onChange={(e) => setQuantity(good.id, Number(e.target.value), maxBuyQuantity)} style={styles.quantitySlider} disabled={maxBuyQuantity <= 0} />
                              </div>
                              <div style={styles.marketAmountStack}>
                                <strong>{selectedQuote?.totalPrice ?? item.currentPrice} d</strong>
                                <span>積載 {totalWeight.toFixed(1)}</span>
                              </div>
                              <button style={{ ...styles.primaryButton, ...styles.tradeActionButton }} disabled={!marketTargetShip || maxBuyQuantity <= 0 || exceedsCap || exceedsCapacity} onClick={() => handleAction(buyGood(port.id, good.id, selectedQuantity, marketTargetShip?.instanceId))}>{uiText.town.labels.buyAction}</button>
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
                        const maxSellQuantity = Math.max(1, slot.quantity)
                        const selectedQuantity = getSliderQuantity(quantity, maxSellQuantity)
                        const selectedQuote = portId && selectedQuantity !== quantity ? getSellQuote(portId, slot.goodId, selectedQuantity, marketTargetShip?.instanceId) : quote
                        const estimatedProfit = selectedQuote ? (selectedQuote.unitPrice - slot.buyPrice) * selectedQuantity : 0
                        return (
                          <div key={good.id} style={styles.marketRowDense}>
                            <div style={styles.tradeGoodSummary}>
                              <TradeGoodIcon goodId={good.id} label={good.name} />
                              <div style={styles.tradeMeta}>
                                <strong style={styles.tradeGoodName}>{good.name}</strong>
                                <span style={styles.tradeSub}>所持 {slot.quantity} / 売値 {quote?.unitPrice ?? 0} d / 利益 {estimatedProfit >= 0 ? '+' : ''}{estimatedProfit} d</span>
                              </div>
                            </div>
                            <div style={styles.tradeControlsDense}>
                              <div style={styles.quantitySliderGroup}>
                                <div style={styles.quantitySliderHeader}>
                                  <span>数量 {selectedQuantity}</span>
                                  <button style={styles.miniButton} onClick={() => setQuantity(good.id, maxSellQuantity, maxSellQuantity)}>MAX</button>
                                </div>
                                <input type="range" min={1} max={maxSellQuantity} value={selectedQuantity} onChange={(e) => setQuantity(good.id, Number(e.target.value), maxSellQuantity)} style={styles.quantitySlider} />
                              </div>
                              <div style={styles.marketAmountStack}>
                                <strong>{selectedQuote?.totalPrice ?? 0} d</strong>
                                <span>積載 {(good.weight * selectedQuantity).toFixed(1)}</span>
                              </div>
                              <button style={{ ...styles.secondaryButton, ...styles.tradeActionButton }} onClick={() => handleAction(sellGood(port.id, good.id, selectedQuantity, marketTargetShip?.instanceId))}>売却</button>
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
                  <div style={styles.serviceColumns}>
                    <div style={styles.featureBanner}>
                      <span style={styles.featureBadge}>{uiText.town.labels.tavern}</span>
                      <div>
                        <strong>{uiText.town.labels.tavern} Lv.{tavernLevel}</strong>
                        <div style={styles.featureText}>対象船: {tavernTargetShip?.name ?? '未選択'} / 新規雇用 {tavernRecruitUnitCost} d</div>
                      </div>
                    </div>
                    <div style={styles.facilityTargetRow}>
                      <span style={styles.serviceNote}>酒場サービス対象の船</span>
                      {renderFacilityShipSelect(tavernTargetShip?.instanceId ?? fallbackShipId, setTavernTargetShipId, '対象船')}
                    </div>
                    <div style={styles.tavernCrewPanel}>
                      <div style={styles.tradeMeta}>
                        <strong>{tavernTargetShipType?.name ?? tavernTargetShip?.name ?? '未選択'}</strong>
                        <span style={styles.tradeSub}>船員雇用はこの船の空き枠に入ります。</span>
                      </div>
                      {tavernTargetShip && <ShipGaugeRow label="船員" current={tavernTargetShip.currentCrew} max={tavernTargetShip.maxCrew} />}
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
                            <div key={officer.id} style={officerOfferCardStyle}>
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
                                    <span>月給 {officer.salary} d</span>
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
                      <p style={styles.serviceLabel}>旗艦役職任命</p>
                      <div style={styles.roleSlotGrid}>
                        {OFFICER_ROLE_DEFINITIONS.map((role) => {
                          const assignedOfficer = getAssignedOfficerForRole(activeShip, officers, role.id)
                          return (
                            <div key={role.id} style={styles.roleSlotCard}>
                              <div style={styles.roleSlotHeader}>
                                <strong>{role.label}</strong>
                                <span>{role.effectSummary}</span>
                              </div>
                              <select
                                style={styles.roleSelect}
                                value={getOfficerRoleSelectValue(assignedOfficer?.id)}
                                disabled={!activeShip || officers.length === 0}
                                onChange={(event) => {
                                  const nextOfficerId = event.target.value
                                  handleAction(nextOfficerId
                                    ? assignOfficerToRole(nextOfficerId, role.id, activeShip?.instanceId)
                                    : unassignOfficerRole(role.id, activeShip?.instanceId))
                                }}
                              >
                                <option value="">未任命</option>
                                {officers.map((officer) => (
                                  <option key={`${role.id}-${officer.id}`} value={officer.id}>
                                    {formatOfficerName(officer)} / {getOfficerAssignmentLabel(officer.id, ships)}
                                  </option>
                                ))}
                              </select>
                              <span style={styles.tradeSub}>{assignedOfficer ? formatOfficerRoleEffect(role.id, assignedOfficer) : role.description}</span>
                            </div>
                          )
                        })}
                      </div>
                      {officers.length === 0 && <div style={styles.emptyState}>役職に任命できる航海士がいません。</div>}
                    </div>
                    <div>
                      <p style={styles.serviceLabel}>僚艦船長任命</p>
                      <div style={styles.list}>
                        {officers.length === 0 && <div style={styles.emptyState}>雇用済みの航海士はいません。</div>}
                        {officers.map((officer) => {
                          const assignmentLabel = getOfficerAssignmentLabel(officer.id, ships)
                          const assigned = assignmentLabel !== '未任命'
                          const officerName = formatOfficerName(officer)
                          return (
                            <div key={officer.id} style={compactActionRowStyle}>
                              <div style={styles.assignedOfficerSummary}>
                                <OfficerPortrait officer={officer} />
                                <div style={styles.tradeMeta}>
                                  <strong>{officerName} / 現在 {assignmentLabel}</strong>
                                  <span style={styles.tradeSub}>{getOfficerSpecialtyLabel(officer.specialty)} / {formatOfficerStats(officer)}</span>
                                  <span style={styles.tradeSub}>効果: 航海=速力・旋回 / 交易=売買価格・積載補助 / 砲術=戦術砲門 / 修理=修理効率 / 統率=士気低下軽減</span>
                                </div>
                              </div>
                              <div style={styles.inlineButtonGroup}>
                                {consortShips.map((ship) => (
                                  <button key={`${officer.id}-${ship.instanceId}`} style={getRoleOfficerId(ship, 'captain') === officer.id ? styles.secondaryButton : styles.primaryButton} disabled={getRoleOfficerId(ship, 'captain') === officer.id} onClick={() => handleAction(assignOfficerToShip(officer.id, ship.instanceId))}>{ship.name}</button>
                                ))}
                                <button style={styles.secondaryButton} disabled={!assigned} onClick={() => handleAction(unassignOfficer(officer.id))}>任を解く</button>
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
                        {renderFacilityShipSelect(shipyardTargetShip?.instanceId ?? fallbackShipId, setShipyardTargetShipId, '艤装対象')}
                      </div>
                      <div style={styles.infoGridCompact}>
                        <div style={styles.infoBlock}><span style={styles.infoLabel}>選択中の船</span><strong>{selectedShipyardTargetType?.name ?? shipyardTargetShip?.name ?? '未選択'}</strong><small>艤装はこの船に適用されます。</small></div>
                        <div style={styles.infoBlock}><span style={styles.infoLabel}>船体状態</span><strong>{shipyardTargetShip?.currentDurability ?? 0}/{shipyardTargetShip?.maxDurability ?? 0}</strong><small>船員 {shipyardTargetShip?.currentCrew ?? 0}/{shipyardTargetShip?.maxCrew ?? 0} / 積荷 {shipyardTargetShip?.usedCapacity ?? 0}/{shipyardTargetShip?.maxCapacity ?? 0}</small></div>
                      </div>
                      <div>
                        <p style={styles.serviceLabel}>保有船の管理</p>
                        <div style={styles.list}>
                          {ships.map((ship) => {
                            const type = getShip(ship.typeId)
                            const isFlagship = ship.instanceId === activeShipId
                            const hasCargo = ship.cargo.length > 0 || ship.usedCapacity > 0
                            const salePrice = estimateShipSalePrice(ship, type)
                            return (
                              <div key={ship.instanceId} style={compactActionRowStyle}>
                                <div style={styles.tradeMeta}>
                                  <strong>{type?.name ?? ship.name}{isFlagship ? ' / 旗艦' : ''}{ship.instanceId === shipyardTargetShip?.instanceId ? ' / 艤装対象' : ''}</strong>
                                  <span style={styles.tradeSub}>売却見積 {salePrice} d / 耐久 {ship.currentDurability}/{ship.maxDurability} / 積荷 {ship.usedCapacity.toFixed(1)}/{ship.maxCapacity.toFixed(1)}</span>
                                  {isFlagship && <span style={styles.tradeBlocked}>旗艦は売却できません。先に別の船を旗艦にしてください。</span>}
                                  {hasCargo && !isFlagship && <span style={styles.tradeBlocked}>積荷が残っている船は売却できません。</span>}
                                </div>
                                <div style={styles.inlineButtonGroup}>
                                  <button style={isFlagship ? styles.secondaryButton : styles.primaryButton} disabled={isFlagship} onClick={() => {
                                    setActiveShip(ship.instanceId)
                                    setShipyardTargetShipId(ship.instanceId)
                                    handleAction({ ok: true, message: `${type?.name ?? ship.name} を旗艦にしました。` })
                                  }}>旗艦にする</button>
                                  <button style={styles.secondaryButton} disabled={isFlagship || hasCargo || ships.length <= 1} onClick={() => handleAction(sellShip(ship.instanceId))}>売却</button>
                                </div>
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
                              <div key={ship.id} style={compactActionRowStyle}>
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
                          <div key={entry.itemId} style={compactActionRowStyle}>
                            <div style={styles.tradeGoodSummary}>
                              <TradeGoodIcon goodId={entry.itemId} label={entry.name} />
                              <div style={styles.tradeMeta}>
                                <strong>{entry.name}</strong>
                                <span style={styles.tradeSub}>{entry.description}</span>
                                <span style={styles.tradeSub}>x{entry.quantity} / 単価 {entry.unitValue} d / 合計 {entry.totalValue} d</span>
                              </div>
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
                    <DialogueLineWindow portraitUrl={hireDialogue.officer.portraitUrl ?? ''} speaker={formatOfficerName(hireDialogue.officer)} message="いいぜ" />
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
  container: { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(180deg, rgba(44, 24, 16, 0.82), rgba(20, 10, 6, 0.92)), url("${antiqueAssets.darkOakTile}")`, backgroundSize: 'auto, 560px 560px', zIndex: 700, padding: 24 },
  containerCompact: { alignItems: 'stretch', justifyContent: 'stretch', padding: 8 },
  card: { ...antiqueStyles.woodSurface, width: 'min(1240px, 100%)', maxHeight: '100%', overflow: 'auto', padding: 24 },
  cardCompact: { width: '100%', maxHeight: 'calc(100vh - 16px)', padding: 12 },
  hero: { ...antiqueStyles.woodSurface, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, marginBottom: 16, padding: 18 },
  heroCompact: { flexDirection: 'column', gap: 10, marginBottom: 12 },
  eyebrow: { margin: 0, color: antiqueColors.brassLight, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', fontFamily: antiqueFonts.title },
  title: { margin: '6px 0 0', fontSize: 36, color: antiqueColors.parchment, fontFamily: antiqueFonts.title, letterSpacing: '0.08em', textShadow: '0 1px 2px #000' },
  titleCompact: { fontSize: 28 },
  subtitle: { margin: '8px 0 0', color: antiqueColors.brassLight },
  heroActions: { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  statStrip: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 },
  statCard: { ...antiqueStyles.paperCard, position: 'relative', padding: '18px 14px 12px', display: 'flex', flexDirection: 'column', gap: 5, minHeight: 72, overflow: 'hidden' },
  statLabel: { alignSelf: 'flex-start', marginTop: -8, marginLeft: -4, padding: '2px 7px', borderRadius: 2, backgroundColor: 'rgba(139, 101, 8, 0.18)', border: '1px solid rgba(139, 101, 8, 0.3)', color: antiqueColors.ink, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 },
  questBanner: { ...antiqueStyles.paperCard, padding: '14px 18px', marginBottom: 16 },
  bannerText: { margin: 0, color: antiqueColors.inkLight },
  activeQuestTabs: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 },
  activeQuestTab: { ...antiqueStyles.paperCard, minHeight: 72, padding: '14px 16px', color: antiqueColors.inkLight, textAlign: 'left', cursor: 'pointer', display: 'grid', gap: 3 },
  activeQuestTabSelected: { ...antiqueStyles.paperCard, minHeight: 72, padding: '14px 16px', color: antiqueColors.ink, textAlign: 'left', cursor: 'pointer', display: 'grid', gap: 3, borderLeft: `5px solid ${antiqueColors.brassDark}`, boxShadow: 'inset 0 0 14px rgba(90,61,43,0.12), 0 0 0 2px rgba(139,101,8,0.36)' },
  bannerFacts: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, color: antiqueColors.inkFaded, fontSize: 12 },
  bannerActions: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  notice: { ...antiqueStyles.paperCard, position: 'sticky', top: 0, zIndex: 5, marginBottom: 16, padding: '14px 18px', color: antiqueColors.ink },
  noticeWarning: { background: 'rgba(120, 53, 15, 0.18)', border: '1px solid rgba(139, 101, 8, 0.34)', color: antiqueColors.sealRed },
  shell: { display: 'grid', gridTemplateColumns: '210px minmax(0, 1fr)', gap: 16 },
  shellCompact: { gridTemplateColumns: '1fr', gap: 12 },
  sidebar: { ...antiqueStyles.woodSurface, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, alignSelf: 'start', position: 'sticky', top: 0 },
  sidebarCompact: { position: 'static', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(106px, 1fr))', gap: 6, padding: 10 },
  navButton: { padding: '11px 12px', textAlign: 'left', borderRadius: 3, border: '1px solid rgba(184,134,11,0.18)', backgroundColor: 'rgba(74, 50, 40, 0.92)', backgroundImage: 'none', color: antiqueColors.parchment, cursor: 'pointer', fontFamily: antiqueFonts.body, fontWeight: 700, appearance: 'none' },
  navButtonActive: { ...antiqueStyles.paperCard, color: antiqueColors.ink, border: '2px solid rgba(255, 244, 204, 0.92)', boxShadow: 'inset 0 0 12px rgba(90,61,43,0.12), 0 0 0 1px rgba(139,101,8,0.6)', fontWeight: 800 },
  sidebarMeta: { marginTop: 8, paddingTop: 10, borderTop: '1px solid rgba(184,134,11,0.34)', display: 'flex', flexDirection: 'column', gap: 8, color: antiqueColors.candle, fontSize: 12, fontWeight: 800, textShadow: '0 1px 2px rgba(0,0,0,0.7)' },
  content: { minWidth: 0 },
  contentStack: { display: 'flex', flexDirection: 'column', gap: 16 },
  panel: { ...antiqueStyles.ledgerPanel, padding: '18px 24px' },
  cityPanel: { ...antiqueStyles.ledgerPanel, padding: '18px 24px' },
  cityIntro: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12 },
  cityBadge: { padding: '8px 10px', borderRadius: 3, border: '1px solid rgba(139, 101, 8, 0.34)', backgroundColor: 'rgba(241, 224, 172, 0.92)', color: antiqueColors.ink, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', boxShadow: 'inset 0 0 8px rgba(90,61,43,0.1)' },
  cityVista: { position: 'relative', minHeight: 430, overflow: 'hidden', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#d1b98b', backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' },
  cityVistaCompact: { minHeight: 300, borderRadius: 14 },
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
  cityHotspot: { position: 'absolute', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', gap: 8, minWidth: 126, padding: '8px 10px', borderRadius: 3, border: `1px solid ${antiqueColors.brassDark}`, background: 'rgba(62, 39, 35, 0.86)', color: antiqueColors.parchment, backdropFilter: 'blur(8px)' },
  cityHotspotCompact: { minWidth: 0, padding: '6px 8px', gap: 5, fontSize: 11 },
  cityHotspotIcon: { width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff8dc', textShadow: '0 1px 2px rgba(0,0,0,0.65)', fontWeight: 900, flex: '0 0 auto' },
  cityHotspotText: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, lineHeight: 1.1 },
  overviewCopy: { maxWidth: 620 },
  overviewEyebrow: { margin: 0, color: antiqueColors.inkLight, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', fontFamily: antiqueFonts.title, fontWeight: 800 },
  overviewTitle: { margin: '5px 0 0', fontSize: 24, color: antiqueColors.ink, fontFamily: antiqueFonts.body },
  overviewText: { margin: '8px 0 0', color: antiqueColors.inkLight, lineHeight: 1.7 },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 },
  sectionTitle: { margin: 0, fontSize: 15 },
  panelHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 10 },
  panelHint: { color: antiqueColors.inkLight, fontSize: 12, fontWeight: 700 },
  infoGridCompact: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 },
  infoBlock: { ...antiqueStyles.paperCard, display: 'flex', flexDirection: 'column', gap: 4, padding: '16px 18px' },
  infoLabel: { color: antiqueColors.inkLight, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 },
  progressGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 },
  progressCard: { ...antiqueStyles.paperCard, display: 'grid', gap: 7, padding: '16px 18px' },
  progressHeader: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', color: antiqueColors.ink, fontSize: 12 },
  progressTrack: { height: 8, borderRadius: 2, background: 'rgba(90, 61, 43, 0.2)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${antiqueColors.brassDark}, ${antiqueColors.brassBright})` },
  effectGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 12, color: antiqueColors.inkLight, fontSize: 12 },
  selectedShipPanel: { ...antiqueStyles.paperCard, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, alignItems: 'stretch', padding: '16px 18px' },
  shipModelViewport: { minHeight: 210, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(148, 163, 184, 0.18)', background: '#071323' },
  shipModelViewportCompact: { minHeight: 116, height: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(90, 61, 43, 0.28)', background: '#071323' },
  selectedShipInfo: { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, minWidth: 0 },
  selectedShipTitleRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  shipGaugeRow: { display: 'grid', gridTemplateColumns: '48px minmax(80px, 1fr) 58px', alignItems: 'center', gap: 8, minHeight: 22, color: antiqueColors.ink, fontSize: 12 },
  shipGaugeLabel: { color: antiqueColors.inkLight, fontSize: 11, fontWeight: 700 },
  shipGaugeTrack: { height: 8, borderRadius: 2, background: 'rgba(90, 61, 43, 0.2)', overflow: 'hidden' },
  shipGaugeFill: { height: '100%', borderRadius: 2 },
  shipGaugeValue: { textAlign: 'right', color: antiqueColors.ink, fontSize: 12, fontVariantNumeric: 'tabular-nums' },
  compactGaugeStack: { display: 'grid', gap: 4, marginTop: 2, marginBottom: 2 },
  tavernCrewPanel: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'center', padding: 12, borderRadius: 3, background: 'rgba(92, 60, 34, 0.08)', border: '1px solid rgba(139, 101, 8, 0.16)' },
  facilities: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  facilityChip: { display: 'inline-flex', alignItems: 'center', minHeight: 28, padding: '6px 9px', borderRadius: 3, border: '1px solid rgba(244,232,193,0.52)', backgroundColor: '#ead49b', backgroundImage: 'linear-gradient(180deg, rgba(250,238,198,0.95), rgba(222,194,132,0.94))', color: antiqueColors.ink, fontSize: 11, fontWeight: 900, textShadow: 'none', boxShadow: 'inset 0 0 8px rgba(90,61,43,0.12), 0 1px 0 rgba(0,0,0,0.18)' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  denseList: { display: 'flex', flexDirection: 'column', gap: 2 },
  denseRow: { display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(139,101,8,0.14)' },
  inlineMeta: { display: 'block', color: antiqueColors.inkFaded, fontSize: 11, marginTop: 2 },
  compactActionRow: { ...antiqueStyles.paperCard, display: 'grid', gridTemplateColumns: '1fr', gap: 12, alignItems: 'center', padding: '16px 18px' },
  compactActionRowCompact: { gridTemplateColumns: '1fr', gap: 8, padding: 10 },
  shipServiceCard: { ...antiqueStyles.paperCard, display: 'grid', gridTemplateColumns: '170px minmax(0, 1fr) auto', gap: 14, alignItems: 'stretch', padding: '14px 16px' },
  shipServiceCardCompact: { gridTemplateColumns: '1fr', gap: 10 },
  shipServiceCardActive: { borderLeft: `5px solid ${antiqueColors.brassDark}`, boxShadow: 'inset 0 0 14px rgba(90,61,43,0.12), 0 0 0 2px rgba(139,101,8,0.28)' },
  shipServiceBody: { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, minWidth: 0 },
  shipServiceHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' },
  shipServiceActions: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 132 },
  targetPill: { display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: '3px 8px', borderRadius: 3, backgroundColor: '#ead499', color: antiqueColors.ink, border: '1px solid rgba(139, 101, 8, 0.38)', fontSize: 11, fontWeight: 900 },
  officerOfferCard: { ...antiqueStyles.paperCard, display: 'grid', gridTemplateColumns: '112px minmax(0, 1fr)', gap: 14, alignItems: 'stretch', padding: '16px 18px' },
  officerOfferCardCompact: { gridTemplateColumns: '1fr', gap: 10 },
  officerPortraitColumn: { display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' },
  officerPortraitFrame: { width: 96, aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(244, 201, 130, 0.32)', background: 'linear-gradient(180deg, rgba(69, 52, 35, 0.65), rgba(20, 28, 42, 0.9))', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' },
  officerPortraitImage: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  officerPortraitCaption: { color: antiqueColors.inkFaded, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' },
  officerOfferBody: { display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 },
  officerOfferHeader: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' },
  officerOfferMain: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, alignItems: 'center' },
  officerRadar: { display: 'block', maxWidth: '100%' },
  officerStatList: { display: 'grid', gridTemplateColumns: '1fr', gap: 5 },
  officerStatRow: { display: 'grid', gridTemplateColumns: '42px 1fr', alignItems: 'center', gap: 8, color: antiqueColors.inkLight, fontSize: 12 },
  officerCostBox: { ...antiqueStyles.paperCard, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, padding: 10, borderLeft: `4px solid ${antiqueColors.brassDark}` },
  assignedOfficerSummary: { display: 'grid', gridTemplateColumns: '104px minmax(320px, 1fr)', gap: 14, alignItems: 'center', minWidth: 0 },
  roleSlotGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 },
  roleSlotCard: { ...antiqueStyles.paperCard, display: 'grid', gap: 8, padding: '16px 18px' },
  roleSlotHeader: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', color: antiqueColors.ink, fontSize: 12 },
  roleSelect: { width: '100%', padding: '9px 10px', borderRadius: 3, border: '1px solid rgba(139, 101, 8, 0.34)', background: antiqueColors.parchment, color: antiqueColors.ink },
  dialogueOverlay: { position: 'fixed', inset: 0, zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px min(5vw, 56px)', background: 'rgba(2, 6, 23, 0.58)', backdropFilter: 'blur(2px)', cursor: 'pointer' },
  dialogueStage: { width: 'min(940px, 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '18px 18px 14px', borderRadius: 20, background: 'linear-gradient(180deg, rgba(4, 12, 24, 0.42), rgba(7, 16, 31, 0.28))', border: '1px solid rgba(191, 219, 254, 0.16)', boxShadow: '0 28px 90px rgba(0,0,0,0.48)' },
  dialogueStack: { width: 'min(920px, 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  dialogueLine: { width: 'min(720px, 100%)', display: 'grid', gridTemplateColumns: '104px minmax(0, 1fr)', gap: 12, alignItems: 'center' },
  dialoguePortraitFrame: { width: 104, aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(244, 201, 130, 0.42)', background: 'rgba(15, 23, 42, 0.78)', boxShadow: '0 12px 28px rgba(0,0,0,0.34)' },
  dialogueTextBox: { minHeight: 104, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, padding: '16px 18px', borderRadius: 12, background: 'linear-gradient(180deg, rgba(10, 22, 38, 0.96), rgba(13, 28, 48, 0.98))', border: '1px solid rgba(191, 219, 254, 0.28)', color: '#eef6ff', boxShadow: '0 16px 44px rgba(0,0,0,0.38)', fontSize: 18, lineHeight: 1.5 },
  systemMessageWindow: { width: 'min(640px, 100%)', display: 'flex', flexDirection: 'column', gap: 8, padding: '20px 22px', borderRadius: 14, background: 'linear-gradient(180deg, rgba(13, 30, 52, 0.98), rgba(7, 17, 31, 0.98))', border: '1px solid rgba(250, 204, 21, 0.34)', color: '#f8fbff', boxShadow: '0 20px 60px rgba(0,0,0,0.42)', fontSize: 18, lineHeight: 1.5 },
  dialogueAdvanceHint: { color: '#b7c9e3', fontSize: 12, letterSpacing: '0.08em' },
  tradeGoodSummary: { display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 },
  tradeMeta: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 },
  tradeGoodName: { color: antiqueColors.ink, lineHeight: 1.25, wordBreak: 'keep-all', overflowWrap: 'normal' },
  tradeSub: { color: '#4d3426', fontSize: 12 },
  marketQuoteLine: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, color: '#4d3426', fontSize: 12 },
  marketTrendBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 22, padding: '2px 7px', borderRadius: 3, border: '1px solid', fontWeight: 700, lineHeight: 1.2 },
  marketTrendIcon: { display: 'inline-grid', placeItems: 'center', width: 14, height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.12)', fontSize: 11, lineHeight: 1 },
  questTitleRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  questCategoryBadge: { padding: '3px 8px', borderRadius: 3, background: 'rgba(139, 101, 8, 0.18)', border: '1px solid rgba(139, 101, 8, 0.35)', color: antiqueColors.ink, fontSize: 11, fontWeight: 800, lineHeight: 1.3 },
  discoveryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 },
  discoveryCard: { ...antiqueStyles.paperCard, display: 'grid', gridTemplateColumns: '54px minmax(0, 1fr)', gap: 10, alignItems: 'start', padding: '16px 18px' },
  discoveryMeta: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  discoveryCategoryBadge: { padding: '3px 8px', borderRadius: 3, background: 'rgba(35, 92, 87, 0.14)', border: '1px solid rgba(35, 92, 87, 0.28)', color: '#235c57', fontSize: 11, lineHeight: 1.3 },
  marketRowDense: { ...antiqueStyles.paperCard, display: 'grid', gridTemplateColumns: '1fr', gap: 12, alignItems: 'stretch', padding: '14px 16px' },
  tradeControlsDense: { display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) minmax(78px, auto) minmax(64px, auto)', alignItems: 'center', gap: 10, minWidth: 0 },
  quantitySliderGroup: { display: 'grid', gap: 5, minWidth: 0 },
  quantitySliderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, color: antiqueColors.ink, fontSize: 12 },
  quantitySlider: { width: '100%', accentColor: antiqueColors.brass },
  miniButton: { minWidth: 48, padding: '5px 8px', borderRadius: 3, border: '1px solid rgba(139, 101, 8, 0.48)', backgroundColor: '#ead499', backgroundImage: 'linear-gradient(180deg, rgba(250,238,198,0.72), rgba(211,166,66,0.42))', color: antiqueColors.ink, cursor: 'pointer', fontWeight: 900, fontSize: 11, appearance: 'none' },
  compactFigure: { minWidth: 0, textAlign: 'right', color: antiqueColors.ink, fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  marketAmountStack: { display: 'grid', gap: 2, minWidth: 72, textAlign: 'right', color: antiqueColors.ink, fontSize: 12, fontVariantNumeric: 'tabular-nums' },
  tradeActionButton: { minWidth: 64, padding: '10px 12px', whiteSpace: 'nowrap', justifySelf: 'end' },
  emptyState: { display: 'inline-block', color: antiqueColors.inkLight, backgroundColor: 'rgba(241, 224, 172, 0.86)', border: '1px solid rgba(90,61,43,0.24)', borderRadius: 3, fontSize: 13, padding: '10px 12px', fontWeight: 700, textShadow: 'none' },
  serviceGrid: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  inlineButtonGroup: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  serviceColumns: { display: 'grid', gridTemplateColumns: '1fr', gap: 16 },
  facilityTargetRow: { ...antiqueStyles.paperCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: 14 },
  commandTargetLabel: { display: 'flex', alignItems: 'center', gap: 8, color: antiqueColors.inkLight, fontSize: 12 },
  commandTargetSelect: { minWidth: 220, padding: '9px 10px', borderRadius: 3, border: '1px solid rgba(139, 101, 8, 0.45)', background: antiqueColors.parchment, color: antiqueColors.ink },
  fleetDockGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 },
  fleetDockCard: { ...antiqueStyles.paperCard, padding: 10, cursor: 'pointer', textAlign: 'left' },
  fleetDockCardActive: { borderLeft: `5px solid ${antiqueColors.brassDark}`, boxShadow: 'inset 0 0 14px rgba(90,61,43,0.12), 0 0 0 2px rgba(139,101,8,0.32)' },
  fleetDockEmpty: { padding: 10, borderRadius: 3, border: '1px dashed rgba(139, 101, 8, 0.28)', color: antiqueColors.inkFaded },
  fleetDockHeader: { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8, fontSize: 12 },
  fleetDockStat: { display: 'grid', gridTemplateColumns: '78px 1fr', alignItems: 'center', gap: 8, color: antiqueColors.inkLight, fontSize: 11, marginTop: 5 },
  fleetDockMeter: { height: 6, borderRadius: 2, background: 'rgba(90, 61, 43, 0.2)', overflow: 'hidden' },
  fleetDockMeterFill: { height: '100%', borderRadius: 2, background: antiqueColors.brassDark },
  departRow: { display: 'flex', justifyContent: 'flex-end', paddingTop: 4 },
  featurePanel: { border: '1px solid rgba(139, 101, 8, 0.18)' },
  featureBanner: { ...antiqueStyles.paperCard, display: 'flex', alignItems: 'center', gap: 12, padding: 14 },
  featureBadge: { padding: '6px 10px', borderRadius: 3, backgroundColor: '#5f4306', backgroundImage: 'linear-gradient(180deg, rgba(139,101,8,0.9), rgba(72,48,4,0.96))', color: '#fff8dc', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', textShadow: '0 1px 1px rgba(0,0,0,0.55)' },
  featureBadgeMuted: { padding: '6px 10px', borderRadius: 3, background: 'rgba(90, 61, 43, 0.24)', color: antiqueColors.inkLight, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' },
  featureText: { color: antiqueColors.inkFaded, fontSize: 12, marginTop: 3 },
  serviceLabel: { display: 'inline-flex', margin: '0 0 8px', padding: '3px 7px', borderRadius: 3, border: '1px solid rgba(90,61,43,0.24)', backgroundColor: 'rgba(241, 224, 172, 0.86)', color: antiqueColors.ink, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, textShadow: 'none' },
  serviceNote: { color: antiqueColors.inkLight, fontSize: 12, fontWeight: 700, textShadow: 'none' },
  leaveButton: { ...antiqueStyles.woodButton, padding: '11px 15px' },
  primaryButton: { ...antiqueStyles.brassFlatButton, padding: '11px 16px' },
  secondaryButton: { ...antiqueStyles.woodButton, padding: '11px 16px' },
  disabledButton: { background: 'rgba(90, 61, 43, 0.18)', border: '1px solid rgba(139, 101, 8, 0.18)', color: antiqueColors.inkFaded, cursor: 'not-allowed', boxShadow: 'none', opacity: 0.72 },
  outfitPanel: { ...antiqueStyles.ledgerPanel, marginTop: 12, padding: '18px 24px' },
  outfitHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, color: antiqueColors.ink, fontSize: 13 },
  outfitSummary: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10, color: antiqueColors.inkLight, fontSize: 12 },
  outfitGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 },
  outfitCard: { ...antiqueStyles.paperCard, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 },
  outfitNote: { fontSize: 11, color: antiqueColors.inkFaded },
  outfitMeta: { fontSize: 12, color: antiqueColors.ink },
}












