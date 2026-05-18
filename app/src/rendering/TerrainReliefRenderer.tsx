// ============================================================
// TerrainReliefRenderer — 船周辺だけに重ねる仮の起伏メッシュ
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  MirroredRepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three'
import { isPointOnLand } from '@/data/master/landmasses.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { sceneToWorld, worldToScene } from '@/rendering/worldTransform.ts'

interface ReliefMeshData {
  geometry: BufferGeometry
  centerX: number
  centerY: number
}

type LandMaskPredicate = (point: [number, number]) => boolean

const RELIEF_WORLD_SIZE = 2600
const RELIEF_SEGMENTS = 64
const RELIEF_UPDATE_INTERVAL = 0.8
const RELIEF_MOVE_THRESHOLD = 180
const BASE_Y = 1.92
const MAX_HEIGHT = 13.5
const COAST_FADE_WORLD_DISTANCE = 42
const NEAR_SEA_SAMPLE_DIRECTIONS = 8
const CAMERA_FADE_SAMPLE_RADIUS_WORLD = 130
const CAMERA_FADE_HEIGHT_MARGIN = 5.5
const RELIEF_TEXTURE_URL = `${import.meta.env.BASE_URL}textures/terrain/land-relief-wild.png?v=20260516`
const RELIEF_TEXTURE_WORLD_SCALE = 1350
const RELIEF_TEXTURE_WARP_WORLD = 48
const SIDE_WALL_TEXTURE_WORLD_SCALE = 160
const SIDE_WALL_TEXTURE_HEIGHT_SCALE = 8

const reliefMaterial = new MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  emissive: 0x2f3f28,
  emissiveIntensity: 0.32,
  roughness: 1,
  metalness: 0,
  envMapIntensity: 0,
  side: DoubleSide,
  transparent: false,
  opacity: 1,
  depthTest: true,
  depthWrite: true,
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

function shouldFadeReliefForCamera(sceneX: number, sceneY: number, sceneZ: number): boolean {
  const { x: worldX, y: worldY } = sceneToWorld(sceneX, sceneZ)
  const samples: [number, number][] = [
    [0, 0],
    [CAMERA_FADE_SAMPLE_RADIUS_WORLD, 0],
    [-CAMERA_FADE_SAMPLE_RADIUS_WORLD, 0],
    [0, CAMERA_FADE_SAMPLE_RADIUS_WORLD],
    [0, -CAMERA_FADE_SAMPLE_RADIUS_WORLD],
  ]

  return samples.some(([dx, dy]) => {
    const height = getReliefHeight(worldX + dx, worldY + dy)
    if (height <= 0) return false
    return sceneY - (BASE_Y + height) < CAMERA_FADE_HEIGHT_MARGIN
  })
}

function syncReliefMaterialVisibility(material: MeshStandardMaterial, shouldFade: boolean): void {
  const targetOpacity = shouldFade ? 0.42 : 1
  const targetTransparent = shouldFade

  if (
    material.transparent === targetTransparent &&
    material.depthWrite === !targetTransparent &&
    Math.abs(material.opacity - targetOpacity) < 0.001
  ) {
    return
  }

  material.transparent = targetTransparent
  material.opacity = targetOpacity
  material.depthWrite = !targetTransparent
  material.needsUpdate = true
}

