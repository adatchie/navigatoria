import type { CombatAction, CombatDistance, EncounterAction } from '@/types/encounter.ts'
import { useEncounterStore } from '@/stores/useEncounterStore.ts'

const ACTION_LABELS: Record<CombatAction, string> = {
  cannon: 'Fire Cannons',
  board: 'Board',
  withdraw: 'Withdraw',
}

const ACTION_DESCRIPTIONS: Record<CombatAction, string> = {
  cannon: '距離が長くても安定した砲撃。close で追加 Crew ダメージ。',
  board: '接近・接舷で威力を発揮。long では距離を詰める準備。',
  withdraw: '逃走/包囲回避。距離が近いほど失敗リスクが高まる。',
}

const DISTANCE_VALUES: Record<CombatDistance, number> = {
  long: 0.2,
  close: 0.65,
  boarded: 1,
}

const DISTANCE_LABELS = {
  long: 'Long Range',
  close: 'Close Range',
  boarded: 'Boarded',
} as const

const SHIP_CLASS_LABELS: Record<string, string> = {
  small_sail: '小型帆船',
  medium_sail: '中型帆船',
  large_sail: '大型帆船',
  galley: 'ガレー系',
  oriental: '東洋船',
}

const RECOMMENDED_ACTION_MAP: Record<EncounterAction, CombatAction[]> = {
  engage: ['cannon', 'board'],
  evade: ['withdraw'],
  ignore: ['withdraw'],
}

const TACTIC_LABELS: Record<string, string> = {
  pirate: '接舷寄り',
  navy: '砲戦寄り',
  merchant: '逃走寄り',
  derelict: '無力船',
}

