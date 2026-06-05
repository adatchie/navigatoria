// ============================================================
// ShipRenderer [STUB] — プレースホルダー船 + GLBロード準備
// ============================================================

import { createRef, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Clone, useGLTF } from '@react-three/drei'
import {
  BoxGeometry,
  Box3,
  CylinderGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Vector3,
  type BufferGeometry,
  type Group,
  type Material,
} from 'three'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { isPointOnLand, snapPointToNearestSea } from '@/data/master/landmasses.ts'
import { getEffectiveGameSpeed, TIME_CONFIG, WORLD_DISTANCE_SCALE } from '@/config/gameConfig.ts'
import { SCENE_WORLD_SCALE, worldToScene } from '@/rendering/worldTransform.ts'
import { isVoyageTimeRunning } from '@/game/timeFlow.ts'

interface ShipRendererProps {
  position?: [number, number, number]
  heading?: number
  scale?: number
  modelId?: string
  animateOars?: boolean
}

interface ShipPartDefinition {
  geometry: BufferGeometry
  material: Material
  position: [number, number, number]
  rotation?: [number, number, number]
}

const sharedGeometries = {
  hull: new BoxGeometry(1.2, 0.6, 4),
  bow: new BoxGeometry(0.8, 0.4, 1),
  cabin: new BoxGeometry(1.0, 0.8, 1.2),
  mast: new CylinderGeometry(0.04, 0.06, 4, 8),
  foreMast: new CylinderGeometry(0.03, 0.05, 3, 8),
  mainSail: new PlaneGeometry(2, 2.5),
  foreSail: new PlaneGeometry(1.5, 1.8),
  flag: new PlaneGeometry(0.6, 0.3),
  oarShaft: new CylinderGeometry(0.018, 0.018, 1, 6),
  oarBlade: new BoxGeometry(0.28, 0.045, 0.32),
}

const sharedMaterials = {
  hull: new MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 }),
  cabin: new MeshStandardMaterial({ color: 0x6b3410, roughness: 0.8 }),
  mast: new MeshStandardMaterial({ color: 0x4a3728 }),
  sail: new MeshStandardMaterial({ color: 0xf5e6c8, side: DoubleSide, roughness: 0.9 }),
  flag: new MeshStandardMaterial({ color: 0xcc2222, side: DoubleSide }),
  oar: new MeshStandardMaterial({ color: 0x5d3b20, roughness: 0.76 }),
}

const shipParts: ShipPartDefinition[] = [
  {
    geometry: sharedGeometries.hull,
    material: sharedMaterials.hull,
    position: [0, 0.3, 0],
  },
  {
    geometry: sharedGeometries.bow,
    material: sharedMaterials.hull,
    position: [0, 0.4, 2.3],
    rotation: [0.3, 0, 0],
  },
  {
    geometry: sharedGeometries.cabin,
    material: sharedMaterials.cabin,
    position: [0, 0.8, -1.5],
  },
  {
    geometry: sharedGeometries.mast,
    material: sharedMaterials.mast,
    position: [0, 2.5, 0.3],
  },
  {
    geometry: sharedGeometries.mainSail,
    material: sharedMaterials.sail,
    position: [0, 3, 0.3],
  },
  {
    geometry: sharedGeometries.foreMast,
    material: sharedMaterials.mast,
    position: [0, 2, 1.5],
  },
  {
    geometry: sharedGeometries.foreSail,
    material: sharedMaterials.sail,
    position: [0, 2.5, 1.5],
  },
  {
    geometry: sharedGeometries.flag,
    material: sharedMaterials.flag,
    position: [0, 4.6, 0.3],
  },
]

