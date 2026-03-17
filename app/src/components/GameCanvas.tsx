// ============================================================
// GameCanvas — React Three Fiber のメインCanvas
// クリック＝舵（方向指示）、帆の開閉＝速度調整
// ============================================================

import { Suspense, lazy, useMemo, useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MeshBasicMaterial, RingGeometry, SphereGeometry, Raycaster, Vector2, Plane, Vector3, type Mesh } from 'three'
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
import { getDistanceKm } from '@/game/world/queries.ts'

const CameraControls = lazy(async () => import('./CameraControls.tsx').then((mod) => ({ default: mod.CameraControls })))
const DebugGrid = lazy(async () => import('./DebugGrid.tsx').then((mod) => ({ default: mod.DebugGrid })))
const DebugStats = lazy(async () => import('./DebugStats.tsx').then((mod) => ({ default: mod.DebugStats })))

// 港マーカーのサイズ (SCENE_WORLD_SCALE に合わせて調整)
const PORT_MARKER_GEOMETRIES = {
  default: new SphereGeometry(0.5, 14, 14),
  active: new SphereGeometry(0.7, 14, 14),
}
const PORT_MARKER_RING = new RingGeometry(0.8, 1.2, 32)

const PORT_MARKER_MATERIALS: Record<string, MeshBasicMaterial> = {
  portugal: new MeshBasicMaterial({ color: 0x34d399, depthTest: false, depthWrite: false }),
  spain: new MeshBasicMaterial({ color: 0xf97316, depthTest: false, depthWrite: false }),
  england: new MeshBasicMaterial({ color: 0x60a5fa, depthTest: false, depthWrite: false }),
  netherlands: new MeshBasicMaterial({ color: 0xfacc15, depthTest: false, depthWrite: false }),
  france: new MeshBasicMaterial({ color: 0xa78bfa, depthTest: false, depthWrite: false }),
  venice: new MeshBasicMaterial({ color: 0xf87171, depthTest: false, depthWrite: false }),
  ottoman: new MeshBasicMaterial({ color: 0x22c55e, depthTest: false, depthWrite: false }),
  default: new MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false }),
}

const PORT_MARKER_HEIGHT = 1.5

// 入港判定距離 (km) — getDistanceKm は WORLD_DISTANCE_SCALE 込みの値を返す
// デバッグ用: 20km (本番: 200km)
const PORT_DOCK_DISTANCE_KM = 20

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
        position: [shipScenePos[0], 60, shipScenePos[2] + 80],
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
  const groupRef = useRef<THREE.Group>(null)

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
 * addEventListener を使い R3F のイベントシステムと干渉しない
 */
function RudderClickHandler() {
  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new Raycaster(), [])
  const oceanPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), [])
  const mouseVec = useMemo(() => new Vector2(), [])
  const intersectPoint = useMemo(() => new Vector3(), [])

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

      raycaster.setFromCamera(mouseVec, camera)
      const hit = raycaster.ray.intersectPlane(oceanPlane, intersectPoint)
      if (!hit) return

      // シーン座標 → ワールド座標
      const worldPos = sceneToWorld(intersectPoint.x, intersectPoint.z)

      // クリック地点への方位角を計算して舵の方向に設定
      const dx = worldPos.x - nav.position.x
      const dy = worldPos.y - nav.position.y
      const targetHeading = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360

      nav.setTargetHeading(targetHeading)
    }

    canvas.addEventListener('click', handleClick)
    return () => canvas.removeEventListener('click', handleClick)
  }, [camera, gl, raycaster, oceanPlane, mouseVec, intersectPoint])

  return null
}

/**
 * 港への近接を毎フレームチェック
 * 帆を下ろして（sailRatio=0）港の近くにいたら入港可能
 */
function PortProximityChecker() {
  useFrame(() => {
    const nav = useNavigationStore.getState()
    if (nav.mode !== 'anchored' && nav.mode !== 'sailing') return

    const ports = useDataStore.getState().masterData.ports
    // 全港との距離をチェック（getDistanceKm は km を返す）
    let nearestPort: Port | null = null
    let nearestDist = Infinity
    for (const port of ports) {
      const dist = getDistanceKm(nav.position, port.position)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestPort = port
      }
    }

    if (!nearestPort || nearestDist > PORT_DOCK_DISTANCE_KM) return

    // 投錨状態（帆を下ろしている）かつ港の近くなら自動入港
    if (nav.mode === 'anchored') {
      nav.setMode('docked')
      nav.setDockedPort(nearestPort.id)
      nav.setSpeed(0)
      nav.resetVoyage()

      const playerStore = usePlayerStore.getState()
      playerStore.setPosition(nearestPort.position)
      playerStore.updatePlayer({ currentPortId: nearestPort.id })

      // 港画面に自動遷移
      useGameStore.getState().setPhase('port')
    }
  })

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
  const geometry = PORT_MARKER_GEOMETRIES.default
  const ringRef = useRef<Mesh>(null)
  useFrame(() => {
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.01
      ringRef.current.rotation.y += 0.002
    }
  })

  const handleClick = (e: { stopPropagation: () => void }) => {
    // R3Fイベントの伝搬を止めて RudderClickHandler との競合を防ぐ
    e.stopPropagation()

    const nav = useNavigationStore.getState()
    const dx = port.position.x - nav.position.x
    const dy = port.position.y - nav.position.y

    // 同じ港の場合 (dx=0, dy=0) は現在のheadingを維持
    const heading = (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01)
      ? nav.heading
      : ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360

    if (nav.mode === 'docked') {
      // 停泊中 → 出航
      nav.departPort(heading)
    } else {
      // 航海中 → その港の方角に舵を切る
      nav.setTargetHeading(heading)
    }
  }

  const [x, , z] = worldToScene(port.position)
  return (
    <group position={[x, PORT_MARKER_HEIGHT, z]}>
      <mesh geometry={geometry} material={material} onClick={handleClick} />
      <mesh ref={ringRef} geometry={PORT_MARKER_RING} material={material} rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick} />
    </group>
  )
}
