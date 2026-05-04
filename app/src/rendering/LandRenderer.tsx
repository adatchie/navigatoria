// ============================================================
// LandRenderer — static world land texture + worker detail tile
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  DoubleSide,
  LinearFilter,
  MeshBasicMaterial,
  PlaneGeometry,
  Texture,
  TextureLoader,
} from 'three'
import { WORLD_HEIGHT, WORLD_WIDTH } from '@/config/gameConfig.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { SCENE_WORLD_SCALE, worldToScene } from '@/rendering/worldTransform.ts'

interface DetailTileState {
  texture: Texture
  centerX: number
  centerY: number
}

interface DetailTileMessage {
  type: 'detail-tile-rendered'
  requestId: number
  centerX: number
  centerY: number
  svg: string
}

const LAND_BASE_TEXTURE_URL = `${import.meta.env.BASE_URL}generated/land-base.svg`
const DETAIL_UPDATE_INTERVAL = 0.45
const DETAIL_TEXTURE_SIZE = 4096
const DETAIL_TILE_WORLD_SIZE = 2200
const DETAIL_TILE_MOVE_THRESHOLD = 220

export function LandRenderer() {
  const [baseTexture, setBaseTexture] = useState<Texture | null>(null)
  const gl = useThree((state) => state.gl)
  const maxAnisotropy = gl.capabilities.getMaxAnisotropy()

  useEffect(() => {
    let cancelled = false
    const loader = new TextureLoader()

    loader.load(LAND_BASE_TEXTURE_URL, (texture) => {
      if (cancelled) {
        texture.dispose()
        return
      }

      texture.minFilter = LinearFilter
      texture.magFilter = LinearFilter
      texture.anisotropy = maxAnisotropy
      texture.generateMipmaps = false
      texture.needsUpdate = true
      setBaseTexture(texture)
    })

    return () => {
      cancelled = true
    }
  }, [maxAnisotropy])

  const geometry = useMemo(
    () => new PlaneGeometry(WORLD_WIDTH * SCENE_WORLD_SCALE, WORLD_HEIGHT * SCENE_WORLD_SCALE),
    [],
  )
  const material = useMemo(() => {
    if (!baseTexture) return null
    return new MeshBasicMaterial({
      map: baseTexture,
      alphaTest: 0.01,
      side: DoubleSide,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  }, [baseTexture])

  useEffect(() => () => {
    geometry.dispose()
  }, [geometry])

  useEffect(() => () => {
    material?.dispose()
  }, [material])

  useEffect(() => () => {
    baseTexture?.dispose()
  }, [baseTexture])

  return (
    <>
      {material && (
        <mesh
          geometry={geometry}
          material={material}
          position={[0, 1.8, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          renderOrder={20}
        />
      )}
      <NearbyLandDetail maxAnisotropy={maxAnisotropy} />
    </>
  )
}

function createSvgTextureUrl(svg: string): string {
  return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
}

function NearbyLandDetail({ maxAnisotropy }: { maxAnisotropy: number }) {
  const [tileState, setTileState] = useState<DetailTileState | null>(null)
  const workerStateRef = useRef({
    worker: null as Worker | null,
    elapsed: 0,
    requestId: 0,
    pendingRequest: null as number | null,
    lastRequestedCenter: null as { x: number; y: number } | null,
  })

  useEffect(() => {
    const worker = new Worker(new URL('./workers/landDetailWorker.ts', import.meta.url), { type: 'module' })
    const loader = new TextureLoader()
    let cancelled = false
    let activeObjectUrl: string | null = null
    const workerState = workerStateRef.current
    workerState.worker = worker

    worker.onmessage = (event: MessageEvent<DetailTileMessage>) => {
      const message = event.data
      if (message.type !== 'detail-tile-rendered') return
      if (message.requestId !== workerState.pendingRequest) return

      workerState.pendingRequest = null
      const objectUrl = createSvgTextureUrl(message.svg)
      const previousObjectUrl = activeObjectUrl
      activeObjectUrl = objectUrl

      loader.load(objectUrl, (texture) => {
        if (cancelled || objectUrl !== activeObjectUrl) {
          texture.dispose()
          URL.revokeObjectURL(objectUrl)
          return
        }

        texture.minFilter = LinearFilter
        texture.magFilter = LinearFilter
        texture.anisotropy = maxAnisotropy
        texture.generateMipmaps = false
        texture.needsUpdate = true

        setTileState((current) => {
          current?.texture.dispose()
          return {
            texture,
            centerX: message.centerX,
            centerY: message.centerY,
          }
        })

        if (previousObjectUrl) URL.revokeObjectURL(previousObjectUrl)
      })
    }

    return () => {
      cancelled = true
      worker.terminate()
      workerState.worker = null
      if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl)
    }
  }, [maxAnisotropy])

  useFrame((_, delta) => {
    const workerState = workerStateRef.current
    const worker = workerState.worker
    if (!worker || workerState.pendingRequest !== null) return

    workerState.elapsed += delta
    if (workerState.elapsed < DETAIL_UPDATE_INTERVAL) return
    workerState.elapsed = 0

    const position = useNavigationStore.getState().position
    const lastCenter = workerState.lastRequestedCenter
    if (
      lastCenter &&
      Math.hypot(position.x - lastCenter.x, position.y - lastCenter.y) < DETAIL_TILE_MOVE_THRESHOLD
    ) {
      return
    }

    const requestId = workerState.requestId + 1
    workerState.requestId = requestId
    workerState.pendingRequest = requestId
    workerState.lastRequestedCenter = { x: position.x, y: position.y }

    worker.postMessage({
      type: 'render-detail-tile',
      requestId,
      centerX: position.x,
      centerY: position.y,
      tileWorldSize: DETAIL_TILE_WORLD_SIZE,
      textureSize: DETAIL_TEXTURE_SIZE,
    })
  })

  const tileMaterial = useMemo(() => {
    if (!tileState) return null
    return new MeshBasicMaterial({
      map: tileState.texture,
      alphaTest: 0.01,
      transparent: true,
      side: DoubleSide,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })
  }, [tileState])

  const tileGeometry = useMemo(
    () => new PlaneGeometry(DETAIL_TILE_WORLD_SIZE * SCENE_WORLD_SCALE, DETAIL_TILE_WORLD_SIZE * SCENE_WORLD_SCALE),
    [],
  )

  useEffect(() => () => {
    tileMaterial?.dispose()
  }, [tileMaterial])

  useEffect(() => () => {
    tileGeometry.dispose()
  }, [tileGeometry])

  useEffect(() => () => {
    tileState?.texture.dispose()
  }, [tileState])

  const tilePosition = tileState ? worldToScene({ x: tileState.centerX, y: tileState.centerY }) : null
  if (!tileMaterial || !tilePosition) return null

  return (
    <mesh
      geometry={tileGeometry}
      material={tileMaterial}
      position={[tilePosition[0], 1.84, tilePosition[2]]}
      rotation={[Math.PI / 2, 0, 0]}
      renderOrder={28}
    />
  )
}
