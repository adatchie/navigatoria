import { Suspense, createRef, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { NPC_FLEETS } from '@/data/master/npcFleets.ts'
import { getNpcFleetSnapshot } from '@/game/world/npcFleetSimulation.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNpcFleetStore } from '@/stores/useNpcFleetStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { ShipModelRenderer, ShipRenderer } from '@/rendering/ShipRenderer.tsx'
import { worldToScene } from '@/rendering/worldTransform.ts'
import { isNpcFleetSuppressed } from '@/game/world/npcFleetRegistry.ts'
import type { NpcFleetRole } from '@/types/npcFleet.ts'
import { isVoyageTimeRunning } from '@/game/timeFlow.ts'

interface NpcFleetRenderState {
  x: number
  y: number
  z: number
  heading: number
  visible: boolean
}

const POSITION_LERP = 8
const HEADING_LERP = 10
const SNAP_DISTANCE = 320

const ROLE_SCALE: Record<NpcFleetRole, number> = {
  merchant: 0.78,
  naval: 0.84,
  privateer: 0.76,
  corsair: 0.72,
  explorer: 0.74,
  smuggler: 0.7,
}

function getExactTotalDays(): number {
  return useGameStore.getState().gameTime.totalGameSeconds / 86400
}

function getAngleDelta(current: number, target: number): number {
  return ((((target - current) % 360) + 540) % 360) - 180
}

function getSceneDistance(a: NpcFleetRenderState, x: number, y: number, z: number): number {
  return Math.hypot(a.x - x, a.y - y, a.z - z)
}

export function NpcFleetRenderer() {
  const questFleets = useNpcFleetStore((s) => s.questFleets)
  const getShip = useDataStore((s) => s.getShip)
  const fleets = useMemo(() => [...NPC_FLEETS, ...Object.values(questFleets)], [questFleets])
  const fleetCount = fleets.length
  const fleetRefs = useMemo(
    () => Array.from({ length: fleetCount }, () => createRef<Group>()),
    [fleetCount],
  )
  const renderStatesRef = useRef(new Map<string, NpcFleetRenderState>())

  useFrame((state, delta) => {
    const ports = useWorldStore.getState().ports
    if (ports.length === 0) return

    const totalDays = getExactTotalDays()
    const voyageTimeRunning = isVoyageTimeRunning()
    const animationDelta = voyageTimeRunning ? delta : 0
    const elapsed = state.clock.elapsedTime
    const positionLerp = 1 - Math.exp(-POSITION_LERP * animationDelta)
    const headingLerp = 1 - Math.exp(-HEADING_LERP * animationDelta)
    const activeFleetIds = new Set<string>()

    for (let index = 0; index < fleets.length; index += 1) {
      const fleet = fleets[index]!
      const group = fleetRefs[index]?.current
      if (!group) continue

      const snapshot = getNpcFleetSnapshot(fleet, ports, totalDays)
      activeFleetIds.add(fleet.id)

      if (!snapshot || snapshot.inPort || isNpcFleetSuppressed(fleet.id, totalDays)) {
        group.position.set(0, -10000, 0)
        group.scale.setScalar(0.0001)
        const renderState = renderStatesRef.current.get(fleet.id)
        if (renderState) renderState.visible = false
        continue
      }

      const [targetX, targetY, targetZ] = worldToScene(snapshot.position)
      const targetBaseY = targetY + 0.34
      const renderState = renderStatesRef.current.get(fleet.id) ?? {
        x: targetX,
        y: targetBaseY,
        z: targetZ,
        heading: snapshot.heading,
        visible: false,
      }

      if (!renderState.visible || getSceneDistance(renderState, targetX, targetBaseY, targetZ) > SNAP_DISTANCE) {
        renderState.x = targetX
        renderState.y = targetBaseY
        renderState.z = targetZ
        renderState.heading = snapshot.heading
        renderState.visible = true
      } else {
        renderState.x += (targetX - renderState.x) * positionLerp
        renderState.y += (targetBaseY - renderState.y) * positionLerp
        renderState.z += (targetZ - renderState.z) * positionLerp
        renderState.heading = (
          renderState.heading +
          getAngleDelta(renderState.heading, snapshot.heading) * headingLerp +
          360
        ) % 360
      }

      renderStatesRef.current.set(fleet.id, renderState)

      const fleetScale = ROLE_SCALE[snapshot.definition.role] ?? 0.76
      const bobOffset = voyageTimeRunning ? Math.sin(elapsed * 0.75 + index * 0.3) * 0.08 : 0
      group.position.set(
        renderState.x,
        renderState.y + bobOffset,
        renderState.z,
      )
      group.rotation.set(0, (-renderState.heading * Math.PI) / 180, 0)
      group.scale.setScalar(fleetScale)
    }

    renderStatesRef.current.forEach((_, fleetId) => {
      if (!activeFleetIds.has(fleetId)) renderStatesRef.current.delete(fleetId)
    })
  })

  return (
    <group>
      {fleets.map((fleet, fleetIndex) => (
        <group key={fleet.id} ref={fleetRefs[fleetIndex]}>
          <Suspense fallback={<ShipRenderer heading={0} scale={1} />}>
            <ShipModelRenderer heading={0} scale={1} modelId={getShip(fleet.shipTypeId)?.modelId} animateOars />
          </Suspense>
          <Html position={[0, 4.75, 0]} center distanceFactor={42} style={styles.label}>
            <div style={styles.labelInner}>
              <strong>{fleet.commander}</strong>
              <span>{fleet.name}</span>
            </div>
          </Html>
        </group>
      ))}
    </group>
  )
}

const styles = {
  label: {
    pointerEvents: 'none',
  },
  labelInner: {
    display: 'grid',
    gap: 2,
    minWidth: 124,
    padding: '5px 7px',
    borderRadius: 8,
    background: 'rgba(2, 8, 23, 0.62)',
    border: '1px solid rgba(191, 219, 254, 0.22)',
    color: '#dbeafe',
    fontSize: 10,
    lineHeight: 1.2,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    textShadow: '0 1px 4px #000',
  },
} satisfies Record<string, CSSProperties>
