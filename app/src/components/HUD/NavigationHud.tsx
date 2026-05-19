import { useMemo, useState } from 'react'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useEncounterStore } from '@/stores/useEncounterStore.ts'
import { MAX_ACTIVE_QUESTS, useQuestStore } from '@/stores/useQuestStore.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { getNearestPort } from '@/game/world/queries.ts'
import { isQuestDeadlineNotice } from '@/game/quest/questNotices.ts'
import { TradeGoodIcon } from '@/components/TradeGoodIcon.tsx'
import { uiText } from '@/i18n/uiText.ts'
import type { Quest } from '@/types/quest.ts'
import type { Port } from '@/types/port.ts'

function ratio(current: number, max: number): number {
  return Math.max(0, Math.min(1, current / Math.max(1, max)))
}

function barColor(value: number): string {
  if (value < 0.25) return '#ef4444'
  if (value < 0.5) return '#f59e0b'
  return '#60a5fa'
}

export function NavigationHud() {
  const [showQuestLog, setShowQuestLog] = useState(false)
  const navigation = useNavigationStore()
  const ports = useWorldStore((s) => s.ports)
  const getTradeGood = useDataStore((s) => s.getTradeGood)
  const player = usePlayerStore((s) => s.player)
  const ships = usePlayerStore((s) => s.ships)
  const activeShipId = usePlayerStore((s) => s.activeShipId)
  const voyageNotice = usePlayerStore((s) => s.lastVoyageNotice)
  const clearVoyageNotice = usePlayerStore((s) => s.clearVoyageNotice)
  const encounter = useEncounterStore((s) => s.activeEncounter)
  const encounterNotice = useEncounterStore((s) => s.lastEncounterNotice)
  const clearEncounterNotice = useEncounterStore((s) => s.clearEncounterNotice)
  const activeQuests = useQuestStore((s) => s.activeQuests)
  const activeQuest = useQuestStore((s) => s.activeQuest)
  const questNotice = useQuestStore((s) => s.lastQuestNotice)
  const clearQuestNotice = useQuestStore((s) => s.clearQuestNotice)
  const setPhase = useGameStore((s) => s.setPhase)
  const currentDay = Math.floor(useGameStore((s) => s.timeState.totalDays))
  const acceptedQuests = activeQuests.length > 0 ? activeQuests : activeQuest ? [activeQuest] : []

  const nearest = useMemo(() => getNearestPort(navigation.position, ports), [navigation.position, ports])
  const dockedPort = ports.find((port) => port.id === navigation.dockedPortId)
  const fleetShips = useMemo(() => {
    const active = ships.find((ship) => ship.instanceId === activeShipId)
    const followers = ships.filter((ship) => ship.instanceId !== activeShipId)
    return active ? [active, ...followers].slice(0, 5) : followers.slice(0, 5)
  }, [activeShipId, ships])

  return (
    <div style={styles.panel}>
      <div style={styles.summaryRow}>
        <div>
          <div style={styles.label}>{uiText.nav.speed}</div>
          <strong style={styles.value}>{navigation.currentSpeed.toFixed(1)} kt</strong>
        </div>
        <div>
          <div style={styles.label}>方位</div>
          <strong style={styles.value}>{navigation.heading.toFixed(0)}°</strong>
        </div>
        <div>
          <div style={styles.label}>{uiText.nav.nearestPort}</div>
          <strong style={styles.value}>{nearest ? `${nearest.port.name} ${nearest.distanceKm.toFixed(1)} km` : uiText.nav.none}</strong>
        </div>
      </div>

      <div style={styles.fleetList}>
        {fleetShips.map((ship, index) => {
          const durabilityRatio = ratio(ship.currentDurability, ship.maxDurability)
          const crewRatio = ratio(ship.currentCrew, ship.maxCrew)
          const isActive = ship.instanceId === activeShipId
          return (
            <div key={ship.instanceId} style={styles.shipCard}>
              <div style={styles.shipHeader}>
                <span style={{ ...styles.shipIndex, ...(isActive ? styles.flagship : {}) }}>{index + 1}</span>
                <span style={styles.shipName}>{isActive ? '旗艦' : '僚船'}</span>
              </div>
              <div style={styles.statRow}>
                <span style={styles.statLabel}>{uiText.nav.durability}</span>
                <span style={styles.statValue}>{ship.currentDurability}/{ship.maxDurability}</span>
                <div style={styles.meter}><div style={{ ...styles.meterFill, width: `${durabilityRatio * 100}%`, background: barColor(durabilityRatio) }} /></div>
              </div>
              <div style={styles.statRow}>
                <span style={styles.statLabel}>{uiText.nav.crew}</span>
                <span style={styles.statValue}>{ship.currentCrew}/{ship.maxCrew}</span>
                <div style={styles.meter}><div style={{ ...styles.meterFill, width: `${crewRatio * 100}%`, background: barColor(crewRatio) }} /></div>
              </div>
            </div>
          )
        })}
        {Array.from({ length: Math.max(0, 5 - fleetShips.length) }).map((_, index) => (
          <div key={`empty-${index}`} style={styles.emptyShip}>第{fleetShips.length + index + 1}船 空き</div>
        ))}
      </div>

      {encounter && <div style={styles.alert}>{uiText.nav.encounter}: {encounter.title}</div>}
      {voyageNotice && (
        <div style={styles.noticeWrap}>
          <div style={styles.noticeTitle}>{uiText.nav.voyageEvent}</div>
          <div style={styles.noticeText}>{voyageNotice}</div>
          <button style={styles.noticeButton} onClick={clearVoyageNotice}>{uiText.nav.dismiss}</button>
        </div>
      )}
      {encounterNotice && !encounter && (
        <div style={styles.noticeWrap}>
          <div style={styles.noticeTitle}>{uiText.nav.encounterResult}</div>
          <div style={styles.noticeText}>{encounterNotice}</div>
          <button style={styles.noticeButton} onClick={clearEncounterNotice}>{uiText.nav.dismiss}</button>
        </div>
      )}
      {isQuestDeadlineNotice(questNotice) && (
        <div style={{ ...styles.noticeWrap, ...styles.questDeadlineNotice }}>
          <div style={styles.noticeTitle}>クエスト期限切れ</div>
          <div style={styles.noticeText}>{questNotice}</div>
          <button style={styles.noticeButton} onClick={clearQuestNotice}>{uiText.nav.dismiss}</button>
        </div>
      )}
      <button style={styles.questButton} onClick={() => setShowQuestLog(true)}>クエスト {acceptedQuests.length}/{MAX_ACTIVE_QUESTS}</button>
      {dockedPort && <button style={styles.portButton} onClick={() => setPhase('port')}>{uiText.nav.enterPort} {dockedPort.name}</button>}
      <div style={styles.hint}>
        {player ? `${player.name} / ` : ''}
        {navigation.mode === 'docked' ? uiText.nav.clickMarker : uiText.nav.clickSea}
      </div>
      {showQuestLog && (
        <QuestLogWindow
          quests={acceptedQuests}
          ports={ports}
          currentDay={currentDay}
          getGoodName={(goodId) => getTradeGood(goodId)?.name ?? goodId}
          onClose={() => setShowQuestLog(false)}
        />
      )}
    </div>
  )
}

