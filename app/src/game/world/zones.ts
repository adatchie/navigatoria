import { WORLD_HEIGHT, WORLD_WIDTH } from '@/config/gameConfig.ts'
import type { Port } from '@/types/port.ts'
import type { Zone } from '@/types/world.ts'
import { createZoneId } from '@/types/common.ts'

type ZoneProfile = Omit<Zone, 'id' | 'bounds'>

const ZONE_PROFILES: Record<string, ZoneProfile> = {
  west_europe: {
    name: '西ヨーロッパ',
    nameEn: 'West Europe',
    baseWind: {
      spring: { direction: 250, speed: 12 },
      summer: { direction: 265, speed: 11 },
      autumn: { direction: 240, speed: 13 },
      winter: { direction: 230, speed: 15 },
    },
    dangerLevel: 1,
    seaRegion: 'atlantic',
  },
  north_europe: {
    name: '北ヨーロッパ',
    nameEn: 'North Europe',
    baseWind: {
      spring: { direction: 255, speed: 14 },
      summer: { direction: 270, speed: 12 },
      autumn: { direction: 245, speed: 15 },
      winter: { direction: 225, speed: 18 },
    },
    dangerLevel: 2,
    seaRegion: 'north_sea',
  },
  west_mediterranean: {
    name: '西地中海',
    nameEn: 'West Mediterranean',
    baseWind: {
      spring: { direction: 110, speed: 8 },
      summer: { direction: 100, speed: 7 },
      autumn: { direction: 120, speed: 9 },
      winter: { direction: 130, speed: 10 },
    },
    dangerLevel: 2,
    seaRegion: 'mediterranean',
  },
  east_mediterranean: {
    name: '東地中海',
    nameEn: 'East Mediterranean',
    baseWind: {
      spring: { direction: 105, speed: 9 },
      summer: { direction: 95, speed: 8 },
      autumn: { direction: 120, speed: 10 },
      winter: { direction: 135, speed: 11 },
    },
    dangerLevel: 3,
    seaRegion: 'mediterranean',
  },
  south_africa: {
    name: '南アフリカ沖',
    nameEn: 'South Africa',
    baseWind: {
      spring: { direction: 280, speed: 16 },
      summer: { direction: 290, speed: 18 },
      autumn: { direction: 270, speed: 15 },
      winter: { direction: 260, speed: 14 },
    },
    dangerLevel: 4,
    seaRegion: 'east_africa',
  },
  indian_ocean: {
    name: 'インド洋',
    nameEn: 'Indian Ocean',
    baseWind: {
      spring: { direction: 230, speed: 11 },
      summer: { direction: 210, speed: 14 },
      autumn: { direction: 250, speed: 12 },
      winter: { direction: 275, speed: 15 },
    },
    dangerLevel: 4,
    seaRegion: 'indian_ocean',
  },
  southeast_asia: {
    name: '東南アジア',
    nameEn: 'Southeast Asia',
    baseWind: {
      spring: { direction: 180, speed: 9 },
      summer: { direction: 200, speed: 12 },
      autumn: { direction: 160, speed: 10 },
      winter: { direction: 140, speed: 11 },
    },
    dangerLevel: 3,
    seaRegion: 'southeast_asia',
  },
  east_asia: {
    name: '東アジア',
    nameEn: 'East Asia',
    baseWind: {
      spring: { direction: 210, speed: 10 },
      summer: { direction: 190, speed: 13 },
      autumn: { direction: 240, speed: 12 },
      winter: { direction: 260, speed: 14 },
    },
    dangerLevel: 4,
    seaRegion: 'east_asia',
  },
  caribbean: {
    name: 'カリブ海',
    nameEn: 'Caribbean',
    baseWind: {
      spring: { direction: 70, speed: 12 },
      summer: { direction: 80, speed: 14 },
      autumn: { direction: 90, speed: 13 },
      winter: { direction: 65, speed: 11 },
    },
    dangerLevel: 5,
    seaRegion: 'caribbean',
  },
}

const ZONE_PADDING = 55

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function buildBounds(ports: Port[]) {
  const xs = ports.map((port) => port.position.x)
  const ys = ports.map((port) => port.position.y)
  const minX = clamp(Math.min(...xs) - ZONE_PADDING, 0, WORLD_WIDTH)
  const maxX = clamp(Math.max(...xs) + ZONE_PADDING, 0, WORLD_WIDTH)
  const minY = clamp(Math.min(...ys) - ZONE_PADDING, 0, WORLD_HEIGHT)
  const maxY = clamp(Math.max(...ys) + ZONE_PADDING, 0, WORLD_HEIGHT)

  return {
    topLeft: { x: minX, y: maxY },
    bottomRight: { x: maxX, y: minY },
  }
}

export function buildZonesFromPorts(ports: Port[]): Zone[] {
  return Object.entries(ZONE_PROFILES)
    .map(([zoneId, profile]) => {
      const zonePorts = ports.filter((port) => port.zoneId === zoneId)
      if (zonePorts.length === 0) return null

      return {
        id: createZoneId(zoneId),
        ...profile,
        bounds: buildBounds(zonePorts),
      }
    })
    .filter((zone): zone is Zone => zone !== null)
}