export function EncounterOverlay() {
  const encounter = useEncounterStore((s) => s.activeEncounter)
  const combatState = useEncounterStore((s) => s.combatState)
  const resolveEncounter = useEncounterStore((s) => s.resolveEncounter)
  const performCombatAction = useEncounterStore((s) => s.performCombatAction)
  const closeEncounter = useEncounterStore((s) => s.closeEncounter)
  const recommendedActions = encounter ? RECOMMENDED_ACTION_MAP[encounter.recommendedAction] ?? [] : []

  if (!encounter) return null

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>{combatState ? 'Battle Screen' : 'Sea Encounter'}</div>
            <h2 style={styles.title}>{encounter.title}</h2>
          </div>
          <div style={styles.badge}>Threat {encounter.threat}</div>
        </div>

        {!combatState && (
          <>
            <p style={styles.description}>{encounter.description}</p>
            <div style={styles.grid}>
              <div style={styles.info}><span style={styles.label}>Ship</span><strong>{encounter.shipName}</strong></div>
              <div style={styles.info}><span style={styles.label}>Class</span><strong>{encounter.shipClass ? SHIP_CLASS_LABELS[encounter.shipClass] ?? encounter.shipClass : '不明'}</strong></div>
              <div style={styles.info}><span style={styles.label}>Crew</span><strong>{encounter.enemyCrew}</strong></div>
              <div style={styles.info}><span style={styles.label}>Durability</span><strong>{encounter.enemyDurability}</strong></div>
              <div style={styles.info}><span style={styles.label}>Cannons</span><strong>{encounter.enemyCannonSlots}</strong></div>
              <div style={styles.info}><span style={styles.label}>Speed</span><strong>{encounter.enemySpeed}</strong></div>
              <div style={styles.info}><span style={styles.label}>Turn</span><strong>{encounter.enemyTurnRate}</strong></div>
              <div style={styles.info}><span style={styles.label}>Tactic</span><strong>{TACTIC_LABELS[encounter.type] ?? '不明'}</strong></div>
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
          </>
        )}

        {combatState && (
          <>
            <div style={styles.hudRow}>
              <div style={styles.distancePanel}>
                <span style={styles.distanceLabel}>Distance</span>
                <div style={styles.distanceTrack}>
                  <div style={{ ...styles.distanceFill, width: `${DISTANCE_VALUES[combatState.distance] * 100}%` }} />
                </div>
                <span style={styles.distanceSub}>{DISTANCE_LABELS[combatState.distance]} / Round {combatState.round}</span>
              </div>
              <div style={styles.actionInsights}>
                {(Object.keys(ACTION_LABELS) as CombatAction[]).map((action) => {
                  const isRecommended = recommendedActions.includes(action)
                  return (
                    <div key={action} style={isRecommended ? styles.actionBadgePrimary : styles.actionBadge}>
                    <strong>{ACTION_LABELS[action]}</strong>
                    <span style={styles.actionNote}>{ACTION_DESCRIPTIONS[action]}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={styles.battleHeaderRow}>
              <div style={styles.battleMetric}><span style={styles.label}>Round</span><strong>{combatState.round}</strong></div>
              <div style={styles.battleMetric}><span style={styles.label}>Distance</span><strong>{DISTANCE_LABELS[combatState.distance]}</strong></div>
              <div style={styles.battleMetric}><span style={styles.label}>Enemy</span><strong>{encounter.shipName}</strong></div>
              <div style={styles.battleMetric}><span style={styles.label}>Cannons</span><strong>{encounter.enemyCannonSlots}</strong></div>
            </div>
            <div style={styles.duelGrid}>
              <StatusCard
                title="Player Ship"
                durability={combatState.playerDurability}
                maxDurability={combatState.playerMaxDurability}
                crew={combatState.playerCrew}
                maxCrew={combatState.playerMaxCrew}
                morale={combatState.playerMorale}
                tone="player"
              />
              <StatusCard
                title={encounter.shipName}
                durability={combatState.enemyDurability}
                maxDurability={combatState.enemyMaxDurability}
                crew={combatState.enemyCrew}
                maxCrew={combatState.enemyMaxCrew}
                morale={Math.round((combatState.enemyCrew / Math.max(1, combatState.enemyMaxCrew)) * 100)}
                tone="enemy"
              />
            </div>
            <div style={styles.logPanel}>
              <div style={styles.logTitle}>{combatState.phase === 'resolved' ? 'Battle Result' : 'Battle Log'}</div>
              {combatState.result && <div style={styles.resultText}>{combatState.result.message}</div>}
              {combatState.log.length === 0 && <div style={styles.logEntryMuted}>最初の一手を選ぶと、ここに戦況が流れます。</div>}
              {combatState.log.map((entry) => (
                <div key={`${entry.round}-${entry.action}`} style={styles.logEntry}>
                  <div style={styles.logRound}>Round {entry.round} / {ACTION_LABELS[entry.action]}</div>
                  <div>{entry.summary}</div>
                  <div style={styles.logStats}>You -{entry.playerDamage} hull / -{entry.playerCrewLoss} crew | Enemy -{entry.enemyDamage} hull / -{entry.enemyCrewLoss} crew</div>
                </div>
              ))}
            </div>
            {combatState.phase !== 'resolved' && (
              <div style={styles.actions}>
                <button style={styles.secondaryButton} onClick={() => performCombatAction('withdraw')}>Withdraw</button>
                <button style={styles.secondaryButton} onClick={() => performCombatAction('board')}>Board</button>
                <button style={styles.primaryButton} onClick={() => performCombatAction('cannon')}>Fire Cannons</button>
              </div>
            )}
            {combatState.phase === 'resolved' && (
              <div style={styles.actions}>
                <button style={styles.primaryButton} onClick={closeEncounter}>Continue Voyage</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StatusCard(props: {
  title: string
  durability: number
  maxDurability: number
  crew: number
  maxCrew: number
  morale: number
  tone: 'player' | 'enemy'
}) {
  const accent = props.tone === 'player' ? '#7dd3fc' : '#fca5a5'
  return (
    <div style={styles.statusCard}>
      <div style={{ ...styles.statusTitle, color: accent }}>{props.title}</div>
      <ProgressRow label="Hull" value={props.durability} max={props.maxDurability} color={accent} />
      <ProgressRow label="Crew" value={props.crew} max={props.maxCrew} color={accent} />
      <ProgressRow label="Morale" value={props.morale} max={100} color={accent} />
    </div>
  )
}

function ProgressRow(props: { label: string; value: number; max: number; color: string }) {
  const percent = Math.max(0, Math.min(100, (props.value / Math.max(1, props.max)) * 100))
  return (
    <div style={styles.progressRow}>
      <div style={styles.progressLabelRow}>
        <span style={styles.label}>{props.label}</span>
        <strong>{Math.round(props.value)} / {Math.round(props.max)}</strong>
      </div>
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${percent}%`, background: props.color }} />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(3, 8, 18, 0.58)', zIndex: 650 },
  card: { width: 'min(720px, calc(100vw - 32px))', padding: 24, borderRadius: 22, background: 'linear-gradient(180deg, rgba(8,18,32,0.98), rgba(11,24,42,0.99))', color: '#edf3fb', border: '1px solid rgba(128, 176, 222, 0.22)', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' },
  header: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  eyebrow: { color: '#7fb6f5', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em' },
  title: { margin: '8px 0 0', fontSize: 28 },
  badge: { padding: '8px 10px', borderRadius: 999, background: 'rgba(239, 68, 68, 0.18)', color: '#fecaca', fontSize: 12 },
  description: { color: '#b8c9de', lineHeight: 1.6 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 12 },
  info: { display: 'flex', flexDirection: 'column', gap: 4, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.04)' },
  label: { color: '#8ca4c4', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' },
  recommend: { marginTop: 16, color: '#93c5fd' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, flexWrap: 'wrap' },
  primaryButton: { padding: '11px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #2563eb, #0ea5e9)', color: '#fff', cursor: 'pointer' },
  secondaryButton: { padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer' },
  battleHeaderRow: { display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  battleMetric: { minWidth: 120, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: 4 },
  duelGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 16 },
  statusCard: { padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' },
  statusTitle: { fontWeight: 700, marginBottom: 10 },
  progressRow: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 },
  progressLabelRow: { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 },
  progressTrack: { height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%' },
  logPanel: { marginTop: 16, padding: 14, borderRadius: 14, background: 'rgba(4,10,18,0.45)', border: '1px solid rgba(125,211,252,0.12)', maxHeight: 240, overflowY: 'auto' },
  logTitle: { fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#8fb8e8', marginBottom: 10 },
  resultText: { marginBottom: 10, color: '#dbeafe', lineHeight: 1.5 },
  logEntry: { padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 4 },
  logEntryMuted: { color: '#7f91ab', lineHeight: 1.6 },
  logRound: { color: '#bfdbfe', fontSize: 12 },
  logStats: { color: '#9eb2cc', fontSize: 12 },
  hudRow: { display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-start' },
  distancePanel: { flex: '0 0 220px', padding: 12, borderRadius: 14, background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(99, 102, 241, 0.25)' },
  distanceLabel: { fontSize: 11, letterSpacing: 1, color: '#94a3b8', textTransform: 'uppercase' },
  distanceTrack: { marginTop: 6, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  distanceFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #38bdf8, #6366f1)' },
  distanceSub: { marginTop: 6, fontSize: 12, color: '#cbd5f5' },
  actionInsights: { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 },
  actionBadge: { padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 4 },
  actionBadgePrimary: { padding: 10, borderRadius: 12, background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))', border: '1px solid rgba(34,197,94,0.6)', display: 'flex', flexDirection: 'column', gap: 4 },
  actionNote: { fontSize: 11, color: '#94a3b8', lineHeight: 1.4 },
}
