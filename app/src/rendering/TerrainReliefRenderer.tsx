// ============================================================
// TerrainReliefRenderer — 船周辺だけに重ねる仮の起伏メッシュ
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  MeshStandardMaterial,
} from 'three'
import { isPointOnLand } from '@/data/master/landmasses.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { worldToScene } from '@/rendering/worldTransform.ts'

interface ReliefMeshData {
  geometry: BufferGeometry
  centerX: number
  centerY: number
}

const RELIEF_WORLD_SIZE = 2600
const RELIEF_SEGMENTS = 56
const RELIEF_UPDATE_INTERVAL = 0.8
const RELIEF_MOVE_THRESHOLD = 180
const BASE_Y = 1.92
const MAX_HEIGHT = 13.5
const COAST_FADE_WORLD_DISTANCE = 42
const NEAR_SEA_SAMPLE_DIRECTIONS = 8

const reliefMaterial = new MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  emissive: 0x2f3f28,
  emissiveIntensity: 0.32,
  roughness: 1,
  metalness: 0,
  envMapIntensity: 0,
  side: DoubleSide,
  transparent: true,
  opacity: 0.62,
  depthTest: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -6,
  polygonOffsetUnits: -6,
})

function fract(value: number): number {
  return value - Math.floor(value)
}

function hash2d(x: number, y: number): number {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123)
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smoothstep(fract(x))
  const fy = smoothstep(fract(y))

  const a = hash2d(ix, iy)
  const b = hash2d(ix + 1, iy)
  const c = hash2d(ix, iy + 1)
  const d = hash2d(ix + 1, iy + 1)
  const x1 = a + (b - a) * fx
  const x2 = c + (d - c) * fx
  return x1 + (x2 - x1) * fy
}

function fractalNoise(x: number, y: number): number {
  let amplitude = 0.58
  let frequency = 1
  let total = 0
  let max = 0

  for (let octave = 0; octave < 4; octave += 1) {
    total += valueNoise(x * frequency, y * frequency) * amplitude
    max += amplitude
    amplitude *= 0.5
    frequency *= 2.03
  }

  return total / max
}

function estimateCoastFade(worldX: number, worldY: number): number {
  if (!isPointOnLand([worldX, worldY])) return 0

  for (let i = 0; i < NEAR_SEA_SAMPLE_DIRECTIONS; i += 1) {
    const angle = (i / NEAR_SEA_SAMPLE_DIRECTIONS) * Math.PI * 2
    const sample: [number, number] = [
      worldX + Math.cos(angle) * COAST_FADE_WORLD_DISTANCE,
      worldY + Math.sin(angle) * COAST_FADE_WORLD_DISTANCE,
    ]
    if (!isPointOnLand(sample)) return 0.18
  }

  return 1
}

function getReliefHeight(worldX: number, worldY: number): number {
  const coastFade = estimateCoastFade(worldX, worldY)
  if (coastFade <= 0) return 0

  const broad = fractalNoise(worldX * 0.0022, worldY * 0.0022)
  const mid = fractalNoise(worldX * 0.0065, worldY * 0.0065)
  const detail = fractalNoise(worldX * 0.018, worldY * 0.018)
  const ridge = Math.pow(Math.max(0, broad * 1.42 + mid * 0.48 - 0.48), 1.32)
  const roughness = Math.pow(detail, 1.8) * 0.22
  const height = (ridge * 0.86 + roughness) * MAX_HEIGHT

  return height * coastFade
}

function buildReliefGeometry(centerX: number, centerY: number): BufferGeometry {
  const step = RELIEF_WORLD_SIZE / RELIEF_SEGMENTS
  const half = RELIEF_WORLD_SIZE / 2
  const heights: number[] = []
  const scenePositions: [number, number, number][] = []

  for (let row = 0; row <= RELIEF_SEGMENTS; row += 1) {
    for (let col = 0; col <= RELIEF_SEGMENTS; col += 1) {
      const worldX = centerX - half + col * step
      const worldY = centerY - half + row * step
      const height = getReliefHeight(worldX, worldY)
      const [sceneX, , sceneZ] = worldToScene({ x: worldX, y: worldY })

      heights.push(height)
      scenePositions.push([sceneX, BASE_Y + height, sceneZ])
    }
  }

  const positions: number[] = []
  const colors: number[] = []
  const vertex = (row: number, col: number) => row * (RELIEF_SEGMENTS + 1) + col

  function pushVertex(index: number) {
    const [x, y, z] = scenePositions[index]!
    const height = heights[index]!
    const shade = Math.min(1, height / MAX_HEIGHT)
    positions.push(x, y, z)
    colors.push(0.39 + shade * 0.09, 0.52 + shade * 0.08, 0.32 + shade * 0.06)
  }

  function pushTriangle(a: number, b: number, c: number) {
    if (heights[a]! <= 0 || heights[b]! <= 0 || heights[c]! <= 0) return
    pushVertex(a)
    pushVertex(b)
    pushVertex(c)
  }

  for (let row = 0; row < RELIEF_SEGMENTS; row += 1) {
    for (let col = 0; col < RELIEF_SEGMENTS; col += 1) {
      const a = vertex(row, col)
      const b = vertex(row, col + 1)
      const c = vertex(row + 1, col)
      const d = vertex(row + 1, col + 1)

      pushTriangle(a, c, b)
      pushTriangle(b, c, d)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geometry.computeVertexNormals()
  return geometry
}

export function TerrainReliefRenderer() {
  const [meshData, setMeshData] = useState<ReliefMeshData | null>(null)
  const elapsedRef = useRef(0)
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null)

  useFrame((_, delta) => {
    elapsedRef.current += delta
    if (elapsedRef.current < RELIEF_UPDATE_INTERVAL) return
    elapsedRef.current = 0

    const position = useNavigationStore.getState().position
    const lastCenter = lastCenterRef.current
    if (
      lastCenter &&
      Math.hypot(position.x - lastCenter.x, position.y - lastCenter.y) < RELIEF_MOVE_THRESHOLD
    ) {
      return
    }

    lastCenterRef.current = { x: position.x, y: position.y }
    const nextGeometry = buildReliefGeometry(position.x, position.y)
    setMeshData((current) => {
      current?.geometry.dispose()
      return {
        geometry: nextGeometry,
        centerX: position.x,
        centerY: position.y,
      }
    })
  })

  useEffect(() => () => {
    meshData?.geometry.dispose()
  }, [meshData])

  const material = useMemo(() => reliefMaterial.clone(), [])

  useEffect(() => () => {
    material.dispose()
  }, [material])

  if (!meshData || meshData.geometry.attributes.position.count === 0) return null

  return (
    <mesh
      geometry={meshData.geometry}
      material={material}
      renderOrder={32}
    />
  )
}
