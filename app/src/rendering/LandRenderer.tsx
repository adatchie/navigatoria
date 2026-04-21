// ============================================================
// LandRenderer — 50m地形を1枚の水平テクスチャとして描画
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  type Texture,
} from 'three'
import { WORLD_HEIGHT, WORLD_WIDTH } from '@/config/gameConfig.ts'
import { projectGeoPairToWorld } from '@/data/master/worldMapProjection.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { SCENE_WORLD_SCALE, worldToScene } from '@/rendering/worldTransform.ts'

interface GeoJsonGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

interface GeoJsonFeature {
  geometry: GeoJsonGeometry
}

interface GeoJsonFeatureCollection {
  features: GeoJsonFeature[]
}

interface Bounds2D {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface DetailLandPolygon {
  id: string
  points: [number, number][]
  bounds: Bounds2D
}

const LAND_TEXTURE_WIDTH = 4096
const LAND_TEXTURE_HEIGHT = 2048
const LAND_COLOR = '#3f5f34'
const BATCH_SIZE = 6
const BATCH_DELAY_MS = 12
const DETAIL_RENDER_RADIUS = 900
const DETAIL_UPDATE_INTERVAL = 0.45
const DETAIL_MAX_POLYGONS = 80
const DETAIL_TEXTURE_SIZE = 2048
const DETAIL_TILE_WORLD_SIZE = 2200
const DETAIL_TILE_MOVE_THRESHOLD = 220

function worldToTexturePoint([lon, lat]: number[]): [number, number] {
  const [worldX, worldY] = projectGeoPairToWorld([lon, lat])
  return [
    (1 - worldX / WORLD_WIDTH) * LAND_TEXTURE_WIDTH,
    (1 - worldY / WORLD_HEIGHT) * LAND_TEXTURE_HEIGHT,
  ]
}

function drawRing(ctx: CanvasRenderingContext2D, ring: number[][]): void {
  if (ring.length < 3) return

  const [startX, startY] = worldToTexturePoint(ring[0]!)
  ctx.moveTo(startX, startY)

  for (let i = 1; i < ring.length; i += 1) {
    const [x, y] = worldToTexturePoint(ring[i]!)
    ctx.lineTo(x, y)
  }
}

function drawPolygon(ctx: CanvasRenderingContext2D, polygon: number[][][]): void {
  const outerRing = polygon[0]
  if (!outerRing) return

  ctx.beginPath()
  drawRing(ctx, outerRing)
  ctx.closePath()
  ctx.fill()
}

function drawFeature(ctx: CanvasRenderingContext2D, feature: GeoJsonFeature): void {
  const geometry = feature.geometry
  if (!geometry) return

  if (geometry.type === 'Polygon') {
    drawPolygon(ctx, geometry.coordinates as number[][][])
    return
  }

  const multiPolygon = geometry.coordinates as number[][][][]
  multiPolygon.forEach((polygon) => drawPolygon(ctx, polygon))
}

function computeBounds(points: [number, number][]): Bounds2D {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  points.forEach(([x, y]) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  })

  return { minX, minY, maxX, maxY }
}

function boundsNearPoint(bounds: Bounds2D, x: number, y: number, radius: number): boolean {
  return (
    x >= bounds.minX - radius &&
    x <= bounds.maxX + radius &&
    y >= bounds.minY - radius &&
    y <= bounds.maxY + radius
  )
}

function boundsIntersect(bounds: Bounds2D, minX: number, minY: number, maxX: number, maxY: number): boolean {
  return bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxY >= minY && bounds.minY <= maxY
}

function projectPolygon(featureIndex: number, polygonIndex: number, polygon: number[][][]): DetailLandPolygon | null {
  const outerRing = polygon[0]
  if (!outerRing || outerRing.length < 3) return null

  const points = outerRing
    .map(([lon, lat]) => projectGeoPairToWorld([lon, lat]))
    .filter((point, index, arr) => index === 0 || arr[index - 1]![0] !== point[0] || arr[index - 1]![1] !== point[1])

  if (points.length < 3) return null

  const first = points[0]!
  const last = points[points.length - 1]!
  if (first[0] === last[0] && first[1] === last[1]) points.pop()
  if (points.length < 3) return null

  return {
    id: `detail_land_${featureIndex}_${polygonIndex}`,
    points,
    bounds: computeBounds(points),
  }
}

