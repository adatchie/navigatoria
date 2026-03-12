import type { Zone } from '@/types/world.ts'
import { createZoneId } from '@/types/common.ts'

export const DEFAULT_ZONES: Zone[] = [
  {
    id: createZoneId('west_europe'),
    name: '西ヨーロッパ',
    nameEn: 'West Europe',
    bounds: {
      topLeft: { x: 160, y: 580 },
      bottomRight: { x: 240, y: 480 },
    },
    baseWind: {
      spring: { direction: 250, speed: 12 },
      summer: { direction: 265, speed: 11 },
      autumn: { direction: 240, speed: 13 },
      winter: { direction: 230, speed: 15 },
    },
    dangerLevel: 1,
    seaRegion: 'atlantic',
  },
  {
    id: createZoneId('north_europe'),
    name: '北ヨーロッパ',
    nameEn: 'North Europe',
    bounds: {
      topLeft: { x: 190, y: 620 },
      bottomRight: { x: 260, y: 540 },
    },
    baseWind: {
      spring: { direction: 255, speed: 14 },
      summer: { direction: 270, speed: 12 },
      autumn: { direction: 245, speed: 15 },
      winter: { direction: 225, speed: 18 },
    },
    dangerLevel: 2,
    seaRegion: 'north_sea',
  },
  {
    id: createZoneId('west_mediterranean'),
    name: '西地中海',
    nameEn: 'West Mediterranean',
    bounds: {
      topLeft: { x: 220, y: 540 },
      bottomRight: { x: 255, y: 490 },
    },
    baseWind: {
      spring: { direction: 110, speed: 8 },
      summer: { direction: 100, speed: 7 },
      autumn: { direction: 120, speed: 9 },
      winter: { direction: 130, speed: 10 },
    },
    dangerLevel: 2,
    seaRegion: 'mediterranean',
  },
  {
    id: createZoneId('east_mediterranean'),
    name: '東地中海',
    nameEn: 'East Mediterranean',
    bounds: {
      topLeft: { x: 255, y: 540 },
      bottomRight: { x: 290, y: 485 },
    },
    baseWind: {
      spring: { direction: 105, speed: 9 },
      summer: { direction: 95, speed: 8 },
      autumn: { direction: 120, speed: 10 },
      winter: { direction: 135, speed: 11 },
    },
    dangerLevel: 3,
    seaRegion: 'mediterranean',
  },
  {
    id: createZoneId('south_africa'),
    name: '南アフリカ沖',
    nameEn: 'South Africa',
    bounds: {
      topLeft: { x: 210, y: 390 },
      bottomRight: { x: 290, y: 300 },
    },
    baseWind: {
      spring: { direction: 280, speed: 16 },
      summer: { direction: 290, speed: 18 },
      autumn: { direction: 270, speed: 15 },
      winter: { direction: 260, speed: 14 },
    },
    dangerLevel: 4,
    seaRegion: 'east_africa',
  },
  {
    id: createZoneId('indian_ocean'),
    name: 'インド洋',
    nameEn: 'Indian Ocean',
    bounds: {
      topLeft: { x: 290, y: 500 },
      bottomRight: { x: 380, y: 380 },
    },
    baseWind: {
      spring: { direction: 230, speed: 11 },
      summer: { direction: 210, speed: 14 },
      autumn: { direction: 250, speed: 12 },
      winter: { direction: 275, speed: 15 },
    },
    dangerLevel: 4,
    seaRegion: 'indian_ocean',
  },
  {
    id: createZoneId('southeast_asia'),
    name: '東南アジア',
    nameEn: 'Southeast Asia',
    bounds: {
      topLeft: { x: 360, y: 455 },
      bottomRight: { x: 405, y: 390 },
    },
    baseWind: {
      spring: { direction: 180, speed: 9 },
      summer: { direction: 200, speed: 12 },
      autumn: { direction: 160, speed: 10 },
      winter: { direction: 140, speed: 11 },
    },
    dangerLevel: 3,
    seaRegion: 'southeast_asia',
  },
  {
    id: createZoneId('east_asia'),
    name: '東アジア',
    nameEn: 'East Asia',
    bounds: {
      topLeft: { x: 395, y: 510 },
      bottomRight: { x: 450, y: 430 },
    },
    baseWind: {
      spring: { direction: 210, speed: 10 },
      summer: { direction: 190, speed: 13 },
      autumn: { direction: 240, speed: 12 },
      winter: { direction: 260, speed: 14 },
    },
    dangerLevel: 4,
    seaRegion: 'east_asia',
  },
  {
    id: createZoneId('caribbean'),
    name: 'カリブ海',
    nameEn: 'Caribbean',
    bounds: {
      topLeft: { x: 70, y: 490 },
      bottomRight: { x: 130, y: 420 },
    },
    baseWind: {
      spring: { direction: 70, speed: 12 },
      summer: { direction: 80, speed: 14 },
      autumn: { direction: 90, speed: 13 },
      winter: { direction: 65, speed: 11 },
    },
    dangerLevel: 5,
    seaRegion: 'caribbean',
  },
]
