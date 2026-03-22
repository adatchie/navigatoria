// ============================================================
// OceanScene — 海面メッシュ + カスタムシェーダー
// ============================================================

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, DoubleSide, type Mesh, ShaderMaterial, Vector2, Vector3 } from 'three'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'

import oceanVertexShader from './shaders/ocean.vert'
import oceanFragmentShader from './shaders/ocean.frag'

interface OceanSceneProps {
  size?: number
  segments?: number
}

interface OceanColorStage {
  deep: Color
  shallow: Color
  sun: Color
}

const OCEAN_DAY_START_DEEP = new Color(0x006994)
const OCEAN_DAY_END_DEEP = new Color(0x004466)
const OCEAN_DAY_START_SHALLOW = new Color(0x40a4c8)
const OCEAN_DAY_END_SHALLOW = new Color(0x2288aa)
const OCEAN_DAY_SUN = new Color(0xfff5e0)
const OCEAN_DUSK_START_DEEP = new Color(0x006994)
const OCEAN_DUSK_END_DEEP = new Color(0x1a0a2e)
const OCEAN_DUSK_START_SHALLOW = new Color(0x40a4c8)
const OCEAN_DUSK_END_SHALLOW = new Color(0x8b3a62)
const OCEAN_DUSK_START_SUN = new Color(0xff8844)
const OCEAN_DUSK_END_SUN = new Color(0x441122)
const OCEAN_NIGHT: OceanColorStage = {
  deep: new Color(0x0a0a20),
  shallow: new Color(0x1a1a3a),
  sun: new Color(0x222244),
}
const COLOR_STEP = 12
const SUN_STEP = 24
const WIND_DIRECTION_EPSILON = 0.25
const WIND_SPEED_EPSILON = 0.1
const LOD_NEAR_DISTANCE = 70
const LOD_FAR_DISTANCE = 260
const INNER_OCEAN_SIZE_RATIO = 0.44
const OUTER_OCEAN_Y_OFFSET = -0.06

function quantizeHour(hour: number, stepsPerDay: number): number {
  return Math.round(hour * stepsPerDay) / stepsPerDay
}

function applyOceanColors(hour: number, target: OceanColorStage) {
  if (hour >= 6 && hour < 18) {
    const dayProgress = (hour - 6) / 12
    target.deep.copy(OCEAN_DAY_START_DEEP).lerp(OCEAN_DAY_END_DEEP, dayProgress * 0.3)
    target.shallow.copy(OCEAN_DAY_START_SHALLOW).lerp(OCEAN_DAY_END_SHALLOW, dayProgress * 0.3)
    target.sun.copy(OCEAN_DAY_SUN)
    return
  }

  if (hour >= 18 && hour < 20) {
    const duskProgress = (hour - 18) / 2
    target.deep.copy(OCEAN_DUSK_START_DEEP).lerp(OCEAN_DUSK_END_DEEP, duskProgress)
    target.shallow.copy(OCEAN_DUSK_START_SHALLOW).lerp(OCEAN_DUSK_END_SHALLOW, duskProgress)
    target.sun.copy(OCEAN_DUSK_START_SUN).lerp(OCEAN_DUSK_END_SUN, duskProgress)
    return
  }

  target.deep.copy(OCEAN_NIGHT.deep)
  target.shallow.copy(OCEAN_NIGHT.shallow)
  target.sun.copy(OCEAN_NIGHT.sun)
}

function createUniforms() {
  return {
    uTime: { value: 0 },
    uWaveHeight: { value: 1.2 },
    uWaveFrequency: { value: 0.08 },
    uWindDirection: { value: new Vector2(1, 0) },
    uDeepColor: { value: new Color(0x006994) },
    uShallowColor: { value: new Color(0x40a4c8) },
    uSunDirection: { value: new Vector3(0.5, 0.8, 0.3) },
    uSunColor: { value: new Color(0xfff5e0) },
    uFresnelPower: { value: 2.5 },
    uLodNear: { value: LOD_NEAR_DISTANCE },
    uLodFar: { value: LOD_FAR_DISTANCE },
  }
}

