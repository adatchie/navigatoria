import { uiText } from '@/i18n/uiText.ts'
import { antiqueAssets, antiqueColors, antiqueFonts, antiqueStyles } from '@/ui/antiqueTheme.ts'

interface TitleScreenProps {
  onStart: () => void
  onContinue?: () => void
  hasSaveData?: boolean
}

export function TitleScreen({ onStart, onContinue, hasSaveData = false }: TitleScreenProps) {
  return (
    <div style={styles.container}>
      <div style={styles.vignette} />
      <div style={styles.card}>
        <img src={antiqueAssets.waxSeal} alt="" aria-hidden="true" style={styles.waxSeal} />
        <img src={antiqueAssets.ornamentDivider} alt="" aria-hidden="true" style={styles.divider} />
        <h1 style={styles.title}>大航海時代</h1>
        <h2 style={styles.subtitle}>{uiText.title.subtitle}</h2>
        <p style={styles.caption}>航海日誌を開き、未知の海へ漕ぎ出す</p>
        <div style={{ ...styles.actions, ...(hasSaveData ? styles.actionsWithContinue : {}) }}>
          {hasSaveData && onContinue && (
            <button style={styles.continueBtn} onClick={onContinue}>
              {uiText.title.continue}
            </button>
          )}
          <button style={styles.startBtn} onClick={onStart}>
            {uiText.title.newVoyage}
          </button>
        </div>
        <img src={antiqueAssets.ornamentDivider} alt="" aria-hidden="true" style={styles.dividerBottom} />
      </div>
      <p style={styles.version}>{uiText.title.version}</p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundImage: `linear-gradient(180deg, rgba(15, 8, 4, 0.12), rgba(12, 6, 3, 0.48)), url("${antiqueAssets.titleChart}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: antiqueColors.ink,
    zIndex: 500,
  },
  vignette: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at center, rgba(255,255,255,0.04), rgba(0,0,0,0.42) 72%)',
    pointerEvents: 'none',
  },
  card: {
    ...antiqueStyles.parchmentSurface,
    position: 'relative',
    width: 'min(560px, calc(100vw - 32px))',
    padding: '34px 42px 30px',
    textAlign: 'center',
    overflow: 'hidden',
  },
  waxSeal: {
    position: 'absolute',
    right: 22,
    top: 20,
    width: 72,
    height: 72,
    opacity: 0.54,
    transform: 'rotate(-10deg)',
    pointerEvents: 'none',
  },
  divider: {
    width: 'min(330px, 76%)',
    height: 24,
    objectFit: 'fill',
    opacity: 0.72,
    marginBottom: 4,
  },
  dividerBottom: {
    width: 'min(280px, 64%)',
    height: 22,
    objectFit: 'fill',
    opacity: 0.44,
    marginTop: 20,
  },
  title: {
    fontFamily: antiqueFonts.title,
    fontSize: 52,
    fontWeight: 'bold',
    margin: 0,
    color: antiqueColors.ink,
    letterSpacing: '0.12em',
    textShadow: '0 1px 0 rgba(255,255,255,0.4)',
  },
  subtitle: {
    fontSize: 18,
    color: antiqueColors.inkLight,
    margin: '8px 0 0',
    letterSpacing: '0.24em',
    fontFamily: antiqueFonts.body,
  },
  caption: {
    margin: '18px 0 28px',
    color: antiqueColors.inkLight,
    fontSize: 13,
    lineHeight: 1.8,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  actionsWithContinue: {
    justifyContent: 'space-between',
  },
  startBtn: {
    ...antiqueStyles.brassButton,
    flex: '0 1 220px',
    padding: '12px 28px',
    fontSize: 16,
  },
  continueBtn: {
    ...antiqueStyles.woodButton,
    flex: '0 1 220px',
    padding: '12px 28px',
    fontSize: 16,
  },
  version: {
    position: 'absolute',
    bottom: 20,
    color: antiqueColors.parchmentDark,
    fontSize: 12,
    textShadow: '0 1px 2px #000',
  },
}
