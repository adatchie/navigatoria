// ============================================================
// ShipRenderer [STUB] — プレースホルダー船 + GLBロード準備
// ============================================================

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  MeshStandardMaterial,
  PlaneGeometry,
  type BufferGeometry,
  type Group,
  type Material,
} from 'three'

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
