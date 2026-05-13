import { useMemo } from 'react'
import { CanvasTexture, ClampToEdgeWrapping, LinearFilter } from 'three'
import { NPC_FLEETS } from '@/data/master/npcFleets.ts'
import { getNearbyNpcFleetSnapshots } from '@/game/world/npcFleetSimulation.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { worldToScene } from '@/rendering/worldTransform.ts'

const PLAYER_WAKE_SPEED = 10
const NPC_WAKE_SPEED = 9.5
const NPC_WAKE_RADIUS_KM = 1600
const NPC_WAKE_LIMIT = 12
const WAKE_Y = 0.16

interface WakeMarkProps {
  x: number
  z: number
  heading: number
  speedRatio: number
  scale?: number
  texture: CanvasTexture
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function createWakeTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return new CanvasTexture(canvas)

  const centerX = canvas.width / 2
  const startY = canvas.height * 0.08
  const endY = canvas.height * 0.94

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const centerGradient = ctx.createLinearGradient(0, startY, 0, canvas.height * 0.78)
  centerGradient.addColorStop(0, 'rgba(245, 252, 255, 0.3)')
  centerGradient.addColorStop(0.34, 'rgba(213, 240, 248, 0.14)')
  centerGradient.addColorStop(1, 'rgba(213, 240, 248, 0)')
  ctx.fillStyle = centerGradient
  ctx.beginPath()
  ctx.moveTo(centerX - 7, startY)
  ctx.bezierCurveTo(centerX - 14, canvas.height * 0.28, centerX - 8, canvas.height * 0.58, centerX - 20, canvas.height * 0.86)
  ctx.lineTo(centerX + 20, canvas.height * 0.86)
  ctx.bezierCurveTo(centerX + 8, canvas.height * 0.58, centerX + 14, canvas.height * 0.28, centerX + 7, startY)
  ctx.closePath()
  ctx.fill()

  for (const side of [-1, 1] as const) {
    for (let layer = 0; layer < 4; layer += 1) {
      const t = layer / 3
      ctx.strokeStyle = `rgba(231, 248, 255, ${0.22 - t * 0.045})`
      ctx.lineWidth = 8 - layer * 1.5
      ctx.beginPath()
      ctx.moveTo(centerX + side * (7 + layer * 1.2), startY + layer * 11)
      ctx.bezierCurveTo(
        centerX + side * 20,
        canvas.height * 0.26,
        centerX + side * (42 + layer * 4),
        canvas.height * 0.58,
        centerX + side * (76 + layer * 3),
        endY,
      )
      ctx.stroke()
    }
  }

  const texture = new CanvasTexture(canvas)
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.needsUpdate = true
  return texture
}

function WakeMark({ x, z, heading, speedRatio, scale = 1, texture }: WakeMarkProps) {
  const visibleRatio = clamp01(speedRatio)
  if (visibleRatio <= 0.04) return null

  const opacity = (0.08 + visibleRatio * 0.18) * Math.min(1, scale * 1.25)
  const width = (1.05 + visibleRatio * 2.15) * scale
  const length = (3.4 + visibleRatio * 5.6) * scale

  return (
    <group
      position={[x, WAKE_Y, z]}
      rotation={[0, (-heading * Math.PI) / 180, 0]}
    >
      <mesh position={[0, 0, -length * 0.5]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
        <planeGeometry args={[width, length]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={opacity}
          depthWrite={false}
          depthTest
          toneMapped={false}
        />
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
  const wakeTexture = useMemo(() => createWakeTexture(), [])

  const [playerX, , playerZ] = worldToScene(position)
  const playerSpeedRatio = mode === 'sailing' ? clamp01(currentSpeed / PLAYER_WAKE_SPEED) : 0
  const npcSnapshots = ports.length > 0
    ? getNearbyNpcFleetSnapshots(NPC_FLEETS, ports, totalDays, position, NPC_WAKE_RADIUS_KM)
    : []

  return (
    <group>
      <WakeMark x={playerX} z={playerZ} heading={heading} speedRatio={playerSpeedRatio} scale={1} texture={wakeTexture} />
      {npcSnapshots.slice(0, NPC_WAKE_LIMIT).map((snapshot) => {
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
            scale={0.52}
            texture={wakeTexture}
          />
        )
      })}
    </group>
  )
}
