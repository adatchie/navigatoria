import { useMemo } from 'react'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useEncounterStore } from '@/stores/useEncounterStore.ts'
import { getNearestPort } from '@/game/world/queries.ts'

function formatMoraleLabel(morale: number | null): string {
  if (morale == null) return '-'
  if (morale >= 80) return `${morale.toFixed(0)} high`
  if (morale >= 45) return `${morale.toFixed(0)} steady`
  return `${morale.toFixed(0)} low`
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
  const shipType = activeShip ? getShip(activeShip.typeId) : undefined
  const dockedPort = ports.find((port) => port.id === navigation.dockedPortId)
  const crewRatio = activeShip && shipType ? activeShip.currentCrew / Math.max(1, shipType.crew.min) : null
  const riggingLevel = activeShip?.upgrades?.rigging ?? 0
  const cargoUpgradeLevel = activeShip?.upgrades?.cargo ?? 0
  const loadRatio = activeShip ? activeShip.usedCapacity / Math.max(1, activeShip.maxCapacity) : 0
  const speedBonus = riggingLevel * 4
  const turnBonus = riggingLevel * 6

  return (
    <div style={styles.panel}>
      <div style={styles.row}><span style={styles.label}>Mode</span><strong>{navigation.mode}</strong></div>
      <div style={styles.row}><span style={styles.label}>Ship</span><span>{shipType?.name ?? activeShip?.name ?? 'none'}</span></div>
      <div style={styles.row}><span style={styles.label}>Base Speed</span><span>{shipType?.speed ?? '-'} kt</span></div>
      <div style={styles.row}><span style={styles.label}>Turn</span><span>{shipType?.turnRate ?? '-'} deg/s</span></div>
      <div style={styles.row}><span style={styles.label}>Durability</span><span>{activeShip?.currentDurability ?? '-'} / {activeShip?.maxDurability ?? '-'}</span></div>
      <div style={styles.row}><span style={styles.label}>Crew</span><span>{activeShip?.currentCrew ?? '-'} / {activeShip?.maxCrew ?? '-'}</span></div>
      <div style={styles.row}><span style={styles.label}>Morale</span><span>{formatMoraleLabel(activeShip?.morale ?? null)}</span></div>
      <div style={styles.row}><span style={styles.label}>Rigging</span><span>Lv {riggingLevel} / speed +{speedBonus}% / turn +{turnBonus}%</span></div>
      <div style={styles.row}><span style={styles.label}>Cargo Rig</span><span>Lv {cargoUpgradeLevel} / load {(loadRatio * 100).toFixed(0)}%</span></div>
      <div style={styles.row}><span style={styles.label}>Crew Load</span><span>{crewRatio ? `${crewRatio.toFixed(2)}x req` : '-'}</span></div>
      <div style={styles.row}><span style={styles.label}>Food</span><span>{activeShip ? activeShip.supplies.food.toFixed(1) : '-'} / {activeShip?.supplies.maxFood ?? '-'}</span></div>
      <div style={styles.row}><span style={styles.label}>Water</span><span>{activeShip ? activeShip.supplies.water.toFixed(1) : '-'} / {activeShip?.supplies.maxWater ?? '-'}</span></div>
      <div style={styles.row}><span style={styles.label}>Position</span><span>{navigation.position.x.toFixed(1)}, {navigation.position.y.toFixed(1)}</span></div>
      <div style={styles.row}><span style={styles.label}>Speed</span><span>{navigation.currentSpeed.toFixed(1)} kt</span></div>
      <div style={styles.row}><span style={styles.label}>Wind</span><span>{navigation.wind.direction.toFixed(0)} deg / {navigation.wind.speed.toFixed(1)} kt</span></div>
      <div style={styles.row}><span style={styles.label}>Destination</span><span>{navigation.destinationName ?? 'none'}</span></div>
      <div style={styles.row}><span style={styles.label}>Nearest Port</span><span>{nearest ? `${nearest.port.name} (${nearest.distanceKm.toFixed(1)} km)` : 'none'}</span></div>
      {player && <div style={styles.row}><span style={styles.label}>Captain</span><span>{player.name}</span></div>}
      {encounter && <div style={styles.alert}>Encounter: {encounter.title}</div>}
      {voyageNotice && (
        <div style={styles.noticeWrap}>
          <div style={styles.noticeTitle}>Voyage Event</div>
          <div style={styles.noticeText}>{voyageNotice}</div>
          <button style={styles.noticeButton} onClick={clearVoyageNotice}>dismiss</button>
        </div>
      )}
      {encounterNotice && !encounter && (
        <div style={styles.noticeWrap}>
          <div style={styles.noticeTitle}>Encounter Result</div>
          <div style={styles.noticeText}>{encounterNotice}</div>
          <button style={styles.noticeButton} onClick={clearEncounterNotice}>dismiss</button>
        </div>
      )}
      {dockedPort && <button style={styles.portButton} onClick={() => setPhase('port')}>Enter {dockedPort.name}</button>}
      <div style={styles.hint}>Click a port marker to set sail.</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed',
    top: 72,
    left: 12,
    minWidth: 260,
    padding: '12px 14px',
    borderRadius: 14,
    background: 'rgba(12, 19, 34, 0.82)',
    border: '1px solid rgba(120, 172, 219, 0.24)',
    color: '#e8edf7',
    backdropFilter: 'blur(10px)',
    fontSize: 12,
    zIndex: 120,
  },
  row: { display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  label: { color: '#8fb1d8', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 },
  noticeWrap: { marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(37, 99, 235, 0.16)', border: '1px solid rgba(142, 197, 255, 0.2)' },
  noticeTitle: { color: '#8fb1d8', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10, marginBottom: 4 },
  noticeText: { color: '#dbeafe', lineHeight: 1.4 },
  noticeButton: { marginTop: 8, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontSize: 11 },
  portButton: {
    width: '100%', marginTop: 10, padding: '10px 12px', borderRadius: 10,
    border: '1px solid rgba(142, 197, 255, 0.35)', background: 'linear-gradient(135deg, rgba(24,94,173,0.9), rgba(35,151,210,0.8))', color: '#fff', cursor: 'pointer',
  },
  hint: { marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', color: '#b8c9de' },
}

