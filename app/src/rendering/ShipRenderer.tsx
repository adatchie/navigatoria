// ============================================================
// ShipRenderer [STUB] — プレースホルダー船 + GLBロード準備
// ============================================================

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  type BufferGeometry,
  type Group,
  type Material,
} from 'three'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { isPointOnLand, snapPointToNearestSea } from '@/data/master/landmasses.ts'
import { SCENE_WORLD_SCALE, worldToScene } from '@/rendering/worldTransform.ts'

interface ShipRendererProps {
  position?: [number, number, number]
  heading?: number
  scale?: number
  modelId?: string
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
}

const sharedMaterials = {
  hull: new MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 }),
  cabin: new MeshStandardMaterial({ color: 0x6b3410, roughness: 0.8 }),
  mast: new MeshStandardMaterial({ color: 0x4a3728 }),
  sail: new MeshStandardMaterial({ color: 0xf5e6c8, side: DoubleSide, roughness: 0.9 }),
  flag: new MeshStandardMaterial({ color: 0xcc2222, side: DoubleSide }),
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
const FOLLOW_POSITION_LERP = 1.8
const FOLLOW_HEADING_LERP = 2.4
const FOLLOW_LAND_CLEARANCE = 0.35

interface FleetRenderState {
  x: number
  y: number
  heading: number
}

function getShipScale(category?: string): number {
  if (category === 'small_sail') return 0.9
  if (category === 'medium_sail') return 1.15
  if (category === 'large_sail') return 1.45
  if (category === 'galley') return 1.1
  return 1.2
}

function getAngleDelta(current: number, target: number): number {
  return ((((target - current) % 360) + 540) % 360) - 180
}

function getFormationTarget(
  flagship: { x: number; y: number },
  heading: number,
  index: number,
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

  return {
    x: flagship.x - forwardX * backOffset + rightX * sideOffset,
    y: flagship.y - forwardY * backOffset + rightY * sideOffset,
  }
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

export function FleetShipRenderer() {
  const meshRefs = useRef<(InstancedMesh | null)[]>([])
  const shipObject = useRef(new Object3D())
  const motionObject = useRef(new Object3D())
  const partObject = useRef(new Object3D())
  const combinedMatrix = useRef(new Matrix4())
  const shipMotionMatrix = useRef(new Matrix4())
  const hiddenObject = useRef(new Object3D())
  const renderStatesRef = useRef(new Map<string, FleetRenderState>())

  useFrame((state, delta) => {
    const nav = useNavigationStore.getState()
    const player = usePlayerStore.getState()
    const getShip = useDataStore.getState().getShip
    const active = player.ships.find((ship) => ship.instanceId === player.activeShipId)
    const followers = player.ships.filter((ship) => ship.instanceId !== player.activeShipId)
    const fleetShips = (active ? [active, ...followers] : followers).slice(0, MAX_RENDERED_FLEET_SHIPS)
    const positionLerp = 1 - Math.exp(-FOLLOW_POSITION_LERP * delta)
    const headingLerp = 1 - Math.exp(-FOLLOW_HEADING_LERP * delta)
    const time = state.clock.elapsedTime
    const activeIds = new Set(fleetShips.map((ship) => ship.instanceId))

    renderStatesRef.current.forEach((_, shipId) => {
      if (!activeIds.has(shipId)) renderStatesRef.current.delete(shipId)
    })

    hiddenObject.current.position.set(0, -10000, 0)
    hiddenObject.current.scale.setScalar(0.0001)
    hiddenObject.current.updateMatrix()

    fleetShips.forEach((ship, index) => {
      const isFlagship = ship.instanceId === player.activeShipId
      const type = getShip(ship.typeId)
      const scale = getShipScale(type?.category) * (isFlagship ? 1 : 0.82)
      const target = getFormationTarget(nav.position, nav.heading, index)
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
        const next = {
          x: stateForShip.x + (target.x - stateForShip.x) * positionLerp,
          y: stateForShip.y + (target.y - stateForShip.y) * positionLerp,
        }
        const resolved = resolveFollowerSeaPosition(stateForShip, next, target)
        stateForShip.x = resolved.x
        stateForShip.y = resolved.y
        stateForShip.heading = (stateForShip.heading + getAngleDelta(stateForShip.heading, nav.heading) * headingLerp + 360) % 360
      }

      renderStatesRef.current.set(ship.instanceId, stateForShip)

      const [shipX, shipY, shipZ] = worldToScene({ x: stateForShip.x, y: stateForShip.y })
      const headingRad = (-stateForShip.heading * Math.PI) / 180

      shipObject.current.position.set(
        shipX,
        shipY + 0.5,
        shipZ,
      )
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
