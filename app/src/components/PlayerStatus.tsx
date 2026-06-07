import type { CSSProperties } from 'react'
import { useDataStore } from '@/stores/useDataStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { EXPERIENCE_TRACKS, getTrackLevel, getTrackProgress } from '@/game/player/progression.ts'
import type { ProfessionType } from '@/types/character.ts'

const PROFESSION_LABELS: Record<ProfessionType, string> = {
  adventurer: '冒険家',
  trader: '商人',
  soldier: '軍人',
}

const NATIONALITY_LABELS: Record<string, string> = {
  portugal: 'ポルトガル',
  spain: 'スペイン',
  england: 'イングランド',
  netherlands: 'ネーデルラント',
  france: 'フランス',
  venice: 'ヴェネツィア',
  ottoman: 'オスマン',
}

function formatNationality(nationality: string): string {
  return NATIONALITY_LABELS[nationality] ?? nationality
}

function formatExp(current: number, required: number): string {
  if (required <= 0) return 'MAX'
  return `${current} / ${required}`
}

function getExpRatio(current: number, required: number): number {
  if (required <= 0) return 1
  return Math.max(0, Math.min(1, current / Math.max(1, required)))
}

type PlayerStatusButtonProps = {
  onClick: () => void
}

export function PlayerStatusButton({ onClick }: PlayerStatusButtonProps) {
  const player = usePlayerStore((s) => s.player)
  if (!player) return null

  return (
    <button type="button" style={styles.statusButton} onClick={onClick} aria-label="プレイヤー情報を開く" title="プレイヤー情報">
      <span style={styles.buttonIcon} aria-hidden="true">人</span>
      <span style={styles.buttonText}>{player.name}</span>
    </button>
  )
}

type PlayerStatusModalProps = {
  onClose: () => void
}

