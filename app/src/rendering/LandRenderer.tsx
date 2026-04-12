// ============================================================
// LandRenderer — 大陸・海岸線を3D海面上に描画
// ============================================================

import { useMemo } from 'react'
import { Shape, ShapeGeometry, MeshBasicMaterial, DoubleSide } from 'three'
import { LANDMASSES, type LandPolygon } from '@/data/master/landmasses.ts'
import { WORLD_WIDTH, WORLD_HEIGHT } from '@/config/gameConfig.ts'
import { SCENE_WORLD_SCALE } from '@/rendering/worldTransform.ts'

// ワールド座標 → シーン座標 (XZ平面)
function toScene(wx: number, wy: number): [number, number] {
  const sx = (wx - WORLD_WIDTH / 2) * SCENE_WORLD_SCALE
  const sz = (wy - WORLD_HEIGHT / 2) * SCENE_WORLD_SCALE
  return [sx, sz]
}

// ポリゴンデータから Three.js の Shape を生成
function createLandShape(polygon: LandPolygon): Shape {
  const shape = new Shape()
  const [startX, startZ] = toScene(polygon.points[0]![0], polygon.points[0]![1])
  shape.moveTo(startX, startZ)

  for (let i = 1; i < polygon.points.length; i++) {
    const [x, z] = toScene(polygon.points[i]![0], polygon.points[i]![1])
    shape.lineTo(x, z)
  }
  shape.closePath()
  return shape
}

// 個別の陸地メッシュ
function LandMesh({ polygon }: { polygon: LandPolygon }) {
  const { geometry, material } = useMemo(() => {
    const shape = createLandShape(polygon)
    const geo = new ShapeGeometry(shape)
    const mat = new MeshBasicMaterial({
      color: polygon.color,
      side: DoubleSide,
      depthTest: true,
      depthWrite: true,
      transparent: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    return { geometry: geo, material: mat }
  }, [polygon])

  // ShapeGeometry は XY 平面なので、+90deg 回転で Y をそのまま Z へ流す。
  // 以前の -90deg は worldToScene の Z 向きと逆になり、港マーカーと陸地が鏡写しにズレていた。
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, 1.8, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      renderOrder={20}
    />
  )
}

/** 全大陸を描画するコンポーネント */
export function LandRenderer() {
  const polygons = useMemo(() => LANDMASSES, [])
  return (
    <group>
      {polygons.map((polygon) => (
        <LandMesh key={polygon.id} polygon={polygon} />
      ))}
    </group>
  )
}
