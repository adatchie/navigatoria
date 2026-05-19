import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

export interface ResponsiveUiMetrics {
  width: number
  height: number
  scale: number
  isCompact: boolean
  isPhone: boolean
}

type ResponsiveCssVariables = CSSProperties & Record<`--${string}`, string>

const MIN_UI_SCALE = 0.56

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function readViewport(): ResponsiveUiMetrics {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 720, scale: 1, isCompact: false, isPhone: false }
  }

  const viewport = window.visualViewport
  const width = Math.max(320, Math.round(viewport?.width ?? window.innerWidth))
  const height = Math.max(320, Math.round(viewport?.height ?? window.innerHeight))
  const scale = clamp(Math.min(width / 760, height / 620), MIN_UI_SCALE, 1)

  return {
    width,
    height,
    scale,
    isCompact: width < 760 || height < 540,
    isPhone: width < 560 || height < 430,
  }
}

export function useResponsiveUiMetrics(): ResponsiveUiMetrics {
  const [metrics, setMetrics] = useState<ResponsiveUiMetrics>(() => readViewport())

  useEffect(() => {
    const update = () => setMetrics(readViewport())
    const viewport = window.visualViewport

    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)

    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
    }
  }, [])

  return metrics
}

export function getResponsiveUiStyleVars(metrics: ResponsiveUiMetrics): ResponsiveCssVariables {
  const scale = metrics.scale.toFixed(3)
  return {
    '--navigatoria-ui-scale': scale,
    '--navigatoria-sail-left': metrics.isPhone ? `calc(12px * ${scale})` : `calc(12px + 364px * ${scale})`,
  }
}