const MAX_RENDERED_FLEET_SHIPS = 5
const FOLLOW_HEADING_LERP = 2.4
const FOLLOW_SPEED_FACTOR = 1.18
const FOLLOW_LAND_CLEARANCE = 0.35
const FORMATION_DEPLOY_DISTANCE_KM = 24
const DEFAULT_SHIP_MODEL_ID = 'player-ship-lite'
const SHIP_MODEL_URLS: Record<string, string> = {
  [DEFAULT_SHIP_MODEL_ID]: `${import.meta.env.BASE_URL}models/player-ship-lite.glb`,
  galley: `${import.meta.env.BASE_URL}models/ships/galley.glb`,
  cog: `${import.meta.env.BASE_URL}models/ships/cog.glb`,
  barsha: `${import.meta.env.BASE_URL}models/ships/barsha.glb`,
  caravel: `${import.meta.env.BASE_URL}models/ships/caravel.glb`,
  carrack: `${import.meta.env.BASE_URL}models/ships/carrack.glb`,
  galleon: `${import.meta.env.BASE_URL}models/ships/galleon.glb`,
  heavy_galleon: `${import.meta.env.BASE_URL}models/ships/heavy_galleon.glb`,
  treasure_galleon: `${import.meta.env.BASE_URL}models/ships/treasure_galleon.glb`,
  galleass: `${import.meta.env.BASE_URL}models/ships/galleass.glb`,
  galeazza: `${import.meta.env.BASE_URL}models/ships/galeazza.glb`,
  xebec: `${import.meta.env.BASE_URL}models/ships/xebec.glb`,
  dhow: `${import.meta.env.BASE_URL}models/ships/dhow.glb?v=20260605-dhow-source-fix`,
  sambuk: `${import.meta.env.BASE_URL}models/ships/sambuk.glb`,
  schooner: `${import.meta.env.BASE_URL}models/ships/schooner.glb`,
  pinnace: `${import.meta.env.BASE_URL}models/ships/pinnace.glb`,
  barca: `${import.meta.env.BASE_URL}models/ships/barsha.glb`,
  balca: `${import.meta.env.BASE_URL}models/ships/barsha.glb`,
}
const SHIP_MODEL_SIZE_SCALE: Record<string, number> = {
  [DEFAULT_SHIP_MODEL_ID]: 1,
  barsha: 0.62,
  barca: 0.62,
  balca: 0.62,
  caravel: 0.82,
  cog: 0.82,
  carrack: 1.34,
  galleon: 1.55,
  heavy_galleon: 1.62,
  treasure_galleon: 1.62,
  galleass: 1.55,
  galeazza: 1.55,
  xebec: 1,
  dhow: 0.72,
  sambuk: 0.78,
  schooner: 1.55,
  pinnace: 1.08,
}
const SHIP_MODEL_HEADING_OFFSET: Record<string, number> = {
  barsha: Math.PI,
  barca: Math.PI,
  balca: Math.PI,
  caravel: Math.PI,
  cog: Math.PI,
  carrack: Math.PI,
  galleon: Math.PI,
  heavy_galleon: Math.PI,
  treasure_galleon: Math.PI,
  galleass: Math.PI,
  galeazza: Math.PI,
  xebec: Math.PI,
  dhow: Math.PI,
  sambuk: Math.PI,
  schooner: Math.PI,
  galley: Math.PI,
  pinnace: Math.PI,
}
const TARGET_MODEL_LENGTH = 5.2

interface FleetRenderState {
  x: number
  y: number
  heading: number
}

interface FleetNavigationSnapshot {
  mode: string
  dockedPortId: string | null
  lastDeparturePortId: string | null
}

interface NormalizedModelLayout {
  scale: number
  offset: [number, number, number]
  rotationY: number
}

interface RowingOarLayout {
  rows: number
  beam: number
  oarLength: number
  zMin: number
  zMax: number
  y: number
  strokeAmplitude: number
  liftAmplitude: number
  restDip: number
  speed: number
}

