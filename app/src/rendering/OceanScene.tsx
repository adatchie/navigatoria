// ============================================================
// OceanScene — Three.js examples Water surface
// ============================================================

import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import {
  Color,
  DataTexture,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
  Vector3,
  type ShaderMaterial,
} from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'

interface OceanSceneProps {
  size?: number
  segments?: number
  position?: [number, number, number]
  reflectionTextureSize?: number
  onClick?: (event: ThreeEvent<MouseEvent>) => void
}

const WATER_NORMAL_SIZE = 256
const DAY_WATER = new Color(0x137299)
const DUSK_WATER = new Color(0x1a5876)
const NIGHT_WATER = new Color(0x1a4661)
const DAY_SUN = new Color(0xfff5e0)
const DUSK_SUN = new Color(0xff9a64)
const NIGHT_SUN = new Color(0xbfd1ff)

function createWaterNormalTexture(): DataTexture {
  const data = new Uint8Array(WATER_NORMAL_SIZE * WATER_NORMAL_SIZE * 4)
  const tau = Math.PI * 2
  const waves = [
    { x: 3, y: 2, phase: 0.4, amp: 0.22 },
    { x: -4, y: 3, phase: 1.8, amp: 0.17 },
    { x: 6, y: -1, phase: 2.7, amp: 0.11 },
    { x: 2, y: -5, phase: 4.2, amp: 0.09 },
    { x: 9, y: 5, phase: 5.4, amp: 0.05 },
  ] as const

  for (let y = 0; y < WATER_NORMAL_SIZE; y += 1) {
    for (let x = 0; x < WATER_NORMAL_SIZE; x += 1) {
      const index = (y * WATER_NORMAL_SIZE + x) * 4
      const u = (x / WATER_NORMAL_SIZE) * tau
      const v = (y / WATER_NORMAL_SIZE) * tau
      let slopeX = 0
      let slopeY = 0

      for (const wave of waves) {
        const phase = u * wave.x + v * wave.y + wave.phase
        const gradient = Math.cos(phase) * wave.amp
        slopeX += gradient * wave.x
        slopeY += gradient * wave.y
      }

      const strength = 32
      data[index] = Math.max(0, Math.min(255, Math.round(128 - slopeX * strength)))
      data[index + 1] = Math.max(0, Math.min(255, Math.round(128 - slopeY * strength)))
      data[index + 2] = 255
      data[index + 3] = 255
    }
  }

  const texture = new DataTexture(data, WATER_NORMAL_SIZE, WATER_NORMAL_SIZE, RGBAFormat, UnsignedByteType)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.generateMipmaps = true
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

function getWaterColor(hour: number, target: Color): Color {
  if (hour >= 6 && hour < 18) return target.copy(DAY_WATER)
  if (hour >= 18 && hour < 20) return target.copy(DAY_WATER).lerp(DUSK_WATER, (hour - 18) / 2)
  return target.copy(NIGHT_WATER)
}

function getSunColor(hour: number, target: Color): Color {
  if (hour >= 6 && hour < 18) return target.copy(DAY_SUN)
  if (hour >= 18 && hour < 20) return target.copy(DAY_SUN).lerp(DUSK_SUN, (hour - 18) / 2)
  return target.copy(NIGHT_SUN)
}

function getSunDirection(hour: number, target: Vector3): Vector3 {
  const sunAngle = ((hour - 6) / 12) * Math.PI
  return target.set(Math.cos(sunAngle) * 0.5, Math.sin(sunAngle) * 0.82 + 0.18, 0.32).normalize()
}

function getWaterMaterial(water: Water): ShaderMaterial {
  return water.material as ShaderMaterial
}

function reduceWaterReflection(material: ShaderMaterial): void {
  material.fragmentShader = material.fragmentShader
    .replace(
      'vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) );',
      `vec3 reflectionSample = waterColor;
					float rippleTone = clamp( 0.52 + noise.x * 0.3 + noise.y * 0.22, 0.0, 1.0 );
					float crestMask = smoothstep( 0.72, 0.95, rippleTone );
					vec3 deepTone = mix( waterColor * 0.72, vec3( 0.025, 0.12, 0.18 ), 0.24 );
					vec3 midTone = mix( waterColor * 1.18, vec3( 0.055, 0.31, 0.42 ), 0.22 );
					vec3 crestTone = mix( waterColor * 1.46, vec3( 0.2, 0.54, 0.62 ), 0.18 );
					vec3 waveColor = mix( deepTone, midTone, smoothstep( 0.18, 0.78, rippleTone ) );
					waveColor = mix( waveColor, crestTone, crestMask * 0.42 );`,
    )
    .replace(
      'vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), reflectionSample + specularLight, reflectance );',
      'vec3 albedo = waveColor + scatter * 0.14 + diffuseLight * sunColor * 0.026 + specularLight * 0.012;',
    )
  material.needsUpdate = true
}

export function OceanScene({
  size = 500,
  segments = 1,
  position = [0, 0, 0],
  reflectionTextureSize = 96,
  onClick,
}: OceanSceneProps) {
  const { wind } = useNavigationStore()
  const hour = useGameStore((s) => s.timeState.hour)
  const waterColor = useMemo(() => new Color(), [])
  const sunColor = useMemo(() => new Color(), [])
  const sunDirection = useMemo(() => new Vector3(), [])
  const eyePosition = useMemo(() => new Vector3(), [])
  const waterNormals = useMemo(() => createWaterNormalTexture(), [])
  const geometry = useMemo(
    () => new PlaneGeometry(size, size, Math.max(1, segments), Math.max(1, segments)),
    [segments, size],
  )
  const water = useMemo(() => {
    const instance = new Water(geometry, {
      textureWidth: reflectionTextureSize,
      textureHeight: reflectionTextureSize,
      waterNormals,
      alpha: 1,
      sunDirection: getSunDirection(12, new Vector3()),
      sunColor: getSunColor(12, new Color()),
      waterColor: getWaterColor(12, new Color()),
      distortionScale: 2.35,
      side: DoubleSide,
      fog: false,
    })

    instance.rotation.x = -Math.PI / 2
    instance.frustumCulled = false
    instance.name = 'official-three-water'
    instance.onBeforeRender = () => {}
    reduceWaterReflection(getWaterMaterial(instance))
    return instance
  }, [geometry, reflectionTextureSize, waterNormals])

  useEffect(() => () => {
    geometry.dispose()
    getWaterMaterial(water).dispose()
  }, [geometry, water])

  useEffect(() => () => {
    waterNormals.dispose()
  }, [waterNormals])

  useFrame(({ camera }, delta) => {
    const material = getWaterMaterial(water)
    camera.getWorldPosition(eyePosition)
    material.uniforms.time!.value += delta * (0.42 + Math.min(1, wind.speed / 34) * 0.48)
    material.uniforms.size!.value = 1.4 + Math.min(1, wind.speed / 36) * 1.2
    material.uniforms.distortionScale!.value = 1.55 + Math.min(1, wind.speed / 34) * 2.1
    material.uniforms.waterColor!.value.copy(getWaterColor(hour, waterColor))
    material.uniforms.sunColor!.value.copy(getSunColor(hour, sunColor))
    material.uniforms.sunDirection!.value.copy(getSunDirection(hour, sunDirection))
    material.uniforms.eye!.value.copy(eyePosition)
  })

  return <primitive object={water} position={position} onClick={onClick} />
}