function getPortName(ports: Port[], portId?: string): string {
  if (!portId) return '-'
  return ports.find((port) => port.id === portId)?.name ?? portId
}

function getQuestCategoryLabel(quest: Quest): string {
  if (quest.metadata?.category === 'combat_bounty') return '討伐'
  if (quest.metadata?.category === 'trade_procurement') return '仕入'
  if (quest.metadata?.category === 'trade_sales') return '売却'
  return '納品'
}

function getQuestReportPortId(quest: Quest): string | undefined {
  return quest.metadata?.reportPortId ?? quest.metadata?.destinationPortId ?? quest.giverPort
}

function getQuestRouteText(quest: Quest, ports: Port[]): string {
  if (quest.metadata?.category === 'combat_bounty') {
    return `${getPortName(ports, quest.metadata.combatTargetAppearancePortId)}港付近 / ${getPortName(ports, quest.metadata.combatTargetPatrolPortId)}方面`
  }
  const sourceName = getPortName(ports, quest.metadata?.sourcePortId)
  const destinationName = getPortName(ports, quest.metadata?.destinationPortId ?? getQuestReportPortId(quest))
  if (quest.metadata?.category === 'trade_procurement') return `仕入先 ${sourceName} / 納品先 ${destinationName}`
  return `仕入 ${sourceName} / 納品先 ${destinationName}`
}

