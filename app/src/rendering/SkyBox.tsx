// ============================================================
// SkyBox — 時間帯連動のグラデーションスカイ
// ============================================================

import { useMemo } from 'react'
import { Color } from 'three'
import { useGameStore } from '@/stores/useGameStore.ts'

interface SkyColorStage {
  top: Color
  bottom: Color
  ambient: Color
}

const SKY_NIGHT: SkyColorStage = {
  top: new Color(0x223653),
  bottom: new Color(0x415775),
  ambient: new Color(0x9fb2d0),
}
const SKY_DAWN_START: SkyColorStage = {
  top: new Color(0x223653),
  bottom: new Color(0x415775),
  ambient: new Color(0x9fb2d0),
}
const SKY_DAWN_END: SkyColorStage = {
  top: new Color(0x5c9bd1),
  bottom: new Color(0xf4a261),
  ambient: new Color(0xb89a7a),
}
const SKY_DAY: SkyColorStage = {
  top: new Color(0x3f8fd4),
  bottom: new Color(0xa9cfe4),
  ambient: new Color(0xc2d1df),
}
const SKY_DUSK_END: SkyColorStage = {
  top: new Color(0x223653),
  bottom: new Color(0x415775),
  ambient: new Color(0x9fb2d0),
}
const SKY_DUSK_MID_BOTTOM = new Color(0xff4422)
const SKY_UPDATE_STEP = 12

function quantizeHour(hour: number): number {
  return Math.round(hour * SKY_UPDATE_STEP) / SKY_UPDATE_STEP
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function applySkyColors(hour: number, target: SkyColorStage) {
  if (hour >= 21.5 || hour < 4.5) {
    target.top.copy(SKY_NIGHT.top)
    target.bottom.copy(SKY_NIGHT.bottom)
    target.ambient.copy(SKY_NIGHT.ambient)
    return
  }

  if (hour >= 4.5 && hour < 7.25) {
    const dawnProgress = smoothstep(4.5, 7.25, hour)
    target.top.copy(SKY_DAWN_START.top).lerp(SKY_DAWN_END.top, dawnProgress)
    target.bottom.copy(SKY_DAWN_START.bottom).lerp(SKY_DAWN_END.bottom, dawnProgress)
    target.ambient.copy(SKY_DAWN_START.ambient).lerp(SKY_DAWN_END.ambient, dawnProgress)
    return
  }

  if (hour >= 7.25 && hour < 17.5) {
    target.top.copy(SKY_DAY.top)
    target.bottom.copy(SKY_DAY.bottom)
    target.ambient.copy(SKY_DAY.ambient)
    return
  }

  const duskProgress = smoothstep(17.5, 21.5, hour)
  target.top.copy(SKY_DAY.top).lerp(SKY_DUSK_END.top, duskProgress)
  target.bottom
    .copy(SKY_DAY.bottom)
    .lerp(SKY_DUSK_MID_BOTTOM, Math.min(duskProgress * 2, 1))
    .lerp(SKY_DUSK_END.bottom, Math.max((duskProgress - 0.5) * 2, 0))
  target.ambient.copy(SKY_DAY.ambient).lerp(SKY_DUSK_END.ambient, duskProgress)
}

export function SkyBox() {
  const hour = useGameStore((s) => quantizeHour(s.timeState.hour))
  const colors = useMemo<SkyColorStage>(
    () => ({
      top: new Color(),
      bottom: new Color(),
      ambient: new Color(),
    }),
    [],
  )

  applySkyColors(hour, colors)

  const sunPosition = useMemo(() => {
    const sunAngle = ((hour - 6) / 12) * Math.PI
    const x = Math.cos(sunAngle) * 200
    const y = Math.sin(sunAngle) * 200
    return [x, Math.max(y, 28), -100] as [number, number, number]
  }, [hour])

  const sunVisible = hour >= 5 && hour <= 20.5
  const nightVisible = !sunVisible
  const daylightStrength = smoothstep(5, 7.25, hour) * (1 - smoothstep(18, 20.5, hour))
  const sunIntensity = 0.38 + daylightStrength * 0.72
  const ambientIntensity = nightVisible ? 1.08 : 1.08
  const fillIntensity = nightVisible ? 0.58 : 0.52
  const hemisphereIntensity = nightVisible ? 0.72 : 0.74

  return (
    <>
      <color attach="background" args={[colors.top.getHex()]} />
      <ambientLight color={colors.ambient} intensity={ambientIntensity} />

      {sunVisible && (
        <directionalLight
          position={sunPosition}
          color={hour < 7 || hour > 17 ? 0xff8844 : 0xffffff}
          intensity={sunIntensity}
          castShadow={false}
        />
      )}

      <directionalLight position={[-80, 120, -40]} color={0xdbeafe} intensity={fillIntensity} />
      <directionalLight position={[60, 90, 80]} color={0xeaf4ff} intensity={nightVisible ? 0.24 : 0.36} />
      {nightVisible && <directionalLight position={[100, 150, 50]} color={0xc8d7ff} intensity={0.58} />}

      <hemisphereLight color={colors.top} groundColor={colors.bottom} intensity={hemisphereIntensity} />
      <fog attach="fog" args={[colors.bottom, nightVisible ? 240 : 150, nightVisible ? 760 : 620]} />
    </>
  )
}
