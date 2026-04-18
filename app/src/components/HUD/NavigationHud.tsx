import { useMemo, useState } from 'react'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useEncounterStore } from '@/stores/useEncounterStore.ts'
import { getNearestPort } from '@/game/world/queries.ts'
import { uiText } from '@/i18n/uiText.ts'

function formatCrewLabel(current: number, max: number, ratio: number | null): string {
  if (ratio == null) return '-'
  if (ratio < 0.5) return `${current}/${max} ⚠️`
  return `${current}/${max}`
}

function formatMoraleLabel(morale: number | null): { text: string; level: 'high' | 'steady' | 'low' } {
  if (morale == null) return { text: '-', level: 'steady' }
  if (morale >= 80) return { text: `${morale.toFixed(0)} ${uiText.nav.moraleLabels.high}`, level: 'high' }
  if (morale >= 45) return { text: `${morale.toFixed(0)} ${uiText.nav.moraleLabels.steady}`, level: 'steady' }
  return { text: `${morale.toFixed(0)} ${uiText.nav.moraleLabels.low}`, level: 'low' }
}

export function NavigationHud() {
  const navigation = useNavigationStore()
  const ports = useWorldStore((s) => s.ports)
  const player = usePlayerStore((s) => s.player)
  const ships = usePlayerStore((s) => s.ships)
  const activeShipId = usePlayerStore((s) => s.activeShipId)
  const voyageNotice = usePlayerStore((s) => s.lastVoyageNotice)
  const clearVoyageNotice = usePlayerStore((s) => s.clearVoyageNotice)
  const encounter = useEncounterStore((s) => s.activeEncounter)
  const encounterNotice = useEncounterStore((s) => s.lastEncounterNotice)
  const clearEncounterNotice = useEncounterStore((s) => s.clearEncounterNotice)
  const setPhase = useGameStore((s) => s.setPhase)
  const getShip = useDataStore((s) => s.getShip)

  const nearest = useMemo(() => getNearestPort(navigation.position, ports), [navigation.position, ports])
  const activeShip = ships.find((ship) => ship.instanceId === activeShipId)
  const shipType = activeShip ? getShip(activeShip.typeId) : null
  const dockedPort = ports.find((port) => port.id === navigation.dockedPortId)

  const crewRatio = activeShip && shipType ? activeShip.currentCrew / Math.max(1, shipType.crew.min) : null
  const requiredCrew = shipType?.crew.min ?? null
  const missingCrew = requiredCrew != null && activeShip ? Math.max(0, requiredCrew - activeShip.currentCrew) : null

  const riggingLevel = activeShip?.upgrades?.rigging ?? 0
  const cargoUpgradeLevel = activeShip?.upgrades?.cargo ?? 0
  const gunneryLevel = activeShip?.upgrades?.gunnery ?? 0
  const loadRatio = activeShip ? activeShip.usedCapacity / Math.max(1, activeShip.maxCapacity) : 0
  const speedBonus = riggingLevel * 4
  const turnBonus = riggingLevel * 6
  const cannonBonus = gunneryLevel * 8

  const [showExtended, setShowExtended] = useState(false)

  const moraleInfo = formatMoraleLabel(activeShip?.morale ?? null)
  const moraleStyle =
    moraleInfo.level === 'low' ? styles.moraleLow : moraleInfo.level === 'high' ? styles.moraleHigh : {}

  const isCritical =
    (activeShip?.currentDurability ?? Infinity) < (activeShip?.maxDurability ?? Infinity) * 0.3 ||
    (missingCrew ?? 0) > 0 ||
    loadRatio > 0.9

  return (
    <div style={styles.panel}>
      <div style={styles.coreRow}>
        <div style={styles.coreItem}>
          <span style={styles.coreLabel}>{uiText.nav.speed}</span>
          <strong style={[styles.coreValue, navigation.currentSpeed > 12 && styles.coreValueFast]}>
            {navigation.currentSpeed.toFixed(1)} kt
          </strong>
        </div>
        <div style={styles.coreItem}>
          <span style={styles.coreLabel}>{uiText.nav.heading}</span>
          <strong style={styles.coreValue}>{navigation.heading.toFixed(0)}°</strong>
        </div>
        <div style={styles.coreItem}>
          <span style={styles.coreLabel}>{uiText.nav.wind}</span>
          <strong style={styles.coreValue}>
            {navigation.wind.direction.toFixed(0)}° / {navigation.wind.speed.toFixed(1)} kt
          </strong>
        </div>
        <div style={styles.coreItem}>
          <span style={[styles.coreLabel, durabilityColor]}>{uiText.nav.durability}</span>
          <strong style={[styles.coreValue, durabilityColor]}>
            {activeShip?.currentDurability ?? '-'} / {activeShip?.maxDurability ?? '-'}
          </strong>
        </div>
      </div>

      {showExtended && (
        <div style={styles.extendedGrid}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>{uiText.nav.crew} <span style={styles.crewMissing}>{missingCrew ? `⚠️ ${missingCrew}` : ''}</span></div>
            <div style={styles.cardRow}>{formatCrewLabel(activeShip?.currentCrew ?? 0, activeShip?.maxCrew ?? 1, crewRatio)}</div>
            <div style={styles.cardRowSmall}>{uiText.nav.required} {requiredCrew ?? '-'}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardHeader}>{uiText.nav.food} <span style={styles.supplyColor}>{activeShip ? `${activeShip.supplies.food.toFixed(1)} / ${activeShip.supplies.maxFood}` : '-'}</span></div>
            <div style={styles.cardRow}>{Math.round(loadRatio * 100)}% {uiText.nav.loaded}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardHeader}>{uiText.nav.water} <span style={styles.supplyColor}>{activeShip ? `${activeShip.supplies.water.toFixed(1)} / ${activeShip.supplies.maxWater}` : '-'}</span></div>
            <div style={styles.cardRow}>{Math.round(loadRatio * 100)}% {uiText.nav.loaded}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardHeader}>{uiText.nav.equipment}</div>
            <div style={styles.cardRow}>桅 Lv {riggingLevel} (+{speedBonus}%)</div>
            <div style={styles.cardRow}>貨 Lv {cargoUpgradeLevel}</div>
            <div style={styles.cardRow}>砲 Lv {gunneryLevel} (+{cannonBonus}%)</div>
          </div>
        </div>
      )}

      <div style={styles.footerRow}>
        <div style={styles.footerLeft}>
          <span style={styles.nearPort}>
            {nearest ? `${nearest.port.name} (${nearest.distanceKm.toFixed(1)} km)` : uiText.nav.none}
          </span>
          <span style={[styles.moraleBox, moraleStyle]}>{moraleInfo.text}</span>
        </div>
        <div style={styles.footerRight}>
          <button style={styles.toggleBtn} onClick={() => setShowExtended(!showExtended)}>
            {showExtended ? uiText.nav.collapse : uiText.nav.expandMore}
          </button>
          {player && <span style={styles.playerName}>{player.name}</span>}
        </div>
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
      {dockedPort && <button style={styles.portButton} onClick={() => setPhase('port')}>{uiText.nav.enterPort} {dockedPort.name}</button>}
      <div style={styles.hint}>{navigation.mode === 'docked' ? uiText.nav.clickMarker : uiText.nav.clickSea}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed',
    top: 72,
    left: 12,
    minWidth: 260,
    padding: '10px 12px',
    borderRadius: 14,
    background: 'rgba(12, 19, 34, 0.86)',
    border: '1px solid rgba(120, 172, 219, 0.24)',
    color: '#e8edf7',
    backdropFilter: 'blur(12px)',
    fontSize: 11,
    zIndex: 120,
    pointerEvents: 'auto',
    fontFamily: 'system-ui, sans-serif',
  },
  coreRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: 8,
    marginBottom: 8,
  },
  coreItem: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: '6px 8px',
    textAlign: 'center' as const,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  coreLabel: {
    display: 'block',
    color: '#8fb1d8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 9,
    marginBottom: 2,
  },
  coreValue: {
    fontSize: 14,
    fontWeight: 700,
  },
  coreValueFast: {
    color: '#ef4444',
  },
  extendedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 6,
    marginBottom: 8,
  },
  card: {
    background: 'rgba(255,255,255,0.025)',
    borderRadius: 10,
    padding: '8px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  cardHeader: {
    color: '#8fb1d8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 9,
    marginBottom: 6,
    fontWeight: 700,
  },
  cardRow: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 1.6,
  },
  cardRowSmall: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  },
  footerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  footerLeft: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  nearPort: { color: '#94a3b8', fontSize: 10 },
  moraleBox: {
    padding: '2px 6px',
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  footerRight: { display: 'flex', alignItems: 'center', gap: 6 },
  toggleBtn: {
    padding: '4px 8px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 11,
  },
  playerName: { color: '#60a5fa', fontSize: 11 },
  alert: {
    marginTop: 6,
    padding: 6,
    borderRadius: 8,
    background: 'rgba(239,68,68,0.15)',
    color: '#fca5a5',
    fontWeight: 600,
  },
  noticeWrap: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    background: 'rgba(37, 99, 235, 0.12)',
    border: '1px solid rgba(142, 197, 255, 0.16)',
  },
  noticeTitle: {
    color: '#8fb1d8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
    marginTop: 6,
    paddingTop: 6,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    color: '#b8c9de',
    fontSize: 10,
  },
}

declare global {
  interface Theme {
    styles?: typeof styles
  }
}