function buildReliefGeometry(centerX: number, centerY: number, landMask: LandMaskPredicate): BufferGeometry {
  const step = RELIEF_WORLD_SIZE / RELIEF_SEGMENTS
  const half = RELIEF_WORLD_SIZE / 2
  const heights: number[] = []
  const worldPositions: [number, number][] = []
  const scenePositions: [number, number, number][] = []
  const topTriangles: [number, number, number][] = []

  for (let row = 0; row <= RELIEF_SEGMENTS; row += 1) {
    for (let col = 0; col <= RELIEF_SEGMENTS; col += 1) {
      const worldX = centerX - half + col * step
      const worldY = centerY - half + row * step
      const height = getReliefHeight(worldX, worldY)
      const [sceneX, , sceneZ] = worldToScene({ x: worldX, y: worldY })

      heights.push(height)
      worldPositions.push([worldX, worldY])
      scenePositions.push([sceneX, BASE_Y + height, sceneZ])
    }
  }

  const positions: number[] = []
  const colors: number[] = []
  const uvs: number[] = []
  const vertex = (row: number, col: number) => row * (RELIEF_SEGMENTS + 1) + col

  function getVertexColor(index: number, intensity = 1): [number, number, number] {
    const height = heights[index]!
    const shade = Math.min(1, height / MAX_HEIGHT)
    return [
      (0.82 + shade * 0.16) * intensity,
      (0.88 + shade * 0.12) * intensity,
      (0.76 + shade * 0.1) * intensity,
    ]
  }

  function pushUv(index: number, uvOverride?: [number, number]) {
    if (uvOverride) {
      uvs.push(uvOverride[0], uvOverride[1])
      return
    }

    const [worldX, worldY] = worldPositions[index]!
    const warpX = (fractalNoise(worldX * 0.0043 + 17.1, worldY * 0.0043 - 9.6) - 0.5) * RELIEF_TEXTURE_WARP_WORLD
    const warpY = (fractalNoise(worldX * 0.0047 - 31.4, worldY * 0.0047 + 22.8) - 0.5) * RELIEF_TEXTURE_WARP_WORLD
    uvs.push(
      (worldX + warpX) / RELIEF_TEXTURE_WORLD_SCALE,
      (worldY + warpY) / RELIEF_TEXTURE_WORLD_SCALE,
    )
  }

  function pushVertex(index: number, yOverride?: number, intensity = 1, uvOverride?: [number, number]) {
    const [x, topY, z] = scenePositions[index]!
    const [r, g, b] = getVertexColor(index, intensity)
    positions.push(x, yOverride ?? topY, z)
    colors.push(r, g, b)
    pushUv(index, uvOverride)
  }

  function pushBaseVertex(index: number, intensity = 0.7, uvOverride?: [number, number]) {
    const [x, , z] = scenePositions[index]!
    const [r, g, b] = getVertexColor(index, intensity)
    positions.push(x, BASE_Y, z)
    colors.push(r, g, b)
    pushUv(index, uvOverride)
  }

  function isReliefTriangleContainedByLand(a: number, b: number, c: number): boolean {
    if (heights[a]! <= 0 || heights[b]! <= 0 || heights[c]! <= 0) return false

    const [ax, ay] = worldPositions[a]!
    const [bx, by] = worldPositions[b]!
    const [cx, cy] = worldPositions[c]!
    const samples: [number, number][] = [
      [(ax + bx + cx) / 3, (ay + by + cy) / 3],
      [(ax + bx) / 2, (ay + by) / 2],
      [(bx + cx) / 2, (by + cy) / 2],
      [(cx + ax) / 2, (cy + ay) / 2],
    ]

    return [a, b, c].every((index) => landMask(worldPositions[index]!)) &&
      samples.every((sample) => landMask(sample))
  }

  function pushTriangle(a: number, b: number, c: number) {
    if (!isReliefTriangleContainedByLand(a, b, c)) return
    topTriangles.push([a, b, c])
  }

  function pushTopTriangle(a: number, b: number, c: number) {
    pushVertex(a)
    pushVertex(b)
    pushVertex(c)
  }

  function isReliefTileBoundaryEdge(a: number, b: number): boolean {
    const side = RELIEF_SEGMENTS + 1
    const rowA = Math.floor(a / side)
    const colA = a % side
    const rowB = Math.floor(b / side)
    const colB = b % side

    return (
      (rowA === 0 && rowB === 0) ||
      (rowA === RELIEF_SEGMENTS && rowB === RELIEF_SEGMENTS) ||
      (colA === 0 && colB === 0) ||
      (colA === RELIEF_SEGMENTS && colB === RELIEF_SEGMENTS)
    )
  }

  function pushSideWall(a: number, b: number) {
    const [worldAx, worldAy] = worldPositions[a]!
    const [worldBx, worldBy] = worldPositions[b]!
    const edgeLength = Math.hypot(worldBx - worldAx, worldBy - worldAy)
    const u1 = edgeLength / SIDE_WALL_TEXTURE_WORLD_SCALE
    const vA = Math.max(0.05, heights[a]! / SIDE_WALL_TEXTURE_HEIGHT_SCALE)
    const vB = Math.max(0.05, heights[b]! / SIDE_WALL_TEXTURE_HEIGHT_SCALE)

    pushVertex(a, undefined, 0.82, [0, vA])
    pushBaseVertex(a, 0.58, [0, 0])
    pushBaseVertex(b, 0.58, [u1, 0])
    pushVertex(a, undefined, 0.82, [0, vA])
    pushBaseVertex(b, 0.58, [u1, 0])
    pushVertex(b, undefined, 0.82, [u1, vB])
  }

  function pushBottomCap(a: number, b: number, c: number) {
    pushBaseVertex(c, 0.5)
    pushBaseVertex(b, 0.5)
    pushBaseVertex(a, 0.5)
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

  const edgeCounts = new Map<string, number>()
  const edgeKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`
  for (const [a, b, c] of topTriangles) {
    for (const [from, to] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const key = edgeKey(from, to)
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1)
    }
  }

  for (const [a, b, c] of topTriangles) {
    pushTopTriangle(a, b, c)
  }

  for (const [a, b, c] of topTriangles) {
    for (const [from, to] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      // Close only the local relief tile edge; coastline edges should stay open to avoid cliff walls.
      if (edgeCounts.get(edgeKey(from, to)) === 1 && isReliefTileBoundaryEdge(from, to)) {
        pushSideWall(from, to)
      }
    }
    pushBottomCap(a, b, c)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  geometry.computeVertexNormals()
  return geometry
}

export function TerrainReliefRenderer() {
  const [meshData, setMeshData] = useState<ReliefMeshData | null>(null)
  const [reliefTexture, setReliefTexture] = useState<Texture | null>(null)
  const elapsedRef = useRef(0)
  const landMaskRef = useRef<LandMaskPredicate>(isPointOnLand)
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null)
  const material = useMemo(() => {
    const nextMaterial = reliefMaterial.clone()
    nextMaterial.map = reliefTexture
    return nextMaterial
  }, [reliefTexture])
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy())

  useEffect(() => {
    let cancelled = false
    let loadedTexture: Texture | null = null
    const loader = new TextureLoader()

    loader.load(RELIEF_TEXTURE_URL, (texture) => {
      if (cancelled) {
        texture.dispose()
        return
      }

      texture.wrapS = MirroredRepeatWrapping
      texture.wrapT = MirroredRepeatWrapping
      texture.minFilter = LinearMipmapLinearFilter
      texture.magFilter = LinearFilter
      texture.anisotropy = maxAnisotropy
      texture.colorSpace = SRGBColorSpace
      texture.needsUpdate = true
      loadedTexture = texture
      setReliefTexture(texture)
    })

    return () => {
      cancelled = true
      loadedTexture?.dispose()
    }
  }, [maxAnisotropy])

  useEffect(() => {
    let cancelled = false

    void import('@/data/generated/renderLandMask.ts').then(({ isPointOnRenderedLand }) => {
      if (cancelled) return
      landMaskRef.current = isPointOnRenderedLand
      lastCenterRef.current = null
      elapsedRef.current = RELIEF_UPDATE_INTERVAL
      setMeshData((current) => {
        current?.geometry.dispose()
        return null
      })
    })

    return () => {
      cancelled = true
    }
  }, [])

  useFrame((state, delta) => {
    syncReliefMaterialVisibility(
      material,
      shouldFadeReliefForCamera(state.camera.position.x, state.camera.position.y, state.camera.position.z),
    )

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
    const nextGeometry = buildReliefGeometry(position.x, position.y, landMaskRef.current)
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

  useEffect(() => () => {
    material.dispose()
  }, [material])

  if (!reliefTexture || !meshData || meshData.geometry.attributes.position.count === 0) return null

  return (
    <mesh
      geometry={meshData.geometry}
      material={material}
      renderOrder={32}
    />
  )
}
