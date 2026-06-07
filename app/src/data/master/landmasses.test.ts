import { describe, expect, it } from 'vitest'
import { DISCOVERY_GEO_COORDINATES } from './discoveryGeography.ts'
import { getSeawardDeparture, isPointOnLand } from './landmasses.ts'
import { projectGeoPairToWorld } from './worldMapProjection.ts'

describe('landmass navigation overrides', () => {
  it('keeps the Dardanelles and Bosporus navigable near Istanbul', () => {
    const straitPoints: [number, number][] = [
      [26.1, 40.0],
      [26.45, 40.2],
      [27.2, 40.45],
      [28.75, 40.87],
      [28.95, 40.98],
      [29.03, 41.04],
      [29.05, 41.12],
      [29.08, 41.18],
      [29.1, 41.25],
      [29.1, 41.32],
      [29.08, 41.42],
      [29.04, 41.52],
    ]

    for (const geoPoint of straitPoints) {
      expect(isPointOnLand(projectGeoPairToWorld(geoPoint)), geoPoint.join(',')).toBe(false)
    }
  })

  it('keeps the Bosporus passable with normal steering drift around Istanbul', () => {
    const bosporusSamples: [number, number][] = [
      [29.0, 41.02],
      [29.04, 41.02],
      [29.01, 41.1],
      [29.09, 41.1],
      [29.04, 41.2],
      [29.12, 41.2],
      [29.05, 41.34],
      [29.12, 41.34],
    ]

    for (const geoPoint of bosporusSamples) {
      expect(isPointOnLand(projectGeoPairToWorld(geoPoint)), geoPoint.join(',')).toBe(false)
    }
  })

  it('can depart from Istanbul into the navigable strait corridor', () => {
    const departure = getSeawardDeparture(projectGeoPairToWorld([29.02, 41.02]))

    expect(isPointOnLand(departure.point)).toBe(false)
  })

  it('keeps major river routes navigable for inland discovery quests', () => {
    const riverPoints: [number, number][] = [
      [30.35, 31.3],
      [31.13, 29.98],
      [32.6, 25.74],
      [67.85, 25.1],
      [68.14, 27.32],
      [105.35, 11.75],
      [103.87, 13.41],
      [-71.2, 46.8],
      [-79.07, 43.08],
    ]

    for (const geoPoint of riverPoints) {
      expect(isPointOnLand(projectGeoPairToWorld(geoPoint)), geoPoint.join(',')).toBe(false)
    }
  })

  it('does not snap river-bound discoveries away from their intended inland targets', () => {
    const riverDiscoveryIds = [
      'giza_pyramids',
      'sphinx',
      'valley_of_the_kings',
      'tutankhamun_mask',
      'rosetta_stone',
      'mohenjo_daro',
      'angkor_wat',
      'niagara_falls',
    ]

    for (const discoveryId of riverDiscoveryIds) {
      const geo = DISCOVERY_GEO_COORDINATES[discoveryId]
      expect(geo, discoveryId).toBeDefined()
      expect(isPointOnLand(projectGeoPairToWorld([geo!.lon, geo!.lat])), discoveryId).toBe(false)
    }
  })
})
