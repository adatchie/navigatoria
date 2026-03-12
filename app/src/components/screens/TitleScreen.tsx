interface TitleScreenProps {
  onStart: () => void
  onContinue?: () => void
  canContinue?: boolean
}

export function TitleScreen({ onStart, onContinue, canContinue = false }: TitleScreenProps) {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>大航海時代</h1>
        <h2 style={styles.subtitle}>Age of Discovery</h2>
        <div style={styles.actions}>
          <button style={styles.startBtn} onClick={onStart}>
            New Voyage
          </button>
          {canContinue && onContinue && (
            <button style={styles.continueBtn} onClick={onContinue}>
              Continue
            </button>
          )}
        </div>
      </div>
      <p style={styles.version}>Phase 1 — Navigation Prototype</p>
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
    background:
      'radial-gradient(circle at top, rgba(65,128,191,0.28), transparent 35%), linear-gradient(180deg, #07111f 0%, #102845 55%, #07111f 100%)',
    color: '#eee',
    zIndex: 500,
  },
  card: {
    padding: '40px 48px',
    borderRadius: 24,
    background: 'rgba(8, 18, 34, 0.82)',
    border: '1px solid rgba(133, 185, 235, 0.22)',
    boxShadow: '0 20px 80px rgba(0, 0, 0, 0.4)',
    textAlign: 'center',
  },
  title: {
    fontSize: 52,
    fontWeight: 'bold',
    margin: 0,
    textShadow: '0 2px 10px rgba(100, 150, 255, 0.5)',
  },
  subtitle: {
    fontSize: 18,
    color: '#9cb6d5',
    marginBottom: 32,
    letterSpacing: 4,
  },
  actions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
  },
  startBtn: {
    padding: '12px 28px',
    fontSize: 16,
    background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    letterSpacing: 1,
  },
  continueBtn: {
    padding: '12px 28px',
    fontSize: 16,
    background: 'rgba(255,255,255,0.08)',
    color: '#d6e6fb',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 10,
    cursor: 'pointer',
    letterSpacing: 1,
  },
  version: {
    position: 'absolute',
    bottom: 20,
    color: '#445566',
    fontSize: 12,
  },
}
