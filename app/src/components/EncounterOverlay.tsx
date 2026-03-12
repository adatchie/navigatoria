import { useEncounterStore } from '@/stores/useEncounterStore.ts'

export function EncounterOverlay() {
  const encounter = useEncounterStore((s) => s.activeEncounter)
  const resolveEncounter = useEncounterStore((s) => s.resolveEncounter)
  if (!encounter) return null

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>Sea Encounter</div>
            <h2 style={styles.title}>{encounter.title}</h2>
          </div>
          <div style={styles.badge}>Threat {encounter.threat}</div>
        </div>
        <p style={styles.description}>{encounter.description}</p>
        <div style={styles.grid}>
          <div style={styles.info}><span style={styles.label}>Ship</span><strong>{encounter.shipName}</strong></div>
          <div style={styles.info}><span style={styles.label}>Crew</span><strong>{encounter.enemyCrew}</strong></div>
          <div style={styles.info}><span style={styles.label}>Durability</span><strong>{encounter.enemyDurability}</strong></div>
          <div style={styles.info}><span style={styles.label}>Zone</span><strong>{encounter.zoneName ?? 'Open Sea'}</strong></div>
          <div style={styles.info}><span style={styles.label}>Weather</span><strong>{encounter.weatherType}</strong></div>
          <div style={styles.info}><span style={styles.label}>Hint</span><strong>{encounter.lootHint ?? 'No clear gain'}</strong></div>
        </div>
        <div style={styles.recommend}>Recommended: {encounter.recommendedAction}</div>
        <div style={styles.actions}>
          <button style={styles.secondaryButton} onClick={() => resolveEncounter('ignore')}>Ignore</button>
          <button style={styles.secondaryButton} onClick={() => resolveEncounter('evade')}>Evade</button>
          <button style={styles.primaryButton} onClick={() => resolveEncounter('engage')}>Engage</button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(3, 8, 18, 0.58)', zIndex: 650 },
  card: { width: 'min(560px, calc(100vw - 32px))', padding: 24, borderRadius: 22, background: 'linear-gradient(180deg, rgba(8,18,32,0.98), rgba(11,24,42,0.99))', color: '#edf3fb', border: '1px solid rgba(128, 176, 222, 0.22)', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' },
  header: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  eyebrow: { color: '#7fb6f5', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em' },
  title: { margin: '8px 0 0', fontSize: 28 },
  badge: { padding: '8px 10px', borderRadius: 999, background: 'rgba(239, 68, 68, 0.18)', color: '#fecaca', fontSize: 12 },
  description: { color: '#b8c9de', lineHeight: 1.6 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 12 },
  info: { display: 'flex', flexDirection: 'column', gap: 4, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.04)' },
  label: { color: '#8ca4c4', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' },
  recommend: { marginTop: 16, color: '#93c5fd' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  primaryButton: { padding: '11px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #2563eb, #0ea5e9)', color: '#fff', cursor: 'pointer' },
  secondaryButton: { padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer' },
}
