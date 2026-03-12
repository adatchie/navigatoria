import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AssetPreview } from './components/debug/AssetPreview.tsx'
import './index.css'

function closeStandalonePreview() {
  window.close()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AssetPreview standalone onClose={closeStandalonePreview} />
  </StrictMode>,
)