function getQuestInstructionText(quest: Quest, ports: Port[], getGoodName: (goodId: string) => string): string {
  if (quest.metadata?.category === 'combat_bounty') {
    return `${quest.metadata.combatTargetName ?? '討伐対象'} の艦隊を撃破`
  }
  const quantity = quest.metadata?.quantity ?? 0
  const itemName = quest.metadata?.goodId ? getGoodName(quest.metadata.goodId) : '指定品'
  const sourceName = getPortName(ports, quest.metadata?.sourcePortId)
  const destinationName = getPortName(ports, quest.metadata?.destinationPortId ?? getQuestReportPortId(quest))
  if (quest.metadata?.category === 'trade_procurement') return `${sourceName} で ${itemName} x${quantity} を買い、${destinationName} へ持ち帰る`
  return `${sourceName} で ${itemName} x${quantity} を買い、${destinationName} へ届ける`
}

function QuestLogWindow(props: {
  quests: Quest[]
  ports: Port[]
  currentDay: number
  getGoodName: (goodId: string) => string
  onClose: () => void
}) {
  return (
    <div style={styles.questLogOverlay}>
      <div style={styles.questLogWindow}>
        <div style={styles.questLogHeader}>
          <div>
            <span style={styles.questLogEyebrow}>Accepted quests</span>
            <strong>請負中クエスト</strong>
          </div>
          <button style={styles.questLogCloseButton} onClick={props.onClose}>閉じる</button>
        </div>
        {props.quests.length === 0 && <div style={styles.questLogEmpty}>請け負っているクエストはありません。</div>}
        <div style={styles.questLogList}>
          {props.quests.map((quest) => {
            const daysRemaining = quest.deadlineDay == null ? null : quest.deadlineDay - props.currentDay
            return (
              <div key={quest.id} style={styles.questLogCard}>
                <div style={styles.questLogTitleRow}>
                  {quest.metadata?.goodId && <TradeGoodIcon goodId={quest.metadata.goodId} label={props.getGoodName(quest.metadata.goodId)} size={30} />}
                  <span style={styles.questLogBadge}>{getQuestCategoryLabel(quest)}</span>
                  <strong>{quest.title}</strong>
                  <span style={styles.questLogDays}>残り {daysRemaining ?? '-'} 日</span>
                </div>
                <div style={styles.questLogRoute}>{getQuestRouteText(quest, props.ports)}</div>
                <div style={styles.questLogInstruction}>{getQuestInstructionText(quest, props.ports, props.getGoodName)}</div>
                <div style={styles.questLogObjectives}>
                  {quest.objectives.map((objective) => (
                    <span key={`${quest.id}-${objective.type}`}>{objective.current}/{objective.count} {objective.description}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed',
    top: 'calc(72px * var(--navigatoria-ui-scale, 1))',
    left: 'calc(12px * var(--navigatoria-ui-scale, 1))',
    width: 330,
    maxHeight: 'calc((100vh - 92px) / var(--navigatoria-ui-scale, 1))',
    overflow: 'auto',
    padding: '12px',
    borderRadius: 14,
    background: 'rgba(12, 19, 34, 0.86)',
    border: '1px solid rgba(120, 172, 219, 0.24)',
    color: '#e8edf7',
    backdropFilter: 'blur(12px)',
    fontSize: 11,
    zIndex: 120,
    pointerEvents: 'auto',
    fontFamily: 'system-ui, sans-serif',
    transform: 'scale(var(--navigatoria-ui-scale, 1))',
    transformOrigin: 'top left',
  },
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: '58px 58px 1fr',
    gap: 8,
    marginBottom: 10,
  },
  label: {
    color: '#8fb1d8',
    fontSize: 9,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  value: {
    color: '#e8edf7',
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  fleetList: {
    display: 'grid',
    gap: 6,
  },
  shipCard: {
    display: 'grid',
    gridTemplateColumns: '54px 1fr',
    gap: 8,
    padding: '7px 8px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  shipHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  shipIndex: {
    display: 'inline-flex',
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    background: 'rgba(148, 163, 184, 0.18)',
    color: '#cbd5e1',
    fontWeight: 800,
  },
  flagship: {
    background: 'rgba(96, 165, 250, 0.3)',
    color: '#dbeafe',
  },
  shipName: {
    color: '#cbd5e1',
    fontWeight: 700,
  },
  statRow: {
    display: 'grid',
    gridTemplateColumns: '38px 58px 1fr',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  statLabel: {
    color: '#8fb1d8',
    fontSize: 10,
  },
  statValue: {
    color: '#dbeafe',
    fontSize: 10,
    textAlign: 'right',
  },
  meter: {
    height: 6,
    borderRadius: 999,
    background: 'rgba(148, 163, 184, 0.18)',
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 999,
  },
  emptyShip: {
    padding: '6px 8px',
    borderRadius: 10,
    color: '#64748b',
    border: '1px dashed rgba(148, 163, 184, 0.16)',
  },
  alert: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    background: 'rgba(239,68,68,0.15)',
    color: '#fca5a5',
    fontWeight: 600,
  },
  noticeWrap: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    background: 'rgba(37, 99, 235, 0.12)',
    border: '1px solid rgba(142, 197, 255, 0.16)',
  },
  questDeadlineNotice: {
    background: 'rgba(120, 53, 15, 0.24)',
    border: '1px solid rgba(251, 191, 36, 0.36)',
  },
  noticeTitle: {
    color: '#8fb1d8',
    fontSize: 9,
    marginBottom: 4,
  },
  noticeText: { color: '#dbeafe', lineHeight: 1.4, fontSize: 11 },
  noticeButton: {
    marginTop: 6,
    padding: '4px 8px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 11,
  },
  questButton: {
    width: '100%',
    marginTop: 8,
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid rgba(250, 204, 21, 0.3)',
    background: 'rgba(120, 53, 15, 0.28)',
    color: '#fde68a',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
  },
  portButton: {
    width: '100%',
    marginTop: 8,
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid rgba(142, 197, 255, 0.35)',
    background: 'linear-gradient(135deg, rgba(24,94,173,0.9), rgba(35,151,210,0.8))',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
  },
  hint: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    color: '#b8c9de',
    fontSize: 10,
  },
  questLogOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 180,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(2, 6, 23, 0.38)',
  },
  questLogWindow: {
    width: 'min(720px, calc(100vw - 40px))',
    maxHeight: 'min(680px, calc(100vh - 56px))',
    overflow: 'auto',
    padding: 16,
    borderRadius: 16,
    background: 'rgba(9, 18, 34, 0.96)',
    border: '1px solid rgba(191, 219, 254, 0.24)',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.42)',
  },
  questLogHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  questLogEyebrow: {
    display: 'block',
    marginBottom: 3,
    color: '#93c5fd',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  questLogCloseButton: {
    padding: '7px 10px',
    borderRadius: 10,
    border: '1px solid rgba(148, 163, 184, 0.28)',
    background: 'rgba(15, 23, 42, 0.72)',
    color: '#dbeafe',
    cursor: 'pointer',
  },
  questLogEmpty: {
    padding: 14,
    borderRadius: 12,
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#93a4bb',
  },
  questLogList: {
    display: 'grid',
    gap: 10,
  },
  questLogCard: {
    padding: 12,
    borderRadius: 12,
    background: 'rgba(15, 23, 42, 0.72)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
  },
  questLogTitleRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  questLogBadge: {
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(245, 158, 11, 0.18)',
    border: '1px solid rgba(245, 158, 11, 0.32)',
    color: '#fde68a',
    fontSize: 10,
  },
  questLogDays: {
    marginLeft: 'auto',
    color: '#bfdbfe',
    fontWeight: 700,
  },
  questLogRoute: {
    color: '#b8c7dd',
    lineHeight: 1.45,
  },
  questLogInstruction: {
    marginTop: 4,
    color: '#e5eefb',
    lineHeight: 1.45,
  },
  questLogObjectives: {
    display: 'grid',
    gap: 4,
    marginTop: 8,
    color: '#93a4bb',
    fontSize: 10,
  },
}
