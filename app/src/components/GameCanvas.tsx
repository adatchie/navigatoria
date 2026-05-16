// ============================================================
// GameCanvas — React Three Fiber のメインCanvas
// クリック＝舵（方向指示）、帆の開閉＝速度調整
// ============================================================

import { Suspense, createRef, lazy, useMemo, useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, Raycaster, Vector2, Plane, Vector3, type Mesh, type Group } from 'three'
import type { Port } from '@/types/port.ts'
import { NPC_FLEETS } from '@/data/master/npcFleets.ts'
import { OceanScene } from '@/rendering/OceanScene.tsx'
import { SkyBox } from '@/rendering/SkyBox.tsx'
import { FleetPlaceholderRenderer, FleetShipRenderer } from '@/rendering/ShipRenderer.tsx'
import { NpcFleetRenderer } from '@/rendering/NpcFleetRenderer.tsx'
import { WakeRenderer } from '@/rendering/WakeRenderer.tsx'
import { LandRenderer } from '@/rendering/LandRenderer.tsx'
import { TerrainReliefRenderer } from '@/rendering/TerrainReliefRenderer.tsx'
import { isNpcFleetSuppressed } from '@/game/world/npcFleetRegistry.ts'
import { getNpcFleetSnapshot } from '@/game/world/npcFleetSimulation.ts'
import { useUIStore } from '@/stores/useUIStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNpcFleetStore } from '@/stores/useNpcFleetStore.ts'
import { worldToScene, sceneToWorld } from '@/rendering/worldTransform.ts'

const CameraControls = lazy(async () => import('./CameraControls.tsx').then((mod) => ({ default: mod.CameraControls })))
const DebugGrid = lazy(async () => import('./DebugGrid.tsx').then((mod) => ({ default: mod.DebugGrid })))
const DebugStats = lazy(async () => import('./DebugStats.tsx').then((mod) => ({ default: mod.DebugStats })))

const PORT_MARKER_GEOMETRIES = {
  plaza: new CircleGeometry(0.74, 24),
  halo: new CircleGeometry(1.02, 28),
  quay: new BoxGeometry(1.08, 0.12, 0.24),
  storehouse: new BoxGeometry(0.34, 0.36, 0.32),
  house: new BoxGeometry(0.28, 0.42, 0.28),
  manor: new BoxGeometry(0.44, 0.62, 0.38),
  tower: new CylinderGeometry(0.13, 0.16, 0.9, 8),
  roof: new ConeGeometry(0.26, 0.22, 4),
  towerRoof: new ConeGeometry(0.2, 0.28, 8),
  flagPole: new CylinderGeometry(0.018, 0.018, 0.68, 8),
  flag: new BoxGeometry(0.3, 0.16, 0.018),
  hitbox: new CylinderGeometry(0.82, 0.82, 2.1, 14),
}
const PORT_MARKER_HITBOX_MATERIAL = new MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  depthTest: false,
})
const NPC_FLEET_HITBOX_GEOMETRY = new CylinderGeometry(3.2, 3.2, 6, 18)
const NPC_FLEET_HITBOX_MATERIAL = new MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  depthTest: false,
})

const PORT_MARKER_MATERIALS: Record<string, MeshStandardMaterial> = {
  portugal: new MeshStandardMaterial({ color: 0x34d399, roughness: 0.72, metalness: 0.03 }),
  spain: new MeshStandardMaterial({ color: 0xf97316, roughness: 0.72, metalness: 0.03 }),
  england: new MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.72, metalness: 0.03 }),
  netherlands: new MeshStandardMaterial({ color: 0xfacc15, roughness: 0.72, metalness: 0.03 }),
  france: new MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.72, metalness: 0.03 }),
  venice: new MeshStandardMaterial({ color: 0xf87171, roughness: 0.72, metalness: 0.03 }),
  ottoman: new MeshStandardMaterial({ color: 0x22c55e, roughness: 0.72, metalness: 0.03 }),
  default: new MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.03 }),
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
const PORT_CITY_BASE_Y = 1.92
const PORT_CITY_HALO_Y = 1.94
const PORT_MARKER_HITBOX_Y = 2.48
const PORT_CITY_WALL_MATERIAL = new MeshStandardMaterial({ color: 0xc7b38a, roughness: 0.84, metalness: 0 })
const PORT_CITY_ROOF_MATERIAL = new MeshStandardMaterial({ color: 0x9f4f2d, roughness: 0.78, metalness: 0 })
const PORT_CITY_QUAY_MATERIAL = new MeshStandardMaterial({ color: 0x6b5138, roughness: 0.9, metalness: 0 })
const PORT_CITY_WINDOW_MATERIAL = new MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.9 })

