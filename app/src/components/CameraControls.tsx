// ============================================================
// CameraControls — 船追従カメラ (OrbitControls + 自動追従)
// ============================================================

import { useRef, useEffect, type ComponentRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { worldToScene } from '@/rendering/worldTransform.ts'

// カメラ追従の補間速度 (値が大きいほど即追従)
const FOLLOW_LERP = 3.5

export function CameraControls() {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls> | null>(null)
  const targetRef = useRef(new Vector3())
  const desiredTargetRef = useRef(new Vector3())
  const { camera } = useThree()
  const initializedRef = useRef(false)

  // 初回のみカメラ位置を船の上空にセット
  useEffect(() => {
    const position = useNavigationStore.getState().position
    const [sx, , sz] = worldToScene(position)
    targetRef.current.set(sx, 0, sz)

    camera.position.set(sx, 15, sz - 20)
    if (controlsRef.current) {
      controlsRef.current.target.copy(targetRef.current)
      controlsRef.current.update()
    }
    initializedRef.current = true
  }, [camera])

  useFrame((_, delta) => {
    if (!controlsRef.current || !initializedRef.current) return

    const position = useNavigationStore.getState().position
    const [sx, , sz] = worldToScene(position)

    // ターゲットを船位置へ滑らかに追従
    const lerpFactor = 1 - Math.exp(-FOLLOW_LERP * delta)
    desiredTargetRef.current.set(sx, 0, sz)
    targetRef.current.lerp(desiredTargetRef.current, lerpFactor)

    // OrbitControlsのターゲットとカメラ位置を同時に移動
    const controls = controlsRef.current
    const offsetX = targetRef.current.x - controls.target.x
    const offsetZ = targetRef.current.z - controls.target.z

    controls.target.set(controls.target.x + offsetX, controls.target.y, controls.target.z + offsetZ)
    camera.position.add(new Vector3(offsetX, 0, offsetZ))

    controls.update()
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableZoom
      enableRotate
      minPolarAngle={Math.PI * 0.08}
      maxPolarAngle={Math.PI * 0.42}
      minDistance={5}
      maxDistance={80}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
    />
  )
}
