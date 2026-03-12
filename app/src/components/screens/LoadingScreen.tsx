// ============================================================
// LoadingScreen — データロード中の表示
// ============================================================

interface LoadingScreenProps {
  progress?: number // 0-100
  message?: string
}

export function LoadingScreen({ progress = 0, message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div style={styles.container}>
      <div style={styles.spinner}>⚓</div>
      <p style={styles.message}>{message}</p>
      {progress > 0 && (
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
      )}
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
    background: '#0a1020',
    color: '#eee',
    zIndex: 600,
  },
  spinner: {
    fontSize: 48,
    animation: 'spin 2s linear infinite',
  },
  message: { fontSize: 14, color: '#8899bb', marginTop: 16 },
  progressBar: {
    width: 200,
    height: 4,
    background: '#222',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#4488cc',
    borderRadius: 2,
    transition: 'width 0.3s',
  },
}