const ROWING_OAR_LAYOUTS: Record<string, RowingOarLayout> = {
  galley: {
    rows: 9,
    beam: 0.72,
    oarLength: 1.55,
    zMin: -1.85,
    zMax: 1.7,
    y: 0.48,
    strokeAmplitude: 0.34,
    liftAmplitude: 0.08,
    restDip: 0.08,
    speed: 4.2,
  },
  galleass: {
    rows: 12,
    beam: 1.04,
    oarLength: 2.05,
    zMin: -2.75,
    zMax: 2.55,
    y: 0.62,
    strokeAmplitude: 0.3,
    liftAmplitude: 0.07,
    restDip: 0.07,
    speed: 3.6,
  },
  galeazza: {
    rows: 13,
    beam: 1.08,
    oarLength: 2.1,
    zMin: -2.85,
    zMax: 2.65,
    y: 0.62,
    strokeAmplitude: 0.3,
    liftAmplitude: 0.07,
    restDip: 0.07,
    speed: 3.55,
  },
}

function getShipScale(category?: string): number {
  if (category === 'small_sail') return 0.9
  if (category === 'medium_sail') return 1.15
  if (category === 'large_sail') return 1.45
  if (category === 'galley') return 1.1
  return 1.2
}

function resolveShipModelId(modelId?: string): string {
  if (modelId && SHIP_MODEL_URLS[modelId]) return modelId
  return DEFAULT_SHIP_MODEL_ID
}

function resolveShipModelUrl(modelId?: string): string {
  return SHIP_MODEL_URLS[resolveShipModelId(modelId)]
}

function resolveShipModelSizeScale(modelId?: string): number {
  return SHIP_MODEL_SIZE_SCALE[resolveShipModelId(modelId)] ?? 1
}

function resolveShipModelHeadingOffset(modelId?: string): number {
  return SHIP_MODEL_HEADING_OFFSET[resolveShipModelId(modelId)] ?? 0
}

function resolveRowingOarLayout(modelId?: string): RowingOarLayout | null {
  return ROWING_OAR_LAYOUTS[resolveShipModelId(modelId)] ?? null
}

function getFleetModelScale(category?: string, modelId?: string): number {
  if (modelId && SHIP_MODEL_URLS[modelId]) return 1
  return getShipScale(category)
}

function useNormalizedModelLayout(scene: Group, sizeScale: number, headingOffset: number): NormalizedModelLayout {
  return useMemo<NormalizedModelLayout>(() => {
    const boundsBox = new Box3().setFromObject(scene)
    const boundsSize = boundsBox.getSize(new Vector3())
    const boundsCenter = boundsBox.getCenter(new Vector3())
    const dominantLength = Math.max(boundsSize.x, boundsSize.z, 0.0001)
    const modelScale = (TARGET_MODEL_LENGTH * sizeScale) / dominantLength
    const rotationY = (boundsSize.x > boundsSize.z ? Math.PI / 2 : 0) + Math.PI + headingOffset

    return {
      scale: modelScale,
      offset: [
        -boundsCenter.x * modelScale,
        -boundsBox.min.y * modelScale,
        -boundsCenter.z * modelScale,
      ],
      rotationY,
    }
  }, [headingOffset, scene, sizeScale])
}

