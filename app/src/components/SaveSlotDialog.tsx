import type { CSSProperties } from 'react'
import type { SaveSlotSummary } from '@/persistence/GameState.ts'
import { antiqueAssets, antiqueColors, antiqueFonts, antiqueStyles } from '@/ui/antiqueTheme.ts'

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
        <img src={antiqueAssets.cornerFlourish} alt="" aria-hidden="true" style={{ ...styles.corner, ...styles.cornerTl }} />
        <img src={antiqueAssets.cornerFlourish} alt="" aria-hidden="true" style={{ ...styles.corner, ...styles.cornerTr }} />
        <div style={styles.header}>
          <div>
            <span style={styles.eyebrow}>{isSaveMode ? 'Save game' : 'Load game'}</span>
            <h2 style={styles.title}>{title}</h2>
          </div>
          <button type="button" style={styles.closeButton} onClick={onClose}>閉じる</button>
        </div>
        <img src={antiqueAssets.ornamentDivider} alt="" aria-hidden="true" style={styles.divider} />
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
    background: 'rgba(20, 10, 6, 0.58)',
    backdropFilter: 'blur(2px)',
    color: antiqueColors.ink,
  },
  dialog: {
    ...antiqueStyles.parchmentSurface,
    position: 'relative',
    width: 'min(820px, calc(100vw - 28px))',
    maxHeight: 'min(740px, calc(100vh - 32px))',
    overflow: 'auto',
    padding: '20px 22px 22px',
  },
  corner: {
    position: 'absolute',
    width: 58,
    height: 58,
    opacity: 0.34,
    pointerEvents: 'none',
  },
  cornerTl: {
    top: 8,
    left: 8,
  },
  cornerTr: {
    top: 8,
    right: 8,
    transform: 'scaleX(-1)',
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
    color: antiqueColors.brassDark,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontFamily: antiqueFonts.title,
  },
  title: {
    margin: 0,
    fontSize: 26,
    lineHeight: 1.15,
    letterSpacing: '0.08em',
    fontFamily: antiqueFonts.body,
    color: antiqueColors.ink,
  },
  closeButton: {
    ...antiqueStyles.woodButton,
    minWidth: 64,
    minHeight: 34,
    padding: '7px 10px',
  },
  divider: {
    display: 'block',
    width: 'min(420px, 78%)',
    height: 24,
    objectFit: 'fill',
    margin: '-2px 0 12px',
    opacity: 0.62,
  },
  message: {
    marginBottom: 10,
    padding: '9px 10px',
    borderRadius: 3,
    background: 'rgba(184, 134, 11, 0.12)',
    border: `1px solid ${antiqueColors.brass}`,
    color: antiqueColors.ink,
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
    gridTemplateColumns: '76px minmax(0, 1fr) 74px',
    gap: 8,
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 3,
    border: `1px solid rgba(139, 101, 8, 0.34)`,
    background: 'rgba(255, 255, 255, 0.22)',
    color: antiqueColors.ink,
    textAlign: 'left',
    cursor: 'pointer',
    font: 'inherit',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.28)',
  },
  emptySlot: {
    border: `1px dashed rgba(90, 61, 43, 0.36)`,
    background: 'rgba(92, 60, 34, 0.08)',
  },
  disabledSlot: {
    cursor: 'not-allowed',
    opacity: 0.56,
  },
  slotNumber: {
    color: antiqueColors.brassDark,
    fontSize: 12,
    fontWeight: 800,
    fontFamily: antiqueFonts.title,
  },
  slotMain: {
    color: antiqueColors.ink,
    fontWeight: 800,
    overflowWrap: 'anywhere',
  },
  slotMeta: {
    color: antiqueColors.inkLight,
    fontSize: 12,
    overflowWrap: 'anywhere',
  },
  slotDate: {
    gridColumn: '2 / span 2',
    color: antiqueColors.inkFaded,
    fontSize: 12,
    overflowWrap: 'anywhere',
  },
  actionText: {
    justifySelf: 'end',
    color: antiqueColors.sealRed,
    fontSize: 12,
  },
}