const PORT_CITY_SIZE_CONFIG = {
  small: { scale: 0.82, extraHouses: 0, towerScale: 0.78 },
  medium: { scale: 1, extraHouses: 1, towerScale: 0.92 },
  large: { scale: 1.16, extraHouses: 2, towerScale: 1.05 },
  capital: { scale: 1.34, extraHouses: 3, towerScale: 1.22 },
} as const

export function GameCanvas() {
  const showFPS = useUIStore((s) => s.debugFlags.showFPS)
  const wireframe = useUIStore((s) => s.debugFlags.wireframe)

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

  const initialShipScenePos = useMemo(() => worldToScene(useNavigationStore.getState().position), [])

  return (
    <Canvas
      dpr={[1, 1.5]}
      performance={{ min: 0.75 }}
      camera={{
        position: [initialShipScenePos[0], 60, initialShipScenePos[2] - 80],
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
      <WakeRenderer />

      {/* 大陸・海岸線 */}
      <LandRenderer />
      <TerrainReliefRenderer />

      <Suspense fallback={<FleetPlaceholderRenderer />}>
        <FleetShipRenderer />
      </Suspense>
      <NpcFleetRenderer />
      <NpcFleetInteractionLayer />

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
      const markerHit = portHits.find((hit) => {
        const material = (hit.object as Mesh).material
        return material === PORT_MARKER_HITBOX_MATERIAL || material === NPC_FLEET_HITBOX_MATERIAL
      })
      if (markerHit) {
        // 港/NPC艦隊クリックは ocean click と競合させない
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

function NpcFleetInteractionLayer() {
  const questFleets = useNpcFleetStore((s) => s.questFleets)
  const fleets = useMemo(() => [...NPC_FLEETS, ...Object.values(questFleets)], [questFleets])
  const fleetCount = fleets.length
  const fleetRefs = useMemo(
    () => Array.from({ length: fleetCount }, () => createRef<Group>()),
    [fleetCount],
  )

  useFrame(() => {
    const ports = useWorldStore.getState().ports
    if (ports.length === 0) return

    const totalDays = useGameStore.getState().gameTime.totalGameSeconds / 86400
    for (let index = 0; index < fleets.length; index += 1) {
      const fleet = fleets[index]!
      const group = fleetRefs[index]?.current
      if (!group) continue

      const snapshot = getNpcFleetSnapshot(fleet, ports, totalDays)
      if (!snapshot || snapshot.inPort || isNpcFleetSuppressed(fleet.id, totalDays)) {
        group.position.set(0, -10000, 0)
        group.scale.setScalar(0.0001)
        continue
      }

      const [x, y, z] = worldToScene(snapshot.position)
      group.position.set(x, y + 1.85, z)
      group.scale.setScalar(1)
    }
  })

  return (
    <group>
      {fleets.map((fleet, index) => (
        <group key={fleet.id} ref={fleetRefs[index]}>
          <mesh
            geometry={NPC_FLEET_HITBOX_GEOMETRY}
            material={NPC_FLEET_HITBOX_MATERIAL}
            onClick={(event) => {
              event.stopPropagation()
              const nav = useNavigationStore.getState()
              if (nav.mode === 'docked' || nav.mode === 'combat') return
              useNpcFleetStore.getState().requestAttack(fleet.id)
            }}
          />
        </group>
      ))}
    </group>
  )
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
  const flagMaterial = PORT_MARKER_MATERIALS[port.nationality] ?? PORT_MARKER_MATERIALS.default
  const haloMaterial = PORT_MARKER_HALO_MATERIALS[port.nationality] ?? PORT_MARKER_HALO_MATERIALS.default
  const haloRef = useRef<Mesh>(null)
  const { camera } = useThree()
  const sizeConfig = PORT_CITY_SIZE_CONFIG[port.size]
  const rotationY = useMemo(() => {
    let hash = 0
    for (const char of port.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
    return ((hash % 360) * Math.PI) / 180
  }, [port.id])

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
    <group position={[x, PORT_MARKER_HEIGHT, z]} scale={sizeConfig.scale}>
      <mesh
        geometry={PORT_MARKER_GEOMETRIES.hitbox}
        material={PORT_MARKER_HITBOX_MATERIAL}
        onClick={handleClick}
        position={[0, PORT_MARKER_HITBOX_Y, 0]}
        renderOrder={5}
      />
      <mesh
        geometry={PORT_MARKER_GEOMETRIES.halo}
        material={haloMaterial}
        position={[0, PORT_CITY_HALO_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={6}
      />
      <group rotation={[0, rotationY, 0]} onClick={handleClick}>
        <mesh
          geometry={PORT_MARKER_GEOMETRIES.plaza}
          material={PORT_CITY_WALL_MATERIAL}
          position={[0, PORT_CITY_BASE_Y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={7}
        />
        <mesh
          geometry={PORT_MARKER_GEOMETRIES.quay}
          material={PORT_CITY_QUAY_MATERIAL}
          position={[0, PORT_CITY_BASE_Y + 0.08, -0.72]}
          renderOrder={8}
        />
        <mesh
          geometry={PORT_MARKER_GEOMETRIES.storehouse}
          material={PORT_CITY_WALL_MATERIAL}
          position={[-0.28, PORT_CITY_BASE_Y + 0.24, -0.24]}
          renderOrder={8}
        />
        <mesh
          geometry={PORT_MARKER_GEOMETRIES.roof}
          material={PORT_CITY_ROOF_MATERIAL}
          position={[-0.28, PORT_CITY_BASE_Y + 0.55, -0.24]}
          rotation={[0, Math.PI / 4, 0]}
          renderOrder={9}
        />
        <mesh
          geometry={PORT_MARKER_GEOMETRIES.manor}
          material={PORT_CITY_WALL_MATERIAL}
          position={[0.18, PORT_CITY_BASE_Y + 0.34, 0.02]}
          renderOrder={8}
        />
        <mesh
          geometry={PORT_MARKER_GEOMETRIES.roof}
          material={PORT_CITY_ROOF_MATERIAL}
          position={[0.18, PORT_CITY_BASE_Y + 0.77, 0.02]}
          rotation={[0, Math.PI / 4, 0]}
          scale={[1.25, 1, 1.05]}
          renderOrder={9}
        />
        <mesh
          geometry={PORT_MARKER_GEOMETRIES.tower}
          material={PORT_CITY_WALL_MATERIAL}
          position={[-0.02, PORT_CITY_BASE_Y + 0.45 * sizeConfig.towerScale, 0.38]}
          scale={[sizeConfig.towerScale, sizeConfig.towerScale, sizeConfig.towerScale]}
          renderOrder={8}
        />
        <mesh
          geometry={PORT_MARKER_GEOMETRIES.towerRoof}
          material={PORT_CITY_ROOF_MATERIAL}
          position={[-0.02, PORT_CITY_BASE_Y + 0.98 * sizeConfig.towerScale, 0.38]}
          scale={[sizeConfig.towerScale, sizeConfig.towerScale, sizeConfig.towerScale]}
          renderOrder={9}
        />
        {Array.from({ length: sizeConfig.extraHouses + 2 }).map((_, index) => {
          const angle = -0.95 + index * 0.45
          const radius = index % 2 === 0 ? 0.42 : 0.56
          const houseX = Math.sin(angle) * radius
          const houseZ = Math.cos(angle) * radius
          return (
            <group key={index} position={[houseX, 0, houseZ]} rotation={[0, angle * 0.6, 0]}>
              <mesh
                geometry={PORT_MARKER_GEOMETRIES.house}
                material={PORT_CITY_WALL_MATERIAL}
                position={[0, PORT_CITY_BASE_Y + 0.28, 0]}
                renderOrder={8}
              />
              <mesh
                geometry={PORT_MARKER_GEOMETRIES.roof}
                material={PORT_CITY_ROOF_MATERIAL}
                position={[0, PORT_CITY_BASE_Y + 0.58, 0]}
                rotation={[0, Math.PI / 4, 0]}
                renderOrder={9}
              />
            </group>
          )
        })}
        <mesh
          geometry={PORT_MARKER_GEOMETRIES.flagPole}
          material={PORT_CITY_QUAY_MATERIAL}
          position={[0.42, PORT_CITY_BASE_Y + 0.88, 0.34]}
          renderOrder={10}
        />
        <mesh
          geometry={PORT_MARKER_GEOMETRIES.flag}
          material={flagMaterial}
          position={[0.58, PORT_CITY_BASE_Y + 1.06, 0.34]}
          renderOrder={10}
        />
        <mesh
          geometry={PORT_MARKER_GEOMETRIES.flag}
          material={PORT_CITY_WINDOW_MATERIAL}
          position={[0.18, PORT_CITY_BASE_Y + 0.4, -0.18]}
          scale={[0.46, 0.42, 0.28]}
          renderOrder={10}
        />
      </group>
      <mesh
        ref={haloRef}
        geometry={PORT_MARKER_GEOMETRIES.halo}
        material={haloMaterial}
        position={[0, PORT_CITY_HALO_Y + 1.05, 0]}
        renderOrder={11}
      />
    </group>
  )
}
