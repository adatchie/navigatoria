import { OrbitControls } from '@react-three/drei'

export function CameraControls() {
  return (
    <OrbitControls
      makeDefault
      enablePan
      enableZoom
      enableRotate
      minPolarAngle={Math.PI * 0.1}
      maxPolarAngle={Math.PI * 0.45}
      minDistance={20}
      maxDistance={180}
      target={[0, 0, 0]}
    />
  )
}
