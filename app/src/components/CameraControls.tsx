// ============================================================
// CameraControls — 船追従カメラ (OrbitControls + 自動追従)
// ============================================================

import { useRef, useEffect } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { worldToScene } from '@/rendering/worldTransform.ts'

// カメラ追従の補間速度 (値が大きいほど即追従)
const FOLLOW_LERP = 3.5

export function CameraControls() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const targetRef = useRef(new Vector3())
  const { camera } = useThree()
  const initializedRef = useRef(false)

  // 初回のみカメラ位置を船の上空にセット
  useEffect(() => {
    const position = useNavigationStore.getState().position
    const [sx, , sz] = worldToScene(position)
    targetRef.current.set(sx, 0, sz)

    camera.position.set(sx, 15, sz + 20)
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
    targetRef.current.lerp(new Vector3(sx, 0, sz), lerpFactor)

    // OrbitControlsのターゲットとカメラ位置を同時に移動
    const controls = controlsRef.current
    const offsetX = targetRef.current.x - controls.target.x
    const offsetZ = targetRef.current.z - controls.target.z

    controls.target.x += offsetX
    controls.target.z += offsetZ
    camera.position.x += offsetX
    camera.position.z += offsetZ

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
