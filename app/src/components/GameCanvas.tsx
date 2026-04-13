// ============================================================
// GameCanvas — React Three Fiber のメインCanvas
// クリック＝舵（方向指示）、帆の開閉＝速度調整
// ============================================================

import { Suspense, lazy, useMemo, useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CircleGeometry, CylinderGeometry, MeshBasicMaterial, Raycaster, SphereGeometry, Vector2, Plane, Vector3, type Mesh, type Group } from 'three'
import type { Port } from '@/types/port.ts'
import { OceanScene } from '@/rendering/OceanScene.tsx'
import { SkyBox } from '@/rendering/SkyBox.tsx'
import { ShipRenderer } from '@/rendering/ShipRenderer.tsx'
import { LandRenderer } from '@/rendering/LandRenderer.tsx'
import { useUIStore } from '@/stores/useUIStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { worldToScene, sceneToWorld } from '@/rendering/worldTransform.ts'

const CameraControls = lazy(async () => import('./CameraControls.tsx').then((mod) => ({ default: mod.CameraControls })))
const DebugGrid = lazy(async () => import('./DebugGrid.tsx').then((mod) => ({ default: mod.DebugGrid })))
const DebugStats = lazy(async () => import('./DebugStats.tsx').then((mod) => ({ default: mod.DebugStats })))

const PORT_MARKER_GEOMETRIES = {
  base: new CircleGeometry(0.18, 20),
  orb: new SphereGeometry(0.22, 16, 16),
  halo: new CircleGeometry(0.42, 28),
  pin: new CylinderGeometry(0.022, 0.022, 1.4, 10),
  hitbox: new CylinderGeometry(0.22, 0.22, 1.8, 10),
}
const PORT_MARKER_HITBOX_MATERIAL = new MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  depthTest: false,
})

const PORT_MARKER_MATERIALS: Record<string, MeshBasicMaterial> = {
  portugal: new MeshBasicMaterial({ color: 0x34d399, depthTest: true, depthWrite: false, fog: false }),
  spain: new MeshBasicMaterial({ color: 0xf97316, depthTest: true, depthWrite: false, fog: false }),
  england: new MeshBasicMaterial({ color: 0x60a5fa, depthTest: true, depthWrite: false, fog: false }),
  netherlands: new MeshBasicMaterial({ color: 0xfacc15, depthTest: true, depthWrite: false, fog: false }),
  france: new MeshBasicMaterial({ color: 0xa78bfa, depthTest: true, depthWrite: false, fog: false }),
  venice: new MeshBasicMaterial({ color: 0xf87171, depthTest: true, depthWrite: false, fog: false }),
  ottoman: new MeshBasicMaterial({ color: 0x22c55e, depthTest: true, depthWrite: false, fog: false }),
  default: new MeshBasicMaterial({ color: 0xffffff, depthTest: true, depthWrite: false, fog: false }),
}
const PORT_MARKER_HALO_MATERIALS: Record<string, MeshBasicMaterial> = {
  portugal: new MeshBasicMaterial({ color: 0x34d399, depthTest: false, depthWrite: false, fog: false, transparent: true, opacity: 0.2 }),
  spain: new MeshBasicMaterial({ color: 0xf97316, depthTest: false, depthWrite: false, fog: false, transparent: true, opacity: 0.2 }),
  england: new MeshBasicMaterial({ color: 0x60a5fa, depthTest: false, depthWrite: false, fog: false, transparent: true, opacity: 0.2 }),
  netherlands: new MeshBasicMaterial({ color: 0xfacc15, depthTest: false, depthWrite: false, fog: false, transparent: true, opacity: 0.2 }),
  france: new MeshBasicMaterial({ color: 0xa78bfa, depthTest: false, depthWrite: false, fog: false, transparent: true, opacity: 0.2 }),
  venice: new MeshBasicMaterial({ color: 0xf87171, depthTest: false, depthWrite: false, fog: false, transparent: true, opacity: 0.2 }),
  ottoman: new MeshBasicMaterial({ color: 0x22c55e, depthTest: false, depthWrite: false, fog: false, transparent: true, opacity: 0.2 }),
  default: new MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, fog: false, transparent: true, opacity: 0.2 }),
}

