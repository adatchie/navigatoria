// ============================================================
// AssetPreview — GLBモデルプレビュー (Tripo連携確認用)
// ============================================================

import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls, useGLTF } from '@react-three/drei'

interface AssetPreviewProps {
  visible?: boolean
  onClose?: () => void
  standalone?: boolean
}

export function AssetPreview({ visible = true, onClose, standalone = false }: AssetPreviewProps) {
  const [glbUrl, setGlbUrl] = useState('')
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)

  if (!standalone && !visible) {
    return null
  }

  return (
    <div style={standalone ? styles.page : styles.overlay}>
      <div style={standalone ? styles.panelStandalone : styles.panel}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>Asset Preview</h3>
            <p style={styles.subtitle}>GLB の単体検証をメイン画面から切り離して実行します。</p>
          </div>
          {onClose && (
            <button style={styles.closeBtn} onClick={onClose}>
              {standalone ? 'Close Window' : 'Close'}
            </button>
          )}
        </div>

        <div style={styles.inputRow}>
          <input
            type="text"
            placeholder="GLB URL or drag & drop..."
            value={glbUrl}
            onChange={(e) => setGlbUrl(e.target.value)}
            style={styles.input}
          />
          <button
            style={styles.loadBtn}
            onClick={() => setLoadedUrl(glbUrl)}
            disabled={!glbUrl}
          >
            Load
          </button>
        </div>

        <div style={styles.canvas}>
          <Canvas camera={{ position: [3, 2, 3], fov: 50 }}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <Environment preset="sunset" />
            {loadedUrl ? (
              <Suspense fallback={<PreviewPlaceholder />}>
                <GLBModel url={loadedUrl} />
              </Suspense>
            ) : (
              <PreviewPlaceholder />
            )}
            <OrbitControls />
            <gridHelper args={[10, 10, 0x444444, 0x222222]} />
          </Canvas>
        </div>

        <div style={styles.info}>
          {loadedUrl ? (
            <span>Loaded: {loadedUrl.split('/').pop()}</span>
          ) : (
            <span style={styles.emptyText}>No model loaded. Enter a GLB URL above.</span>
          )}
        </div>
      </div>
    </div>
  )
}

function GLBModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene} />
}

function PreviewPlaceholder() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={0x666666} wireframe />
    </mesh>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    width: '100vw',
    height: '100vh',
    background: 'radial-gradient(circle at top, #172136 0%, #070b12 65%)',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
    padding: 24,
    boxSizing: 'border-box',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    width: 600,
    height: 500,
    background: '#1a1a2a',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
  },
  panelStandalone: {
    width: 'min(1100px, 100%)',
    height: '100%',
    background: 'rgba(11, 18, 31, 0.94)',
    border: '1px solid rgba(128, 172, 255, 0.18)',
    borderRadius: 18,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
    backdropFilter: 'blur(16px)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 18px',
    background: 'linear-gradient(180deg, rgba(26, 38, 64, 0.95), rgba(16, 24, 40, 0.95))',
    borderBottom: '1px solid rgba(128, 172, 255, 0.18)',
    gap: 16,
  },
  title: {
    margin: 0,
    color: '#eef4ff',
    fontSize: 18,
    fontWeight: 600,
  },
  subtitle: {
    margin: '4px 0 0',
    color: '#92a7ca',
    fontSize: 12,
  },
  closeBtn: {
    padding: '8px 12px',
    background: 'rgba(122, 181, 255, 0.12)',
    border: '1px solid rgba(122, 181, 255, 0.28)',
    color: '#dbe8ff',
    borderRadius: 8,
    cursor: 'pointer',
  },
  inputRow: {
    display: 'flex',
    padding: 12,
    gap: 8,
    background: 'rgba(9, 14, 24, 0.92)',
  },
  input: {
    flex: 1,
    padding: '10px 12px',
    background: '#131c2b',
    color: '#eef4ff',
    border: '1px solid rgba(128, 172, 255, 0.18)',
    borderRadius: 8,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  loadBtn: {
    minWidth: 96,
    padding: '10px 14px',
    background: 'linear-gradient(180deg, #3568a8, #254877)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  canvas: {
    flex: 1,
    background: 'linear-gradient(180deg, #09111d 0%, #05080f 100%)',
  },
  info: {
    padding: '10px 14px',
    color: '#9ab0d4',
    fontSize: 11,
    fontFamily: 'monospace',
    borderTop: '1px solid rgba(128, 172, 255, 0.18)',
    background: 'rgba(9, 14, 24, 0.92)',
  },
  emptyText: {
    color: '#667791',
  },
}
