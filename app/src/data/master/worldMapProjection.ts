import { WORLD_HEIGHT, WORLD_WIDTH } from '@/config/gameConfig.ts'
import type { Position2D } from '@/types/common.ts'

export interface GeoPoint {
  lon: number
  lat: number
}

const MAX_MERCATOR_LAT = 85.05112878

function clampLat(lat: number): number {
  return Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat))
}

function mercatorY(lat: number): number {
  const clamped = clampLat(lat)
  const radians = (clamped * Math.PI) / 180
  return Math.log(Math.tan(Math.PI / 4 + radians / 2))
}

const MERCATOR_Y_MIN = mercatorY(-MAX_MERCATOR_LAT)
const MERCATOR_Y_MAX = mercatorY(MAX_MERCATOR_LAT)

/**
 * Web Mercator (EPSG:3857) をワールド座標へ正規化する。
 * x: 経度 -180..180 を WORLD_WIDTH へ
 * y: メルカトルyを WORLD_HEIGHT へ
 */
export function projectGeoToWorld(point: GeoPoint): Position2D {
  const x = ((point.lon + 180) / 360) * WORLD_WIDTH
  const y = ((mercatorY(point.lat) - MERCATOR_Y_MIN) / (MERCATOR_Y_MAX - MERCATOR_Y_MIN)) * WORLD_HEIGHT
  return { x, y }
}

export function projectGeoPairToWorld([lon, lat]: [number, number]): [number, number] {
  const projected = projectGeoToWorld({ lon, lat })
  return [projected.x, projected.y]
}