const PORT_MARKER_HEIGHT = 0.08
const PORT_MARKER_BASE_Y = 0.01
const PORT_MARKER_PIN_Y = 0.72
const PORT_MARKER_ORB_Y = 1.48
const PORT_MARKER_HALO_Y = 1.48
const PORT_MARKER_HITBOX_Y = 0.9
const PORT_MARKER_PIN_MATERIAL = new MeshBasicMaterial({
  color: 0xd8ecff,
  depthTest: true,
  depthWrite: false,
  fog: false,
  transparent: true,
  opacity: 0.9,
})

export function GameCanvas() {
  const showFPS = useUIStore((s) => s.debugFlags.showFPS)
  const wireframe = useUIStore((s) => s.debugFlags.wireframe)
  const position = useNavigationStore((s) => s.position)
  const heading = useNavigationStore((s) => s.heading)
  const ships = usePlayerStore((s) => s.ships)
  const activeShipId = usePlayerStore((s) => s.activeShipId)
  const getShip = useDataStore((s) => s.getShip)

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

  const shipScenePos = worldToScene(position)

  return (
    <Canvas
      dpr={[1, 1.5]}
      performance={{ min: 0.75 }}
      camera={{
        position: [shipScenePos[0], 60, shipScenePos[2] - 80],
        fov: 55,
        near: 0.1,
        far: 3000,
      }}
      style={{ width: '100%', height: '100%' }}
      gl={glOptions}
    >
      <SkyBox />

      {/* 海面は船に追従（無限海面の錯覚） */}
      <OceanFollower>
        <OceanScene size={600} segments={96} />
      </OceanFollower>

      {/* 大陸・海岸線 */}
      <LandRenderer />

      <ShipRenderer position={shipScenePos} heading={heading} scale={shipScale} />

      {wireframe && (
        <Suspense fallback={null}>
          <DebugGrid />
        </Suspense>
      )}

      {/* 港マーカーは常時表示 */}
      <PortMarkers />

      {/* 港近接チェック（入港判定） */}
      <PortProximityChecker />

      {/* 海面クリック → 舵操作（方向指示） */}
      <RudderClickHandler />

      <Suspense fallback={null}>
        <CameraControls />
      </Suspense>

      {showFPS && (
        <Suspense fallback={null}>
          <DebugStats />
        </Suspense>
      )}
    </Canvas>
  )
}

/** 海面メッシュを船位置に追従させるラッパー */
function OceanFollower({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<Group>(null)

  useFrame(() => {
    if (!groupRef.current) return
    const pos = useNavigationStore.getState().position
    const [sx, , sz] = worldToScene(pos)
    groupRef.current.position.x = sx
    groupRef.current.position.z = sz
  })

  return <group ref={groupRef}>{children}</group>
}

/**
 * 海面クリック → 舵操作
 * クリックした方向に船首を向ける（目的地ではなく方向指示）
 * ポートマーカークリックを判定してスキップ
 */
function RudderClickHandler() {
  const { camera, gl, scene } = useThree()
  const raycaster = useMemo(() => new Raycaster(), [])
  const oceanPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), [])
  const mouseVec = useMemo(() => new Vector2(), [])
  const intersectPoint = useMemo(() => new Vector3(), [])
  const portMarkerRaycaster = useMemo(() => new Raycaster(), [])

  useEffect(() => {
    const canvas = gl.domElement

    function handleClick(event: MouseEvent) {
      if (event.button !== 0) return

      const nav = useNavigationStore.getState()
      // 停泊中・戦闘中はクリックで操舵しない
      if (nav.mode === 'docked' || nav.mode === 'combat') return

      const rect = canvas.getBoundingClientRect()
      mouseVec.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouseVec.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      // ポートマーカーがクリックされたかチェック
      portMarkerRaycaster.setFromCamera(mouseVec, camera)
      const portHits = portMarkerRaycaster.intersectObjects(scene.children, true)

      // PORT_MARKER_HITBOX_MATERIAL でクリックされたら スキップ
      const firstHit = portHits[0]
      if (firstHit && (firstHit.object as Mesh).material === PORT_MARKER_HITBOX_MATERIAL) {
        // 最前面がポートマーカーなら ocean click は無視
        return
      }

      raycaster.setFromCamera(mouseVec, camera)
      const hit = raycaster.ray.intersectPlane(oceanPlane, intersectPoint)
      if (!hit) return

      // 現在は worldToScene の左右反転をやめているため、
      // クリック地点も通常のワールド座標へ戻してから方位角を出す。
      const worldPos = sceneToWorld(intersectPoint.x, intersectPoint.z)
      const dx = worldPos.x - nav.position.x
      const dy = worldPos.y - nav.position.y
      const targetHeading = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360

      nav.setTargetHeading(targetHeading)
    }

    canvas.addEventListener('click', handleClick)
    return () => canvas.removeEventListener('click', handleClick)
  }, [camera, gl, scene, raycaster, oceanPlane, mouseVec, intersectPoint, portMarkerRaycaster])

  return null
}

