import type { CSSProperties } from 'react'
import { createNpcFleetEncounter } from '@/game/encounter/npcFleetEncounter.ts'
import { findNpcFleetDefinition, isNpcFleetSuppressed } from '@/game/world/npcFleetRegistry.ts'
import { getNpcFleetSnapshot } from '@/game/world/npcFleetSimulation.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { useEncounterStore } from '@/stores/useEncounterStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useNpcFleetStore } from '@/stores/useNpcFleetStore.ts'
import { useUIStore } from '@/stores/useUIStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'

export function NpcFleetAttackDialog() {
  const pendingFleetId = useNpcFleetStore((s) => s.pendingAttackFleetId)
  const cancelAttack = useNpcFleetStore((s) => s.cancelAttack)
  const getShip = useDataStore((s) => s.getShip)
  const fleet = pendingFleetId ? findNpcFleetDefinition(pendingFleetId) : undefined

  if (!pendingFleetId || !fleet) return null

  const confirmAttack = () => {
    const ports = useWorldStore.getState().ports
    const totalDays = useGameStore.getState().gameTime.totalGameSeconds / 86400
    const navigation = useNavigationStore.getState()
    const snapshot = getNpcFleetSnapshot(fleet, ports, totalDays)
    if (!snapshot || snapshot.inPort || isNpcFleetSuppressed(fleet.id, totalDays)) {
      useUIStore.getState().addNotification('対象艦隊を捕捉できませんでした。', 'warning', 2600)
      cancelAttack()
      return
    }

    const encounter = createNpcFleetEncounter({
      snapshot,
      playerPosition: navigation.position,
      currentDay: Math.floor(totalDays),
      weatherType: navigation.weather.type,
      getShip,
    })
    const triggered = useEncounterStore.getState().triggerEncounter(encounter)
    if (triggered) {
      useEncounterStore.getState().startCombat()
    }
    cancelAttack()
  }

  return (
    <div style={styles.backdrop}>
      <div style={styles.dialog}>
        <div style={styles.header}>
          <span style={styles.eyebrow}>艦隊捕捉</span>
          <strong>{fleet.commander}の艦隊に戦闘を仕掛けますか？</strong>
        </div>
        <p style={styles.body}>{fleet.name}</p>
        <div style={styles.actions}>
          <button type="button" style={styles.secondaryButton} onClick={cancelAttack}>NO</button>
          <button type="button" style={styles.primaryButton} onClick={confirmAttack}>YES</button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 120,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(2, 6, 23, 0.42)',
    pointerEvents: 'auto',
  },
  dialog: {
    width: 'min(420px, calc(100vw - 32px))',
    maxHeight: 'calc(100vh - 32px)',
    overflow: 'auto',
    padding: 18,
    borderRadius: 14,
    background: 'rgba(9, 18, 34, 0.94)',
    border: '1px solid rgba(191, 219, 254, 0.24)',
    color: '#eaf2ff',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.42)',
  },
  header: {
    display: 'grid',
    gap: 6,
  },
  eyebrow: {
    color: '#93c5fd',
    fontSize: 12,
  },
  body: {
    margin: '12px 0 16px',
    color: '#b8c7dd',
    fontSize: 13,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },
  primaryButton: {
    minWidth: 88,
    padding: '9px 16px',
    borderRadius: 10,
    border: '1px solid rgba(96, 165, 250, 0.62)',
    background: '#2563eb',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButton: {
    minWidth: 88,
    padding: '9px 16px',
    borderRadius: 10,
    border: '1px solid rgba(148, 163, 184, 0.36)',
    background: 'rgba(15, 23, 42, 0.7)',
    color: '#cbd5e1',
    fontWeight: 700,
    cursor: 'pointer',
  },
} satisfies Record<string, CSSProperties>
