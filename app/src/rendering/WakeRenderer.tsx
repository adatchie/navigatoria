import { useMemo } from 'react'
import { Shape } from 'three'
import { NPC_FLEETS } from '@/data/master/npcFleets.ts'
import { getNearbyNpcFleetSnapshots } from '@/game/world/npcFleetSimulation.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { worldToScene } from '@/rendering/worldTransform.ts'

const PLAYER_WAKE_SPEED = 10
const NPC_WAKE_SPEED = 9.5
const NPC_WAKE_RADIUS_KM = 2600
const WAKE_Y = 0.18

interface WakeShapes {
  center: Shape
  left: Shape
  right: Shape
}

interface WakeMarkProps {
  x: number
  z: number
  heading: number
  speedRatio: number
  scale?: number
  shapes: WakeShapes
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function makeCenterWakeShape(): Shape {
  const shape = new Shape()
  shape.moveTo(-0.18, 0.7)
  shape.lineTo(0.18, 0.7)
  shape.lineTo(1.05, 11.8)
  shape.lineTo(0.56, 15.8)
  shape.lineTo(-0.56, 15.8)
  shape.lineTo(-1.05, 11.8)
  shape.closePath()
  return shape
}

function makeArmWakeShape(side: -1 | 1): Shape {
  const shape = new Shape()
  shape.moveTo(side * 0.42, 0.9)
  shape.lineTo(side * 0.72, 1.1)
  shape.lineTo(side * 5.8, 16.8)
  shape.lineTo(side * 4.3, 18.8)
  shape.lineTo(side * 0.2, 2.0)
  shape.closePath()
  return shape
}

function WakeMark({ x, z, heading, speedRatio, scale = 1, shapes }: WakeMarkProps) {
  const visibleRatio = clamp01(speedRatio)
  if (visibleRatio <= 0.04) return null

  const opacity = 0.12 + visibleRatio * 0.2
  const foamScale = 0.72 + visibleRatio * 0.55
  const lengthScale = 0.56 + visibleRatio * 0.92

  return (
    <group
      position={[x, WAKE_Y, z]}
      rotation={[0, (-heading * Math.PI) / 180, 0]}
      scale={[scale * foamScale, 1, scale * lengthScale]}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={8}>
        <shapeGeometry args={[shapes.center]} />
        <meshBasicMaterial color="#ecfeff" transparent opacity={opacity * 0.82} depthWrite={false} depthTest={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={8}>
        <shapeGeometry args={[shapes.left]} />
        <meshBasicMaterial color="#f8fafc" transparent opacity={opacity * 0.58} depthWrite={false} depthTest={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={8}>
        <shapeGeometry args={[shapes.right]} />
        <meshBasicMaterial color="#f8fafc" transparent opacity={opacity * 0.58} depthWrite={false} depthTest={false} />
      </mesh>
    </group>
  )
}

export function WakeRenderer() {
  const ports = useWorldStore((s) => s.ports)
  const currentSpeed = useNavigationStore((s) => s.currentSpeed)
  const heading = useNavigationStore((s) => s.heading)
  const mode = useNavigationStore((s) => s.mode)
  const position = useNavigationStore((s) => s.position)
  const totalDays = useGameStore((s) => s.gameTime.totalGameSeconds / 86400)
  const shapes = useMemo<WakeShapes>(
    () => ({
      center: makeCenterWakeShape(),
      left: makeArmWakeShape(-1),
      right: makeArmWakeShape(1),
    }),
    [],
  )

  const [playerX, , playerZ] = worldToScene(position)
  const playerSpeedRatio = mode === 'sailing' ? clamp01(currentSpeed / PLAYER_WAKE_SPEED) : 0
  const npcSnapshots = ports.length > 0
    ? getNearbyNpcFleetSnapshots(NPC_FLEETS, ports, totalDays, position, NPC_WAKE_RADIUS_KM)
    : []

  return (
    <group>
      <WakeMark x={playerX} z={playerZ} heading={heading} speedRatio={playerSpeedRatio} scale={1.05} shapes={shapes} />
      {npcSnapshots.map((snapshot) => {
        if (snapshot.inPort) return null
        const [x, , z] = worldToScene(snapshot.position)
        const speedRatio = clamp01(snapshot.definition.speedKnots / NPC_WAKE_SPEED)
        return (
          <WakeMark
            key={snapshot.definition.id}
            x={x}
            z={z}
            heading={snapshot.heading}
            speedRatio={speedRatio}
            scale={0.68}
            shapes={shapes}
          />
        )
      })}
    </group>
  )
}