/**
 * 港への近接チェック（現在は使用していない）
 * ポートマーカークリックで直接入港するため、auto-dockは不要
 */
function PortProximityChecker() {
  // 暫定: ポートマーカークリックのみで入港
  return null
}

function PortMarkers() {
  const ports = useWorldStore((s) => s.ports)

  return (
    <>
      {ports.map((port) => (
        <PortMarker key={port.id} port={port} />
      ))}
    </>
  )
}

function PortMarker({ port }: { port: Port }) {
  const material = PORT_MARKER_MATERIALS[port.nationality] ?? PORT_MARKER_MATERIALS.default
  const haloMaterial = PORT_MARKER_HALO_MATERIALS[port.nationality] ?? PORT_MARKER_HALO_MATERIALS.default
  const haloRef = useRef<Mesh>(null)
  const { camera } = useThree()

  useFrame(() => {
    if (!haloRef.current) return
    haloRef.current.lookAt(camera.position)
  })

  const handleClick = (e: { stopPropagation: () => void }) => {
    // R3Fイベントの伝搬を止めて RudderClickHandler との競合を防ぐ
    e.stopPropagation()

    const nav = useNavigationStore.getState()
    const gameStore = useGameStore.getState()

    if (nav.mode === 'docked') {
      // 停泊中 → 出航
      const dx = port.position.x - nav.position.x
      const dy = port.position.y - nav.position.y
      const heading = (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01)
        ? nav.heading
        : ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360
      nav.departPort(heading)
    } else {
      // 航海中（sailing/anchored） → 直接入港
      nav.setMode('docked')
      nav.setPosition(port.position)
      nav.setDockedPort(port.id)
      nav.setSpeed(0)
      nav.resetVoyage()

      const playerStore = usePlayerStore.getState()
      playerStore.setPosition(port.position)
      playerStore.updatePlayer({ currentPortId: port.id })

      // 港画面に遷移
      gameStore.setPhase('port')
    }
  }

  const [x, , z] = worldToScene(port.position)
  return (
    <group position={[x, PORT_MARKER_HEIGHT, z]}>
      <mesh
        geometry={PORT_MARKER_GEOMETRIES.hitbox}
        material={PORT_MARKER_HITBOX_MATERIAL}
        onClick={handleClick}
        position={[0, PORT_MARKER_HITBOX_Y, 0]}
        renderOrder={5}
      />
      <mesh
        geometry={PORT_MARKER_GEOMETRIES.base}
        material={haloMaterial}
        position={[0, PORT_MARKER_BASE_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={6}
      />
      <mesh
        geometry={PORT_MARKER_GEOMETRIES.pin}
        material={PORT_MARKER_PIN_MATERIAL}
        position={[0, PORT_MARKER_PIN_Y, 0]}
        renderOrder={7}
      />
      <mesh
        geometry={PORT_MARKER_GEOMETRIES.orb}
        material={material}
        position={[0, PORT_MARKER_ORB_Y, 0]}
        onClick={handleClick}
        renderOrder={8}
      />
      <mesh
        ref={haloRef}
        geometry={PORT_MARKER_GEOMETRIES.halo}
        material={haloMaterial}
        position={[0, PORT_MARKER_HALO_Y, 0]}
        renderOrder={9}
      />
    </group>
  )
}