export function PlayerStatusModal({ onClose }: PlayerStatusModalProps) {
  const player = usePlayerStore((s) => s.player)
  const ships = usePlayerStore((s) => s.ships)
  const officers = usePlayerStore((s) => s.officers)
  const skills = useDataStore((s) => s.masterData.skills)
  const discoveries = useDataStore((s) => s.masterData.discoveries)

  if (!player) return null

  const learnedSkills = player.skills
    .map((skill) => ({
      ...skill,
      master: skills.find((item) => item.id === skill.skillId),
    }))
    .sort((a, b) => (a.master?.category ?? '').localeCompare(b.master?.category ?? '') || (a.master?.name ?? a.skillId).localeCompare(b.master?.name ?? b.skillId))
  const discoveredCount = player.discoveredDiscoveryIds?.length ?? 0

  return (
    <div style={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="プレイヤー情報">
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div>
            <span style={styles.eyebrow}>Player status</span>
            <h2 style={styles.title}>{player.name}</h2>
          </div>
          <button type="button" style={styles.closeButton} onClick={onClose}>閉じる</button>
        </div>

        <div style={styles.summaryGrid}>
          <InfoCell label="国籍" value={formatNationality(player.nationality)} />
          <InfoCell label="職業" value={PROFESSION_LABELS[player.profession]} />
          <InfoCell label="名声" value={player.stats.fame.toLocaleString()} />
          <InfoCell label="悪名" value={player.stats.notoriety.toLocaleString()} />
          <InfoCell label="所持金" value={`${player.money.toLocaleString()} d`} />
          <InfoCell label="預金" value={`${player.deposit.toLocaleString()} d`} />
          <InfoCell label="借金" value={`${player.debt.toLocaleString()} d`} />
          <InfoCell label="発見物" value={`${discoveredCount} / ${discoveries.length}`} />
        </div>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>成長</h3>
          <div style={styles.trackList}>
            {EXPERIENCE_TRACKS.map((track) => {
              const level = getTrackLevel(player.stats, track.id)
              const progress = getTrackProgress(player.stats, track.id)
              return (
                <div key={track.id} style={styles.trackRow}>
                  <div style={styles.trackHeader}>
                    <span style={styles.trackLabel}>{track.label}</span>
                    <strong>Lv {level}</strong>
                    <span style={styles.expText}>{formatExp(progress.current, progress.required)}</span>
                  </div>
                  <div style={styles.expTrack}>
                    <div style={{ ...styles.expFill, width: `${Math.round(getExpRatio(progress.current, progress.required) * 100)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>基礎</h3>
          <div style={styles.compactGrid}>
            <InfoCell label="HP" value={`${player.stats.hp} / ${player.stats.maxHp}`} />
            <InfoCell label="艦隊" value={`${ships.length} 隻`} />
            <InfoCell label="航海士" value={`${officers.length} 名`} />
            <InfoCell label="所持品" value={`${player.inventory.reduce((sum, item) => sum + item.quantity, 0)} 個`} />
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>スキル</h3>
          {learnedSkills.length === 0 ? (
            <div style={styles.emptyState}>習得しているスキルはありません。</div>
          ) : (
            <div style={styles.skillList}>
              {learnedSkills.map((skill) => (
                <div key={skill.skillId} style={styles.skillPill}>
                  <span>{skill.master?.name ?? skill.skillId}</span>
                  <strong>R{skill.rank}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoCell}>
      <span style={styles.infoLabel}>{label}</span>
      <strong style={styles.infoValue}>{value}</strong>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  statusButton: {
    position: 'fixed',
    top: 'calc(6px * var(--navigatoria-ui-scale, 1))',
    right: 'calc(14px * var(--navigatoria-ui-scale, 1))',
    zIndex: 1360,
    minWidth: 118,
    height: 30,
    display: 'inline-grid',
    gridTemplateColumns: '22px minmax(0, 1fr)',
    alignItems: 'center',
    gap: 7,
    padding: '0 10px 0 5px',
    borderRadius: 8,
    border: '1px solid rgba(191, 219, 254, 0.36)',
    background: 'rgba(8, 18, 34, 0.88)',
    color: '#e8edf7',
    boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
    backdropFilter: 'blur(10px)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 800,
    transform: 'scale(var(--navigatoria-ui-scale, 1))',
    transformOrigin: 'top right',
  },
  buttonIcon: {
    width: 22,
    height: 22,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    background: 'rgba(96, 165, 250, 0.22)',
    color: '#bfdbfe',
    fontSize: 11,
  },
  buttonText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1500,
    display: 'grid',
    placeItems: 'center',
    padding: 18,
    background: 'rgba(2, 6, 23, 0.54)',
    backdropFilter: 'blur(2px)',
    color: '#e8edf7',
  },
  modal: {
    width: 'min(760px, calc(100vw - 28px))',
    maxHeight: 'min(720px, calc(100vh - 32px))',
    overflow: 'auto',
    padding: 16,
    borderRadius: 14,
    background: 'rgba(9, 18, 34, 0.97)',
    border: '1px solid rgba(191, 219, 254, 0.24)',
    boxShadow: '0 28px 90px rgba(0, 0, 0, 0.48)',
    fontFamily: 'system-ui, sans-serif',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    gap: 12,
    marginBottom: 14,
  },
  eyebrow: {
    display: 'block',
    marginBottom: 4,
    color: '#93c5fd',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  title: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.15,
    letterSpacing: 0,
  },
  closeButton: {
    minWidth: 64,
    minHeight: 34,
    padding: '7px 10px',
    borderRadius: 8,
    border: '1px solid rgba(148, 163, 184, 0.32)',
    background: 'rgba(15, 23, 42, 0.72)',
    color: '#dbeafe',
    cursor: 'pointer',
    fontWeight: 700,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(142px, 1fr))',
    gap: 8,
    marginBottom: 12,
  },
  compactGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
    gap: 8,
  },
  infoCell: {
    minHeight: 58,
    padding: '9px 10px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(148, 163, 184, 0.12)',
    display: 'grid',
    gap: 4,
    alignContent: 'center',
  },
  infoLabel: {
    color: '#93a4bb',
    fontSize: 10,
  },
  infoValue: {
    color: '#f8fafc',
    fontSize: 16,
    lineHeight: 1.15,
    overflowWrap: 'anywhere',
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    margin: '0 0 8px',
    color: '#bfdbfe',
    fontSize: 14,
    letterSpacing: 0,
  },
  trackList: {
    display: 'grid',
    gap: 8,
  },
  trackRow: {
    padding: 10,
    borderRadius: 8,
    background: 'rgba(15, 23, 42, 0.72)',
    border: '1px solid rgba(148, 163, 184, 0.14)',
  },
  trackHeader: {
    display: 'grid',
    gridTemplateColumns: '68px 64px 1fr',
    gap: 8,
    alignItems: 'center',
    marginBottom: 7,
  },
  trackLabel: {
    color: '#cbd5e1',
    fontWeight: 800,
  },
  expText: {
    color: '#93a4bb',
    textAlign: 'right',
    fontSize: 12,
  },
  expTrack: {
    height: 7,
    borderRadius: 999,
    background: 'rgba(148, 163, 184, 0.18)',
    overflow: 'hidden',
  },
  expFill: {
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, #38bdf8, #facc15)',
  },
  skillList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    minHeight: 30,
    padding: '5px 8px',
    borderRadius: 999,
    background: 'rgba(30, 64, 175, 0.24)',
    border: '1px solid rgba(147, 197, 253, 0.22)',
    color: '#dbeafe',
    fontSize: 12,
  },
  emptyState: {
    padding: 12,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.035)',
    color: '#93a4bb',
  },
}