function syncOceanMaterial(
  mat: ShaderMaterial,
  delta: number,
  wind: { direction: number; speed: number },
  hour: number,
  colorBuffer: OceanColorStage,
  trackers: {
    lastColorHour: number | null
    lastSunHour: number | null
    lastWindDirection: number | null
    lastWindSpeed: number | null
  },
) {
  mat.uniforms.uTime!.value += delta

  const windDirectionChanged =
    trackers.lastWindDirection === null ||
    Math.abs(trackers.lastWindDirection - wind.direction) >= WIND_DIRECTION_EPSILON
  const windSpeedChanged =
    trackers.lastWindSpeed === null ||
    Math.abs(trackers.lastWindSpeed - wind.speed) >= WIND_SPEED_EPSILON

  if (windDirectionChanged) {
    const windRad = (wind.direction * Math.PI) / 180
    mat.uniforms.uWindDirection!.value.set(Math.sin(windRad), Math.cos(windRad))
    trackers.lastWindDirection = wind.direction
  }

  if (windSpeedChanged) {
    mat.uniforms.uWaveHeight!.value = 0.3 + (wind.speed / 40) * 2.0
    trackers.lastWindSpeed = wind.speed
  }

  const quantizedColorHour = quantizeHour(hour, COLOR_STEP)
  if (trackers.lastColorHour !== quantizedColorHour) {
    applyOceanColors(quantizedColorHour, colorBuffer)
    mat.uniforms.uDeepColor!.value.copy(colorBuffer.deep)
    mat.uniforms.uShallowColor!.value.copy(colorBuffer.shallow)
    mat.uniforms.uSunColor!.value.copy(colorBuffer.sun)
    trackers.lastColorHour = quantizedColorHour
  }

  const quantizedSunHour = quantizeHour(hour, SUN_STEP)
  if (trackers.lastSunHour !== quantizedSunHour) {
    const sunAngle = ((quantizedSunHour - 6) / 12) * Math.PI
    mat.uniforms.uSunDirection!.value
      .set(Math.cos(sunAngle) * 0.5, Math.sin(sunAngle) * 0.8 + 0.2, 0.3)
      .normalize()
    trackers.lastSunHour = quantizedSunHour
  }
}

export function OceanScene({ size = 500, segments = 128 }: OceanSceneProps) {
  const innerMeshRef = useRef<Mesh>(null)
  const outerMeshRef = useRef<Mesh>(null)
  const { wind } = useNavigationStore()
  const hour = useGameStore((s) => s.timeState.hour)

  const innerUniforms = useMemo(() => createUniforms(), [])
  const outerUniforms = useMemo(() => createUniforms(), [])
  const innerColorBuffer = useMemo<OceanColorStage>(
    () => ({ deep: new Color(), shallow: new Color(), sun: new Color() }),
    [],
  )
  const outerColorBuffer = useMemo<OceanColorStage>(
    () => ({ deep: new Color(), shallow: new Color(), sun: new Color() }),
    [],
  )
  const innerTrackersRef = useRef({
    lastColorHour: null as number | null,
    lastSunHour: null as number | null,
    lastWindDirection: null as number | null,
    lastWindSpeed: null as number | null,
  })
  const outerTrackersRef = useRef({
    lastColorHour: null as number | null,
    lastSunHour: null as number | null,
    lastWindDirection: null as number | null,
    lastWindSpeed: null as number | null,
  })

  const innerSize = size * INNER_OCEAN_SIZE_RATIO
  const innerSegments = Math.max(24, segments)
  const outerSegments = Math.max(24, Math.floor(segments * 0.45))

  useFrame((_, delta) => {
    const innerMaterial = innerMeshRef.current?.material
    if (innerMaterial instanceof ShaderMaterial) {
      syncOceanMaterial(innerMaterial, delta, wind, hour, innerColorBuffer, innerTrackersRef.current)
    }

    const outerMaterial = outerMeshRef.current?.material
    if (outerMaterial instanceof ShaderMaterial) {
      syncOceanMaterial(outerMaterial, delta, wind, hour, outerColorBuffer, outerTrackersRef.current)
    }
  })

  return (
    <group>
      <mesh ref={outerMeshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, OUTER_OCEAN_Y_OFFSET, 0]}>
        <planeGeometry args={[size, size, outerSegments, outerSegments]} />
        <shaderMaterial
          vertexShader={oceanVertexShader}
          fragmentShader={oceanFragmentShader}
          uniforms={outerUniforms}
          transparent
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>

      <mesh ref={innerMeshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[innerSize, innerSize, innerSegments, innerSegments]} />
        <shaderMaterial
          vertexShader={oceanVertexShader}
          fragmentShader={oceanFragmentShader}
          uniforms={innerUniforms}
          transparent
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  )
}
