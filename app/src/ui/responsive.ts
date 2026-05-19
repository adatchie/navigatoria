import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

export interface ResponsiveUiMetrics {
  width: number
  height: number
  scale: number
  battleScale: number
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
    return { width: 1280, height: 720, scale: 1, battleScale: 1, isCompact: false, isPhone: false }
  }

  const viewport = window.visualViewport
  const width = Math.max(320, Math.round(viewport?.width ?? window.innerWidth))
  const height = Math.max(320, Math.round(viewport?.height ?? window.innerHeight))
  const scale = clamp(Math.min(width / 760, height / 620), MIN_UI_SCALE, 1)
  const battleScale = clamp(Math.min(width / 980, height / 620), 0.46, 1)

  return {
    width,
    height,
    scale,
    battleScale,
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
  const battleScale = metrics.battleScale.toFixed(3)
  const battleHalfPanelWidth = Math.max(150, (metrics.width * 0.5 - 12) / metrics.battleScale)
  const battleLogWidth = Math.max(140, (metrics.width * 0.42 - 12) / metrics.battleScale)
  const battleCommandWidth = Math.max(180, (metrics.width * 0.58 - 12) / metrics.battleScale)
  const battleHeaderWidth = Math.max(320, (metrics.width - 16) / metrics.battleScale)
  const battleActionWidth = Math.min(280, metrics.width - 24) / metrics.battleScale
  const battleTopPanelHeight = Math.max(180, metrics.height * 0.3 / metrics.battleScale)
  const battleLogHeight = Math.max(120, metrics.height * 0.22 / metrics.battleScale)
  return {
    '--navigatoria-ui-scale': scale,
    '--navigatoria-battle-ui-scale': battleScale,
    '--navigatoria-battle-half-panel-width': `${battleHalfPanelWidth.toFixed(1)}px`,
    '--navigatoria-battle-log-width': `${battleLogWidth.toFixed(1)}px`,
    '--navigatoria-battle-command-width': `${battleCommandWidth.toFixed(1)}px`,
    '--navigatoria-battle-header-width': `${battleHeaderWidth.toFixed(1)}px`,
    '--navigatoria-battle-action-width': `${battleActionWidth.toFixed(1)}px`,
    '--navigatoria-battle-top-panel-height': `${battleTopPanelHeight.toFixed(1)}px`,
    '--navigatoria-battle-log-height': `${battleLogHeight.toFixed(1)}px`,
    '--navigatoria-sail-left': metrics.isPhone ? `calc(12px * ${scale})` : `calc(12px + 364px * ${scale})`,
  }
}