function AnimatedRowingOars({ modelId, active }: { modelId?: string, active: boolean }) {
  const layout = resolveRowingOarLayout(modelId)
  const oarRefs = useRef<(Group | null)[]>([])
  const oars = useMemo(() => {
    if (!layout) return []
    const zStep = layout.rows > 1 ? (layout.zMax - layout.zMin) / (layout.rows - 1) : 0
    return Array.from({ length: layout.rows }).flatMap((_, row) => {
      const z = layout.zMin + zStep * row
      return [
        { key: `${row}-starboard`, row, side: 1, z },
        { key: `${row}-port`, row, side: -1, z },
      ]
    })
  }, [layout])

  useFrame((state) => {
    if (!layout) return
    const strokeEnabled = active && isVoyageTimeRunning()
    oarRefs.current.forEach((oar, index) => {
      if (!oar) return
      const row = Math.floor(index / 2)
      const side = index % 2 === 0 ? 1 : -1
      const phase = state.clock.elapsedTime * layout.speed + row * 0.28
      const stroke = strokeEnabled ? Math.sin(phase) * layout.strokeAmplitude : 0
      const lift = strokeEnabled ? Math.max(0, Math.cos(phase)) * layout.liftAmplitude : 0
      oar.rotation.y = side * stroke
      oar.rotation.z = -side * (layout.restDip + lift)
    })
  })

  if (!layout || !active || oars.length === 0) return null

  return (
    <group>
      {oars.map((oar, index) => (
        <group
          key={oar.key}
          ref={(ref) => {
            oarRefs.current[index] = ref
          }}
          position={[oar.side * layout.beam, layout.y, oar.z]}
        >
          <mesh
            geometry={sharedGeometries.oarShaft}
            material={sharedMaterials.oar}
            position={[oar.side * (layout.oarLength / 2), 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            scale={[1, layout.oarLength, 1]}
          />
          <mesh
            geometry={sharedGeometries.oarBlade}
            material={sharedMaterials.oar}
            position={[oar.side * layout.oarLength, 0, 0]}
          />
        </group>
      ))}
    </group>
  )
}

function ShipModelClone({ modelId }: { modelId?: string }) {
  const { scene } = useGLTF(resolveShipModelUrl(modelId), false, true)
  const navigationMode = useNavigationStore((s) => s.mode)
  const modelLayout = useNormalizedModelLayout(
    scene,
    resolveShipModelSizeScale(modelId),
    resolveShipModelHeadingOffset(modelId),
  )
  const rowingActive = navigationMode === 'sailing'

  return (
    <group>
      <group
        position={modelLayout.offset}
        rotation={[0, modelLayout.rotationY, 0]}
        scale={modelLayout.scale}
      >
        <Clone object={scene} />
      </group>
      <AnimatedRowingOars modelId={modelId} active={rowingActive} />
    </group>
  )
}

function getAngleDelta(current: number, target: number): number {
  return ((((target - current) % 360) + 540) % 360) - 180
}

function getFormationTarget(
  flagship: { x: number; y: number },
  heading: number,
  index: number,
  deployProgress = 1,
): { x: number; y: number } {
  if (index === 0) return flagship

  const headingRad = (heading * Math.PI) / 180
  const row = Math.floor((index + 1) / 2)
  const side = index % 2 === 0 ? 1 : -1
  const backOffset = (5.5 + row * 4.5) / SCENE_WORLD_SCALE
  const sideOffset = (side * 3.2) / SCENE_WORLD_SCALE
  const forwardX = Math.sin(headingRad)
  const forwardY = Math.cos(headingRad)
  const rightX = Math.cos(headingRad)
  const rightY = -Math.sin(headingRad)

  const deployedTarget = {
    x: flagship.x - forwardX * backOffset + rightX * sideOffset,
    y: flagship.y - forwardY * backOffset + rightY * sideOffset,
  }

  const progress = Math.max(0, Math.min(1, deployProgress))
  return {
    x: flagship.x + (deployedTarget.x - flagship.x) * progress,
    y: flagship.y + (deployedTarget.y - flagship.y) * progress,
  }
}

function getFormationDeployProgress(mode: string, distanceTraveled: number): number {
  if (mode === 'docked') return 0
  if (mode !== 'sailing' && mode !== 'anchored') return 1
  return Math.max(0, Math.min(1, distanceTraveled / FORMATION_DEPLOY_DISTANCE_KM))
}

function getFleetNavigationSnapshot(nav: ReturnType<typeof useNavigationStore.getState>): FleetNavigationSnapshot {
  return {
    mode: nav.mode,
    dockedPortId: nav.dockedPortId,
    lastDeparturePortId: nav.lastDeparturePortId,
  }
}

function shouldResetFleetAtFlagship(
  previous: FleetNavigationSnapshot | null,
  current: FleetNavigationSnapshot,
  distanceTraveled: number,
): boolean {
  if (current.mode === 'docked') return true
  if (current.mode !== 'sailing') return false
  if (distanceTraveled > 0.001) return false
  return previous?.mode !== 'sailing' || previous.lastDeparturePortId !== current.lastDeparturePortId
}

function resetFleetRenderStatesAtFlagship(
  renderStates: Map<string, FleetRenderState>,
  ships: { instanceId: string }[],
  flagship: { x: number; y: number },
  heading: number,
): void {
  renderStates.clear()
  ships.forEach((ship) => {
    renderStates.set(ship.instanceId, {
      x: flagship.x,
      y: flagship.y,
      heading,
    })
  })
}

function resolveFollowerSeaPosition(
  current: FleetRenderState,
  next: { x: number; y: number },
  target: { x: number; y: number },
): { x: number; y: number } {
  if (!isPointOnLand([next.x, next.y])) return next

  const slideCandidates = [
    { x: next.x, y: current.y },
    { x: current.x, y: next.y },
  ].filter((candidate) => !isPointOnLand([candidate.x, candidate.y]))

  if (slideCandidates.length > 0) {
    return slideCandidates.reduce((best, candidate) => {
      const bestDistance = Math.hypot(best.x - target.x, best.y - target.y)
      const candidateDistance = Math.hypot(candidate.x - target.x, candidate.y - target.y)
      return candidateDistance < bestDistance ? candidate : best
    })
  }

  const [seaX, seaY] = snapPointToNearestSea([next.x, next.y], FOLLOW_LAND_CLEARANCE)
  return { x: seaX, y: seaY }
}

function getFollowerMaxStep(nav: ReturnType<typeof useNavigationStore.getState>, delta: number): number {
  if (nav.mode !== 'sailing' && nav.mode !== 'anchored') return 0
  const gameSpeed = useGameStore.getState().speed
  const hoursPerRealSecond = (24 / TIME_CONFIG.REAL_SECONDS_PER_GAME_DAY) * getEffectiveGameSpeed(gameSpeed)
  const stepKm = Math.max(0, nav.currentSpeed) * FOLLOW_SPEED_FACTOR * 1.852 * hoursPerRealSecond * delta
  return stepKm / WORLD_DISTANCE_SCALE
}

function moveTowardWithMaxStep(
  current: FleetRenderState,
  target: { x: number; y: number },
  maxStep: number,
): { x: number; y: number } {
  const dx = target.x - current.x
  const dy = target.y - current.y
  const distanceToTarget = Math.hypot(dx, dy)
  if (distanceToTarget <= 0.0001 || distanceToTarget <= maxStep) return target
  const ratio = maxStep / distanceToTarget
  return {
    x: current.x + dx * ratio,
    y: current.y + dy * ratio,
  }
}

function advanceFollowerFormationState(
  stateForShip: FleetRenderState,
  target: { x: number; y: number },
  navHeading: number,
  maxStep: number,
  headingLerp: number,
): void {
  const next = moveTowardWithMaxStep(stateForShip, target, maxStep)
  const resolved = resolveFollowerSeaPosition(stateForShip, next, target)
  stateForShip.x = resolved.x
  stateForShip.y = resolved.y
  stateForShip.heading = (stateForShip.heading + getAngleDelta(stateForShip.heading, navHeading) * headingLerp + 360) % 360
}

export function FleetShipRenderer() {
  const playerShips = usePlayerStore((s) => s.ships)
  const activeShipId = usePlayerStore((s) => s.activeShipId)
  const getShip = useDataStore((s) => s.getShip)
  const shipRefs = useMemo(
    () => Array.from({ length: MAX_RENDERED_FLEET_SHIPS }, () => createRef<Group>()),
    [],
  )
  const motionRefs = useMemo(
    () => Array.from({ length: MAX_RENDERED_FLEET_SHIPS }, () => createRef<Group>()),
    [],
  )
  const hiddenObject = useRef(new Object3D())
  const renderStatesRef = useRef(new Map<string, FleetRenderState>())
  const navigationSnapshotRef = useRef<FleetNavigationSnapshot | null>(null)
  const fleetModelIds = useMemo(() => {
    const active = playerShips.find((ship) => ship.instanceId === activeShipId)
    const followers = playerShips.filter((ship) => ship.instanceId !== activeShipId)
    const fleetShips = (active ? [active, ...followers] : followers).slice(0, MAX_RENDERED_FLEET_SHIPS)
    return fleetShips.map((ship) => getShip(ship.typeId)?.modelId)
  }, [activeShipId, getShip, playerShips])

  useFrame((state, delta) => {
    const nav = useNavigationStore.getState()
    const player = usePlayerStore.getState()
    const getShip = useDataStore.getState().getShip
    const active = player.ships.find((ship) => ship.instanceId === player.activeShipId)
    const followers = player.ships.filter((ship) => ship.instanceId !== player.activeShipId)
    const fleetShips = (active ? [active, ...followers] : followers).slice(0, MAX_RENDERED_FLEET_SHIPS)
    const headingLerp = 1 - Math.exp(-FOLLOW_HEADING_LERP * delta)
    const time = state.clock.elapsedTime
    const activeIds = new Set(fleetShips.map((ship) => ship.instanceId))
    const currentNavigationSnapshot = getFleetNavigationSnapshot(nav)
    const followerMaxStep = getFollowerMaxStep(nav, delta)

    if (shouldResetFleetAtFlagship(navigationSnapshotRef.current, currentNavigationSnapshot, nav.distanceTraveled)) {
      resetFleetRenderStatesAtFlagship(renderStatesRef.current, fleetShips, nav.position, nav.heading)
    }
    navigationSnapshotRef.current = currentNavigationSnapshot

    renderStatesRef.current.forEach((_, shipId) => {
      if (!activeIds.has(shipId)) renderStatesRef.current.delete(shipId)
    })

    hiddenObject.current.position.set(0, -10000, 0)
    hiddenObject.current.scale.setScalar(0.0001)
    hiddenObject.current.updateMatrix()

    const deployProgress = getFormationDeployProgress(nav.mode, nav.distanceTraveled)
    fleetShips.forEach((ship, index) => {
      const isFlagship = ship.instanceId === player.activeShipId
      const type = getShip(ship.typeId)
      const scale = getFleetModelScale(type?.category, type?.modelId) * (isFlagship ? 1 : 0.82)
      const target = getFormationTarget(nav.position, nav.heading, index, deployProgress)
      const stateForShip = renderStatesRef.current.get(ship.instanceId) ?? {
        x: target.x,
        y: target.y,
        heading: nav.heading,
      }

      if (isFlagship) {
        stateForShip.x = nav.position.x
        stateForShip.y = nav.position.y
        stateForShip.heading = nav.heading
      } else {
        advanceFollowerFormationState(stateForShip, target, nav.heading, followerMaxStep, headingLerp)
      }

      renderStatesRef.current.set(ship.instanceId, stateForShip)

      const [shipX, shipY, shipZ] = worldToScene({ x: stateForShip.x, y: stateForShip.y })
      const headingRad = (-stateForShip.heading * Math.PI) / 180
      const shipGroup = shipRefs[index]?.current
      const motionGroup = motionRefs[index]?.current

      if (shipGroup) {
        shipGroup.position.set(shipX, shipY + 0.5, shipZ)
        shipGroup.rotation.set(0, headingRad, 0)
        shipGroup.scale.setScalar(scale)
      }

      if (motionGroup) {
        motionGroup.position.set(0, Math.sin(time * 0.7 + index * 0.35) * 0.15, 0)
        motionGroup.rotation.set(
          Math.sin(time * 0.8 + index * 0.3) * 0.03,
          0,
          Math.sin(time * 0.6 + 1 + index * 0.2) * 0.05,
        )
      }
    })

    for (let index = fleetShips.length; index < MAX_RENDERED_FLEET_SHIPS; index += 1) {
      shipRefs[index]?.current?.position.set(0, -10000, 0)
      shipRefs[index]?.current?.scale.setScalar(0.0001)
    }
  })

  return (
    <group>
      {Array.from({ length: MAX_RENDERED_FLEET_SHIPS }).map((_, index) => (
        <group
          key={index}
          ref={shipRefs[index]}
        >
          <group ref={motionRefs[index]}>
            <ShipModelClone modelId={fleetModelIds[index]} />
          </group>
        </group>
      ))}
    </group>
  )
}

export function FleetPlaceholderRenderer() {
  const meshRefs = useRef<(InstancedMesh | null)[]>([])
  const shipObject = useRef(new Object3D())
  const motionObject = useRef(new Object3D())
  const partObject = useRef(new Object3D())
  const combinedMatrix = useRef(new Matrix4())
  const shipMotionMatrix = useRef(new Matrix4())
  const hiddenObject = useRef(new Object3D())
  const renderStatesRef = useRef(new Map<string, FleetRenderState>())
  const navigationSnapshotRef = useRef<FleetNavigationSnapshot | null>(null)

  useFrame((state, delta) => {
    const nav = useNavigationStore.getState()
    const player = usePlayerStore.getState()
    const getShip = useDataStore.getState().getShip
    const active = player.ships.find((ship) => ship.instanceId === player.activeShipId)
    const followers = player.ships.filter((ship) => ship.instanceId !== player.activeShipId)
    const fleetShips = (active ? [active, ...followers] : followers).slice(0, MAX_RENDERED_FLEET_SHIPS)
    const headingLerp = 1 - Math.exp(-FOLLOW_HEADING_LERP * delta)
    const time = state.clock.elapsedTime
    const activeIds = new Set(fleetShips.map((ship) => ship.instanceId))
    const currentNavigationSnapshot = getFleetNavigationSnapshot(nav)
    const followerMaxStep = getFollowerMaxStep(nav, delta)

    if (shouldResetFleetAtFlagship(navigationSnapshotRef.current, currentNavigationSnapshot, nav.distanceTraveled)) {
      resetFleetRenderStatesAtFlagship(renderStatesRef.current, fleetShips, nav.position, nav.heading)
    }
    navigationSnapshotRef.current = currentNavigationSnapshot

    renderStatesRef.current.forEach((_, shipId) => {
      if (!activeIds.has(shipId)) renderStatesRef.current.delete(shipId)
    })

    hiddenObject.current.position.set(0, -10000, 0)
    hiddenObject.current.scale.setScalar(0.0001)
    hiddenObject.current.updateMatrix()

    const deployProgress = getFormationDeployProgress(nav.mode, nav.distanceTraveled)
    fleetShips.forEach((ship, index) => {
      const isFlagship = ship.instanceId === player.activeShipId
      const type = getShip(ship.typeId)
      const scale = getShipScale(type?.category) * (isFlagship ? 1 : 0.82)
      const target = getFormationTarget(nav.position, nav.heading, index, deployProgress)
      const stateForShip = renderStatesRef.current.get(ship.instanceId) ?? {
        x: target.x,
        y: target.y,
        heading: nav.heading,
      }

      if (isFlagship) {
        stateForShip.x = nav.position.x
        stateForShip.y = nav.position.y
        stateForShip.heading = nav.heading
      } else {
        advanceFollowerFormationState(stateForShip, target, nav.heading, followerMaxStep, headingLerp)
      }

      renderStatesRef.current.set(ship.instanceId, stateForShip)

      const [shipX, shipY, shipZ] = worldToScene({ x: stateForShip.x, y: stateForShip.y })
      const headingRad = (-stateForShip.heading * Math.PI) / 180

      shipObject.current.position.set(shipX, shipY + 0.5, shipZ)
      shipObject.current.rotation.set(0, headingRad, 0)
      shipObject.current.scale.setScalar(scale)
      shipObject.current.updateMatrix()

      motionObject.current.position.set(0, Math.sin(time * 0.7 + index * 0.35) * 0.15, 0)
      motionObject.current.rotation.set(
        Math.sin(time * 0.8 + index * 0.3) * 0.03,
        0,
        Math.sin(time * 0.6 + 1 + index * 0.2) * 0.05,
      )
      motionObject.current.scale.setScalar(1)
      motionObject.current.updateMatrix()

      shipMotionMatrix.current.multiplyMatrices(shipObject.current.matrix, motionObject.current.matrix)

      shipParts.forEach((part, partIndex) => {
        const mesh = meshRefs.current[partIndex]
        if (!mesh) return
        partObject.current.position.set(...part.position)
        partObject.current.rotation.set(...(part.rotation ?? [0, 0, 0]))
        partObject.current.scale.setScalar(1)
        partObject.current.updateMatrix()
        combinedMatrix.current.multiplyMatrices(shipMotionMatrix.current, partObject.current.matrix)
        mesh.setMatrixAt(index, combinedMatrix.current)
      })
    })

    for (let index = fleetShips.length; index < MAX_RENDERED_FLEET_SHIPS; index += 1) {
      shipParts.forEach((_, partIndex) => {
        meshRefs.current[partIndex]?.setMatrixAt(index, hiddenObject.current.matrix)
      })
    }

    meshRefs.current.forEach((mesh) => {
      if (mesh) mesh.instanceMatrix.needsUpdate = true
    })
  })

  return (
    <group>
      {shipParts.map((part, index) => (
        <instancedMesh
          key={index}
          ref={(mesh) => { meshRefs.current[index] = mesh }}
          args={[part.geometry, part.material, MAX_RENDERED_FLEET_SHIPS]}
        />
      ))}
    </group>
  )
}

export function ShipRenderer({
  position = [0, 0.5, 0],
  heading = 0,
  scale = 1,
}: ShipRendererProps) {
  const motionGroupRef = useRef<Group>(null)

  useFrame((state) => {
    if (!motionGroupRef.current) return
    const time = state.clock.elapsedTime
    motionGroupRef.current.rotation.x = Math.sin(time * 0.8) * 0.03
    motionGroupRef.current.rotation.z = Math.sin(time * 0.6 + 1) * 0.05
    motionGroupRef.current.position.y = Math.sin(time * 0.7) * 0.15
  })

  const headingRad = (-heading * Math.PI) / 180

  return (
    <group position={position} rotation={[0, headingRad, 0]} scale={scale}>
      <group ref={motionGroupRef}>
        {shipParts.map((part, index) => (
          <mesh
            key={index}
            geometry={part.geometry}
            material={part.material}
            position={part.position}
            rotation={part.rotation}
          />
        ))}
      </group>
    </group>
  )
}

export function ShipModelRenderer({
  position = [0, 0.5, 0],
  heading = 0,
  scale = 1,
  modelId,
  animateOars = false,
}: ShipRendererProps) {
  const { scene } = useGLTF(resolveShipModelUrl(modelId), false, true)
  const motionGroupRef = useRef<Group>(null)
  const modelLayout = useNormalizedModelLayout(
    scene,
    resolveShipModelSizeScale(modelId),
    resolveShipModelHeadingOffset(modelId),
  )

  useFrame((state) => {
    if (!motionGroupRef.current) return
    const time = state.clock.elapsedTime
    motionGroupRef.current.rotation.x = Math.sin(time * 0.8) * 0.025
    motionGroupRef.current.rotation.z = Math.sin(time * 0.6 + 1) * 0.04
    motionGroupRef.current.position.y = Math.sin(time * 0.7) * 0.1
  })

  const headingRad = (-heading * Math.PI) / 180

  return (
    <group position={position} rotation={[0, headingRad, 0]} scale={scale}>
      <group ref={motionGroupRef}>
        <group
          position={modelLayout.offset}
          rotation={[0, modelLayout.rotationY, 0]}
          scale={modelLayout.scale}
        >
          <Clone object={scene} />
        </group>
        <AnimatedRowingOars modelId={modelId} active={animateOars} />
      </group>
    </group>
  )
}

Array.from(new Set(Object.values(SHIP_MODEL_URLS))).forEach((modelUrl) => {
  useGLTF.preload(modelUrl, false, true)
})
