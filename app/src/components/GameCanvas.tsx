// ============================================================
// GameCanvas — React Three Fiber のメインCanvas + カメラ制御
// ============================================================

import { Suspense, lazy, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { MeshBasicMaterial, SphereGeometry } from 'three'
import { OceanScene } from '@/rendering/OceanScene.tsx'
import { SkyBox } from '@/rendering/SkyBox.tsx'
import { ShipRenderer } from '@/rendering/ShipRenderer.tsx'
import { useUIStore } from '@/stores/useUIStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { worldToScene } from '@/rendering/worldTransform.ts'

const CameraControls = lazy(async () => import('./CameraControls.tsx').then((mod) => ({ default: mod.CameraControls })))
const DebugGrid = lazy(async () => import('./DebugGrid.tsx').then((mod) => ({ default: mod.DebugGrid })))
const DebugStats = lazy(async () => import('./DebugStats.tsx').then((mod) => ({ default: mod.DebugStats })))

const PORT_MARKER_GEOMETRIES = {
  default: new SphereGeometry(0.9, 14, 14),
  active: new SphereGeometry(1.2, 14, 14),
}

const PORT_MARKER_MATERIALS: Record<string, MeshBasicMaterial> = {
  portugal: new MeshBasicMaterial({ color: 0x34d399 }),
  spain: new MeshBasicMaterial({ color: 0xf97316 }),
  england: new MeshBasicMaterial({ color: 0x60a5fa }),
  netherlands: new MeshBasicMaterial({ color: 0xfacc15 }),
  france: new MeshBasicMaterial({ color: 0xa78bfa }),
  venice: new MeshBasicMaterial({ color: 0xf87171 }),
  ottoman: new MeshBasicMaterial({ color: 0x22c55e }),
  default: new MeshBasicMaterial({ color: 0xffffff }),
}

export function GameCanvas() {
  const showFPS = useUIStore((s) => s.debugFlags.showFPS)
  const wireframe = useUIStore((s) => s.debugFlags.wireframe)
  const showPortMarkers = useUIStore((s) => s.debugFlags.showPortMarkers)
  const position = useNavigationStore((s) => s.position)
  const heading = useNavigationStore((s) => s.heading)
  const ships = usePlayerStore((s) => s.ships)
  const activeShipId = usePlayerStore((s) => s.activeShipId)
  const getShip = useDataStore((s) => s.getShip)
  const [controlsRequested, setControlsRequested] = useState(false)

  const activeShip = ships.find((ship) => ship.instanceId === activeShipId)
  const shipType = activeShip ? getShip(activeShip.typeId) : undefined
  const shipScale =
    shipType?.category === 'small_sail' ? 0.9 :
    shipType?.category === 'medium_sail' ? 1.15 :
    shipType?.category === 'large_sail' ? 1.45 :
    shipType?.category === 'galley' ? 1.1 : 1.2

  const glOptions = useMemo(
    () => ({
      antialias: false,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance' as const,
    }),
    [],
  )

  const requestControls = () => {
    setControlsRequested((current) => current || true)
  }

  return (
    <Canvas
      dpr={[1, 1.5]}
      performance={{ min: 0.75 }}
      camera={{
        position: [0, 70, 95],
        fov: 55,
        near: 0.1,
        far: 1000,
      }}
      style={{ width: '100%', height: '100%' }}
      gl={glOptions}
      onPointerDown={requestControls}
      onWheel={requestControls}
      onTouchStart={requestControls}
    >
      <SkyBox />
      <OceanScene size={500} segments={96} />
      <ShipRenderer position={worldToScene(position)} heading={heading} scale={shipScale} />

      {wireframe && (
        <Suspense fallback={null}>
          <DebugGrid />
        </Suspense>
      )}

      {showPortMarkers && <PortMarkers />}

      {controlsRequested && (
        <Suspense fallback={null}>
          <CameraControls />
        </Suspense>
      )}

      {showFPS && (
        <Suspense fallback={null}>
          <DebugStats />
        </Suspense>
      )}
    </Canvas>
  )
}

function PortMarkers() {
  const ports = useWorldStore((s) => s.ports)
  const destination = useNavigationStore((s) => s.destinationName)
  const setDestination = useNavigationStore((s) => s.setDestination)
  const setMode = useNavigationStore((s) => s.setMode)
  const setDockedPort = useNavigationStore((s) => s.setDockedPort)
  const resetVoyage = useNavigationStore((s) => s.resetVoyage)

  return (
    <>
      {ports.map((port) => {
        const isActive = destination === port.name
        const geometry = isActive ? PORT_MARKER_GEOMETRIES.active : PORT_MARKER_GEOMETRIES.default
        const material = PORT_MARKER_MATERIALS[port.nationality] ?? PORT_MARKER_MATERIALS.default

        return (
          <mesh
            key={port.id}
            geometry={geometry}
            material={material}
            position={worldToScene(port.position)}
            onClick={() => {
              setDestination(port.position, port.name)
              setDockedPort(null)
              resetVoyage()
              setMode('sailing')
            }}
          />
        )
      })}
    </>
  )
}
