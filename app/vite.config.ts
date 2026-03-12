import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import glsl from 'vite-plugin-glsl'
import path from 'path'

function includesAny(id: string, patterns: string[]): boolean {
  return patterns.some((pattern) => id.includes(pattern))
}

function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) {
    return undefined
  }

  const normalizedId = id.replace(/\\/g, '/').toLowerCase()

  if (includesAny(normalizedId, ['/three/addons/', '/three/examples/jsm/'])) {
    return 'vendor-three-addons'
  }

  if (includesAny(normalizedId, ['/three/', '/@types/three/'])) {
    return 'vendor-three'
  }

  if (
    includesAny(normalizedId, [
      '/@react-three/drei/',
      '/three-stdlib/',
      '/maath/',
      '/meshline/',
      '/camera-controls/',
    ])
  ) {
    return 'vendor-drei'
  }

  if (normalizedId.includes('/@react-three/fiber/')) {
    return 'vendor-r3f'
  }

  if (
    includesAny(normalizedId, [
      '/react-use-measure/',
      '/use-sync-external-store/',
      '/suspend-react/',
      '/its-fine/',
    ])
  ) {
    return 'vendor-react-utils'
  }

  if (includesAny(normalizedId, ['/@floating-ui/core/', '/@floating-ui/dom/', '/@floating-ui/react-dom/', '/@floating-ui/utils/'])) {
    return 'vendor-floating'
  }

  if (includesAny(normalizedId, ['/leva/'])) {
    return 'vendor-leva'
  }

  if (normalizedId.includes('/dexie/')) {
    return 'vendor-dexie'
  }

  if (includesAny(normalizedId, ['/react-dropzone/', '/prop-types/'])) {
    return 'vendor-dropzone'
  }

  if (includesAny(normalizedId, ['/@use-gesture/core/', '/@use-gesture/react/'])) {
    return 'vendor-gesture'
  }

  if (normalizedId.includes('/@stitches/react/')) {
    return 'vendor-stitches'
  }

  if (includesAny(normalizedId, ['/react/', '/react-dom/', '/scheduler/'])) {
    return 'vendor-react'
  }

  if (includesAny(normalizedId, ['/zustand/', '/immer/'])) {
    return 'vendor-state'
  }

  if (normalizedId.includes('/zod/')) {
    return 'vendor-zod'
  }

  return 'vendor-misc'
}

export default defineConfig({
  plugins: [react(), glsl()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@types': path.resolve(__dirname, './src/types'),
      '@game': path.resolve(__dirname, './src/game'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@data': path.resolve(__dirname, './src/data'),
      '@rendering': path.resolve(__dirname, './src/rendering'),
      '@components': path.resolve(__dirname, './src/components'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        assetPreview: path.resolve(__dirname, 'asset-preview.html'),
      },
      output: {
        manualChunks,
      },
    },
  },
})
