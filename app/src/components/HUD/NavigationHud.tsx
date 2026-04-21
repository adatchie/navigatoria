import { useMemo } from 'react'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useEncounterStore } from '@/stores/useEncounterStore.ts'
import { getNearestPort } from '@/game/world/queries.ts'
import { uiText } from '@/i18n/uiText.ts'

function ratio(current: number, max: number): number {
  return Math.max(0, Math.min(1, current / Math.max(1, max)))
}

function barColor(value: number): string {
  if (value < 0.25) return '#ef4444'
  if (value < 0.5) return '#f59e0b'
  return '#60a5fa'
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
      {dockedPort && <button style={styles.portButton} onClick={() => setPhase('port')}>{uiText.nav.enterPort} {dockedPort.name}</button>}
      <div style={styles.hint}>
        {player ? `${player.name} / ` : ''}
        {navigation.mode === 'docked' ? uiText.nav.clickMarker : uiText.nav.clickSea}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed',
    top: 72,
    left: 12,
    width: 330,
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
}
