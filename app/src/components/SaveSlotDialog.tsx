import type { CSSProperties } from 'react'
import type { SaveSlotSummary } from '@/persistence/GameState.ts'

type SaveSlotDialogMode = 'save' | 'load'

interface SaveSlotDialogProps {
  mode: SaveSlotDialogMode
  slots: SaveSlotSummary[]
  busySlot?: number | null
  message?: string | null
  onSelect: (slot: number) => void
  onClose: () => void
}

function formatSavedDate(value: number | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SaveSlotDialog({ mode, slots, busySlot, message, onSelect, onClose }: SaveSlotDialogProps) {
  const isSaveMode = mode === 'save'
  const title = isSaveMode ? 'セーブスロット' : 'ロードスロット'
  const actionLabel = isSaveMode ? '保存' : '再開'

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <div style={styles.dialog}>
        <div style={styles.header}>
          <div>
            <span style={styles.eyebrow}>{isSaveMode ? 'Save game' : 'Load game'}</span>
            <h2 style={styles.title}>{title}</h2>
          </div>
          <button type="button" style={styles.closeButton} onClick={onClose}>閉じる</button>
        </div>
        {message && <div style={styles.message}>{message}</div>}
        <div style={styles.slotList}>
          {slots.map((slot) => {
            const disabled = !isSaveMode && slot.isEmpty
            const isBusy = busySlot === slot.slot
            return (
              <button
                key={slot.slot}
                type="button"
                style={{ ...styles.slotButton, ...(slot.isEmpty ? styles.emptySlot : {}), ...(disabled ? styles.disabledSlot : {}) }}
                disabled={disabled || isBusy}
                onClick={() => onSelect(slot.slot)}
              >
                <span style={styles.slotNumber}>Slot {slot.slot}</span>
                <span style={styles.slotMain}>{slot.isEmpty ? '空きスロット' : slot.playerName ?? '航海者'}</span>
                <span style={styles.slotMeta}>{slot.levelSummary ?? 'Lv -'}</span>
                <span style={styles.slotMeta}>{slot.locationName ?? '場所 -'}</span>
                <span style={styles.slotDate}>{formatSavedDate(slot.updatedAt)}</span>
                <strong style={styles.actionText}>{isBusy ? '処理中' : actionLabel}</strong>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1600,
    display: 'grid',
    placeItems: 'center',
    padding: 18,
    background: 'rgba(2, 6, 23, 0.58)',
    backdropFilter: 'blur(2px)',
    color: '#e8edf7',
  },
  dialog: {
    width: 'min(820px, calc(100vw - 28px))',
    maxHeight: 'min(740px, calc(100vh - 32px))',
    overflow: 'auto',
    padding: 16,
    borderRadius: 14,
    background: 'rgba(9, 18, 34, 0.97)',
    border: '1px solid rgba(191, 219, 254, 0.24)',
    boxShadow: '0 28px 90px rgba(0, 0, 0, 0.48)',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    gap: 12,
    marginBottom: 12,
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
    fontSize: 26,
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
  message: {
    marginBottom: 10,
    padding: '9px 10px',
    borderRadius: 8,
    background: 'rgba(14, 116, 144, 0.24)',
    border: '1px solid rgba(125, 211, 252, 0.24)',
    color: '#cffafe',
    fontWeight: 700,
  },
  slotList: {
    display: 'grid',
    gap: 8,
  },
  slotButton: {
    width: '100%',
    minHeight: 58,
    display: 'grid',
    gridTemplateColumns: '72px minmax(0, 1fr) 54px',
    gap: 8,
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(147, 197, 253, 0.22)',
    background: 'rgba(15, 23, 42, 0.78)',
    color: '#e8edf7',
    textAlign: 'left',
    cursor: 'pointer',
    font: 'inherit',
  },
  emptySlot: {
    border: '1px dashed rgba(148, 163, 184, 0.24)',
    background: 'rgba(255, 255, 255, 0.035)',
  },
  disabledSlot: {
    cursor: 'not-allowed',
    opacity: 0.56,
  },
  slotNumber: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: 800,
  },
  slotMain: {
    color: '#f8fafc',
    fontWeight: 800,
    overflowWrap: 'anywhere',
  },
  slotMeta: {
    color: '#cbd5e1',
    fontSize: 12,
    overflowWrap: 'anywhere',
  },
  slotDate: {
    gridColumn: '2 / span 2',
    color: '#93a4bb',
    fontSize: 12,
    overflowWrap: 'anywhere',
  },
  actionText: {
    justifySelf: 'end',
    color: '#fde68a',
    fontSize: 12,
  },
}
