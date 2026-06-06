import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useUIStore, type QuestAchievement } from '@/stores/useUIStore.ts'
import { DiscoveryIcon } from '@/components/DiscoveryIcon.tsx'
import { TradeGoodIcon } from '@/components/TradeGoodIcon.tsx'

const DISPLAY_MS = 4300

function getKindLabel(achievement: QuestAchievement): string {
  if (achievement.kind === 'discovery') return '冒険達成'
  if (achievement.kind === 'combat') return '討伐成功'
  return '交易達成'
}

function getSealText(achievement: QuestAchievement): string {
  if (achievement.kind === 'discovery') return '発'
  if (achievement.kind === 'combat') return '討'
  return '納'
}

function getTone(achievement: QuestAchievement): { primary: string; secondary: string; border: string; shadow: string } {
  if (achievement.kind === 'combat') {
    return {
      primary: '#f97316',
      secondary: '#fee2e2',
      border: 'rgba(251, 146, 60, 0.72)',
      shadow: 'rgba(248, 113, 113, 0.38)',
    }
  }
  if (achievement.kind === 'trade') {
    return {
      primary: '#facc15',
      secondary: '#fef9c3',
      border: 'rgba(250, 204, 21, 0.7)',
      shadow: 'rgba(250, 204, 21, 0.32)',
    }
  }
  return {
    primary: '#38bdf8',
    secondary: '#e0f2fe',
    border: 'rgba(125, 211, 252, 0.72)',
    shadow: 'rgba(56, 189, 248, 0.34)',
  }
}

function AchievementIcon({ achievement }: { achievement: QuestAchievement }) {
  if (achievement.kind === 'discovery' && achievement.discoveryId) {
    return <DiscoveryIcon discoveryId={achievement.discoveryId} label={achievement.subject} size={118} />
  }
  if (achievement.kind === 'trade' && achievement.goodId) {
    return <TradeGoodIcon goodId={achievement.goodId} label={achievement.subject} size={118} />
  }
  return <span style={styles.sealText}>{getSealText(achievement)}</span>
}

export function QuestAchievementOverlay() {
  const achievement = useUIStore((state) => state.questAchievement)
  const clearQuestAchievement = useUIStore((state) => state.clearQuestAchievement)
  const setPaused = useGameStore((state) => state.setPaused)
  const previousPausedRef = useRef(false)
  const activeAchievementIdRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const tone = useMemo(() => achievement ? getTone(achievement) : null, [achievement])

  const close = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    clearQuestAchievement()
    if (!previousPausedRef.current) setPaused(false)
    activeAchievementIdRef.current = null
  }, [clearQuestAchievement, setPaused])

  useEffect(() => {
    if (!achievement) return undefined

    if (activeAchievementIdRef.current === null) {
      previousPausedRef.current = useGameStore.getState().paused
    }
    activeAchievementIdRef.current = achievement.id
    setPaused(true)
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(close, DISPLAY_MS)

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [achievement, close, setPaused])

  if (!achievement || !tone) return null

  return (
    <div data-quest-achievement style={styles.backdrop} role="dialog" aria-live="assertive" aria-label={achievement.title}>
      <style>{animationCss}</style>
      <div style={{ ...styles.panel, borderColor: tone.border, boxShadow: `0 28px 90px rgba(0,0,0,0.54), 0 0 46px ${tone.shadow}` }}>
        <div style={{ ...styles.rays, background: `repeating-conic-gradient(from 0deg, ${tone.shadow} 0deg 7deg, transparent 7deg 18deg)` }} />
        <div style={styles.topLine}>
          <span style={{ ...styles.kindBadge, color: tone.secondary, borderColor: tone.border }}>{getKindLabel(achievement)}</span>
        </div>
        <div style={{ ...styles.iconRing, borderColor: tone.border, boxShadow: `0 0 34px ${tone.shadow}` }}>
          <AchievementIcon achievement={achievement} />
        </div>
        <div style={styles.copy}>
          <div style={{ ...styles.title, color: tone.secondary, textShadow: `0 0 18px ${tone.primary}, 0 0 42px ${tone.shadow}` }}>
            {achievement.title}
          </div>
          {achievement.subtitle && <div style={styles.subtitle}>{achievement.subtitle}</div>}
        </div>
        <button style={{ ...styles.closeButton, borderColor: tone.border, color: tone.secondary }} onClick={close}>閉じる</button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 2200,
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    background: 'linear-gradient(180deg, rgba(2, 6, 23, 0.62), rgba(2, 6, 23, 0.84))',
    color: '#eff6ff',
    pointerEvents: 'auto',
  },
  panel: {
    width: 'min(760px, calc(100vw - 36px))',
    minHeight: 430,
    display: 'grid',
    justifyItems: 'center',
    alignContent: 'center',
    gap: 18,
    padding: '34px 28px 26px',
    borderRadius: 8,
    border: '2px solid rgba(125, 211, 252, 0.7)',
    background: 'linear-gradient(180deg, rgba(7, 18, 34, 0.98), rgba(12, 20, 36, 0.96))',
    position: 'relative',
    overflow: 'hidden',
    animation: 'questAchievementPop 430ms cubic-bezier(0.2, 0.9, 0.25, 1.18) both',
  },
  rays: {
    position: 'absolute',
    inset: '-42%',
    opacity: 0.18,
    animation: 'questAchievementRays 9s linear infinite',
    pointerEvents: 'none',
  },
  topLine: {
    position: 'absolute',
    top: 18,
    left: 22,
    right: 22,
    display: 'flex',
    justifyContent: 'center',
  },
  kindBadge: {
    padding: '5px 13px',
    borderRadius: 8,
    border: '1px solid rgba(125, 211, 252, 0.6)',
    background: 'rgba(15, 23, 42, 0.72)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0,
    fontWeight: 800,
  },
  iconRing: {
    width: 148,
    height: 148,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 8,
    border: '2px solid rgba(125, 211, 252, 0.72)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))',
    position: 'relative',
    zIndex: 1,
    animation: 'questAchievementIcon 1500ms ease-in-out infinite',
  },
  sealText: {
    fontSize: 86,
    fontWeight: 900,
    lineHeight: 1,
    color: '#fff7ed',
    textShadow: '0 0 16px rgba(250, 204, 21, 0.72)',
  },
  copy: {
    display: 'grid',
    justifyItems: 'center',
    gap: 8,
    textAlign: 'center',
    minWidth: 0,
  },
  title: {
    fontSize: 'clamp(34px, 7vw, 68px)',
    fontWeight: 950,
    lineHeight: 1.08,
    letterSpacing: 0,
    overflowWrap: 'anywhere',
    animation: 'questAchievementTitle 1500ms ease-in-out infinite',
  },
  subtitle: {
    maxWidth: 560,
    color: '#b8c7dd',
    fontSize: 15,
    lineHeight: 1.55,
  },
  closeButton: {
    marginTop: 2,
    padding: '9px 18px',
    borderRadius: 8,
    border: '1px solid rgba(125, 211, 252, 0.62)',
    background: 'rgba(15, 23, 42, 0.72)',
    cursor: 'pointer',
    fontWeight: 800,
  },
}

const animationCss = `
@keyframes questAchievementPop {
  0% { opacity: 0; transform: translateY(18px) scale(0.92); }
  72% { opacity: 1; transform: translateY(0) scale(1.02); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes questAchievementRays {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes questAchievementIcon {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.045); }
}
@keyframes questAchievementTitle {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.24); }
}
@media (prefers-reduced-motion: reduce) {
  [data-quest-achievement] * {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
  }
}
`
