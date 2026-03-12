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
  top: new Color(0x0a0a1a),
  bottom: new Color(0x15152a),
  ambient: new Color(0x111122),
}
const SKY_DAWN_START: SkyColorStage = {
  top: new Color(0x0a0a1a),
  bottom: new Color(0x15152a),
  ambient: new Color(0x111122),
}
const SKY_DAWN_END: SkyColorStage = {
  top: new Color(0x4488cc),
  bottom: new Color(0xff8844),
  ambient: new Color(0x886644),
}
const SKY_DAY: SkyColorStage = {
  top: new Color(0x2277cc),
  bottom: new Color(0x88bbdd),
  ambient: new Color(0x667788),
}
const SKY_DUSK_END: SkyColorStage = {
  top: new Color(0x0a0a1a),
  bottom: new Color(0x15152a),
  ambient: new Color(0x111122),
}
const SKY_DUSK_MID_BOTTOM = new Color(0xff4422)
const SKY_UPDATE_STEP = 12

function quantizeHour(hour: number): number {
  return Math.round(hour * SKY_UPDATE_STEP) / SKY_UPDATE_STEP
}

function applySkyColors(hour: number, target: SkyColorStage) {
  if (hour >= 21 || hour < 5) {
    target.top.copy(SKY_NIGHT.top)
    target.bottom.copy(SKY_NIGHT.bottom)
    target.ambient.copy(SKY_NIGHT.ambient)
    return
  }

  if (hour >= 5 && hour < 7) {
    const dawnProgress = (hour - 5) / 2
    target.top.copy(SKY_DAWN_START.top).lerp(SKY_DAWN_END.top, dawnProgress)
    target.bottom.copy(SKY_DAWN_START.bottom).lerp(SKY_DAWN_END.bottom, dawnProgress)
    target.ambient.copy(SKY_DAWN_START.ambient).lerp(SKY_DAWN_END.ambient, dawnProgress)
    return
  }

  if (hour >= 7 && hour < 17) {
    target.top.copy(SKY_DAY.top)
    target.bottom.copy(SKY_DAY.bottom)
    target.ambient.copy(SKY_DAY.ambient)
    return
  }

  const duskProgress = (hour - 17) / 4
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
    return [x, Math.max(y, -50), -100] as [number, number, number]
  }, [hour])

  const sunVisible = hour >= 5.5 && hour <= 20.5

  return (
    <>
      <color attach="background" args={[colors.top.getHex()]} />
      <ambientLight color={colors.ambient} intensity={0.4} />

      {sunVisible && (
        <directionalLight
          position={sunPosition}
          color={hour < 7 || hour > 17 ? 0xff8844 : 0xffffff}
          intensity={hour < 7 || hour > 17 ? 0.6 : 1.2}
          castShadow={false}
        />
      )}

      {!sunVisible && <directionalLight position={[100, 150, 50]} color={0x6666aa} intensity={0.15} />}

      <hemisphereLight color={colors.top} groundColor={colors.bottom} intensity={0.3} />
      <fog attach="fog" args={[colors.bottom, 100, 400]} />
    </>
  )
}
