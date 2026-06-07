// ============================================================
// LoadingScreen — データロード中の表示
// ============================================================

import { antiqueAssets, antiqueColors, antiqueFonts } from '@/ui/antiqueTheme.ts'

interface LoadingScreenProps {
  progress?: number // 0-100
  message?: string
}

export function LoadingScreen({ progress = 0, message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div style={styles.container}>
      <div style={styles.panel}>
        <img src={antiqueAssets.compassRose} alt="" aria-hidden="true" style={styles.compass} />
        <p style={styles.message}>{message}</p>
        {progress > 0 && (
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
        )}
      </div>
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
    backgroundImage: `linear-gradient(180deg, rgba(20,10,6,0.34), rgba(20,10,6,0.76)), url("${antiqueAssets.titleChart}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: antiqueColors.ink,
    zIndex: 600,
  },
  panel: {
    display: 'grid',
    justifyItems: 'center',
    gap: 12,
    minWidth: 260,
    padding: '22px 28px',
    border: `1px solid ${antiqueColors.brassDark}`,
    borderRadius: 4,
    background: `linear-gradient(135deg, rgba(244,232,193,0.86), rgba(212,196,160,0.78)), url("${antiqueAssets.parchmentTile}")`,
    backgroundSize: 'auto, 360px 360px',
    boxShadow: 'inset 0 0 24px rgba(139,101,8,0.18), 0 18px 52px rgba(0,0,0,0.34)',
  },
  compass: {
    width: 54,
    height: 54,
    animation: 'spin 7s linear infinite',
    filter: 'drop-shadow(0 2px 2px rgba(44,24,16,0.28))',
  },
  message: { fontSize: 14, color: antiqueColors.inkLight, margin: 0, fontFamily: antiqueFonts.body },
  progressBar: {
    width: 200,
    height: 5,
    background: 'rgba(90,61,43,0.22)',
    borderRadius: 2,
    border: `1px solid rgba(139,101,8,0.24)`,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${antiqueColors.brassDark}, ${antiqueColors.brassBright})`,
    borderRadius: 2,
    transition: 'width 0.3s',
  },
}