function buildDetailPolygons(collection: GeoJsonFeatureCollection): DetailLandPolygon[] {
  const polygons: DetailLandPolygon[] = []

  collection.features.forEach((feature, featureIndex) => {
    const geometry = feature.geometry
    if (!geometry) return

    if (geometry.type === 'Polygon') {
      const polygon = projectPolygon(featureIndex, 0, geometry.coordinates as number[][][])
      if (polygon) polygons.push(polygon)
      return
    }

    const multiPolygon = geometry.coordinates as number[][][][]
    multiPolygon.forEach((polygonData, polygonIndex) => {
      const polygon = projectPolygon(featureIndex, polygonIndex, polygonData)
      if (polygon) polygons.push(polygon)
    })
  })

  return polygons
}

const DETAIL_LAND_MATERIAL = new MeshBasicMaterial({
  color: LAND_COLOR,
  side: DoubleSide,
  depthTest: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -3,
  polygonOffsetUnits: -3,
})

export function LandRenderer() {
  const [texture, setTexture] = useState<CanvasTexture | null>(null)
  const [detailPolygons, setDetailPolygons] = useState<DetailLandPolygon[]>([])

  useEffect(() => {
    let cancelled = false
    let timeoutId = 0

    const canvas = document.createElement('canvas')
    canvas.width = LAND_TEXTURE_WIDTH
    canvas.height = LAND_TEXTURE_HEIGHT

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return undefined

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = LAND_COLOR

    void import('@/data/master/ne_50m_land.json').then((module) => {
      if (cancelled) return
      const collection = module.default as GeoJsonFeatureCollection
      const projectedDetailPolygons = buildDetailPolygons(collection)
      let index = 0

      const drawBatch = () => {
        if (cancelled) return
        const end = Math.min(collection.features.length, index + BATCH_SIZE)
        for (; index < end; index += 1) {
          drawFeature(ctx, collection.features[index]!)
        }

        if (index < collection.features.length) {
          timeoutId = window.setTimeout(drawBatch, BATCH_DELAY_MS)
          return
        }

        const nextTexture = new CanvasTexture(canvas)
        nextTexture.minFilter = LinearFilter
        nextTexture.magFilter = LinearFilter
        nextTexture.generateMipmaps = false
        nextTexture.needsUpdate = true
        setTexture(nextTexture)
        setDetailPolygons(projectedDetailPolygons)
      }

      timeoutId = window.setTimeout(drawBatch, 0)
    })

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [])

  const geometry = useMemo(
    () => new PlaneGeometry(WORLD_WIDTH * SCENE_WORLD_SCALE, WORLD_HEIGHT * SCENE_WORLD_SCALE),
    [],
  )
  const material = useMemo(() => {
    if (!texture) return null
    return new MeshBasicMaterial({
      map: texture,
      alphaTest: 0.01,
      side: DoubleSide,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  }, [texture])

  useEffect(() => () => {
    geometry.dispose()
  }, [geometry])

  useEffect(() => () => {
    material?.dispose()
  }, [material])

  useEffect(() => () => {
    texture?.dispose()
  }, [texture])

  if (!material) return null

  return (
    <>
      <mesh
        geometry={geometry}
        material={material}
        position={[0, 1.8, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        renderOrder={20}
      />
      <NearbyLandDetail polygons={detailPolygons} />
    </>
  )
}

function createDetailShape(polygon: DetailLandPolygon): Shape {
  const shape = new Shape()
  const [startX, , startZ] = worldToScene({ x: polygon.points[0]![0], y: polygon.points[0]![1] })
  shape.moveTo(startX, startZ)

  for (let i = 1; i < polygon.points.length; i += 1) {
    const [x, , z] = worldToScene({ x: polygon.points[i]![0], y: polygon.points[i]![1] })
    shape.lineTo(x, z)
  }

  shape.closePath()
  return shape
}

function DetailLandMesh({ polygon }: { polygon: DetailLandPolygon }) {
  const geometry = useMemo(() => new ShapeGeometry(createDetailShape(polygon)), [polygon])

  useEffect(() => () => {
    geometry.dispose()
  }, [geometry])

  return (
    <mesh
      geometry={geometry}
      material={DETAIL_LAND_MATERIAL}
      position={[0, 1.86, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      renderOrder={30}
    />
  )
}

function drawDetailTilePolygon(
  ctx: CanvasRenderingContext2D,
  polygon: DetailLandPolygon,
  tileBounds: Bounds2D,
) {
  if (polygon.points.length < 3) return

  const tileWidth = tileBounds.maxX - tileBounds.minX
  const tileHeight = tileBounds.maxY - tileBounds.minY
  const toCanvasPoint = ([x, y]: [number, number]): [number, number] => [
    ((tileBounds.maxX - x) / tileWidth) * DETAIL_TEXTURE_SIZE,
    (1 - (y - tileBounds.minY) / tileHeight) * DETAIL_TEXTURE_SIZE,
  ]

  const [startX, startY] = toCanvasPoint(polygon.points[0]!)
  ctx.beginPath()
  ctx.moveTo(startX, startY)

  for (let i = 1; i < polygon.points.length; i += 1) {
    const [x, y] = toCanvasPoint(polygon.points[i]!)
    ctx.lineTo(x, y)
  }

  ctx.closePath()
  ctx.fill()
}

function buildDetailTileTexture(polygons: DetailLandPolygon[], centerX: number, centerY: number): Texture {
  const halfSize = DETAIL_TILE_WORLD_SIZE / 2
  const tileBounds = {
    minX: centerX - halfSize,
    minY: centerY - halfSize,
    maxX: centerX + halfSize,
    maxY: centerY + halfSize,
  }

  const canvas = document.createElement('canvas')
  canvas.width = DETAIL_TEXTURE_SIZE
  canvas.height = DETAIL_TEXTURE_SIZE

  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) {
    const emptyTexture = new CanvasTexture(canvas)
    emptyTexture.generateMipmaps = false
    return emptyTexture
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = LAND_COLOR

  polygons.forEach((polygon) => {
    if (!boundsIntersect(polygon.bounds, tileBounds.minX, tileBounds.minY, tileBounds.maxX, tileBounds.maxY)) return
    drawDetailTilePolygon(ctx, polygon, tileBounds)
  })

  const texture = new CanvasTexture(canvas)
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

function NearbyLandDetail({ polygons }: { polygons: DetailLandPolygon[] }) {
  const [visiblePolygons, setVisiblePolygons] = useState<DetailLandPolygon[]>([])
  const [tileState, setTileState] = useState<{ texture: Texture; centerX: number; centerY: number } | null>(null)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (polygons.length === 0) return

    elapsedRef.current += delta
    if (elapsedRef.current < DETAIL_UPDATE_INTERVAL) return
    elapsedRef.current = 0

    const position = useNavigationStore.getState().position
    const nearby = polygons
      .filter((polygon) => boundsNearPoint(polygon.bounds, position.x, position.y, DETAIL_RENDER_RADIUS))
      .slice(0, DETAIL_MAX_POLYGONS)

    setVisiblePolygons((current) => {
      if (current.length === nearby.length && current.every((polygon, index) => polygon.id === nearby[index]?.id)) {
        return current
      }
      return nearby
    })

    setTileState((current) => {
      if (
        current &&
        Math.hypot(position.x - current.centerX, position.y - current.centerY) < DETAIL_TILE_MOVE_THRESHOLD
      ) {
        return current
      }

      const nextTexture = buildDetailTileTexture(polygons, position.x, position.y)
      return { texture: nextTexture, centerX: position.x, centerY: position.y }
    })
  })

  const tileMaterial = useMemo(() => {
    if (!tileState) return null
    return new MeshBasicMaterial({
      map: tileState.texture,
      alphaTest: 0.01,
      transparent: true,
      side: DoubleSide,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })
  }, [tileState])

  const tileGeometry = useMemo(
    () => new PlaneGeometry(DETAIL_TILE_WORLD_SIZE * SCENE_WORLD_SCALE, DETAIL_TILE_WORLD_SIZE * SCENE_WORLD_SCALE),
    [],
  )

  useEffect(() => () => {
    tileMaterial?.dispose()
  }, [tileMaterial])

  useEffect(() => () => {
    tileGeometry.dispose()
  }, [tileGeometry])

  useEffect(() => () => {
    tileState?.texture.dispose()
  }, [tileState])

  const tilePosition = tileState ? worldToScene({ x: tileState.centerX, y: tileState.centerY }) : null

  return (
    <>
      {tileMaterial && tilePosition && (
        <mesh
          geometry={tileGeometry}
          material={tileMaterial}
          position={[tilePosition[0], 1.84, tilePosition[2]]}
          rotation={[Math.PI / 2, 0, 0]}
          renderOrder={28}
        />
      )}
      {visiblePolygons.map((polygon) => (
        <DetailLandMesh key={polygon.id} polygon={polygon} />
      ))}
    </>
  )
}
