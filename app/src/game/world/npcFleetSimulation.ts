import { WORLD_DISTANCE_SCALE } from '@/config/gameConfig.ts'
import { isPointOnLand, snapPointToNearestSea } from '@/data/master/landmasses.ts'
import { projectGeoToWorld } from '@/data/master/worldMapProjection.ts'
import type { Position2D, PortId } from '@/types/common.ts'
import type { NpcFleetDefinition, NpcFleetSnapshot } from '@/types/npcFleet.ts'
import type { Port } from '@/types/port.ts'

const KM_PER_KNOT_DAY = 1.852 * 24
const SUSTAINED_ROUTE_SPEED_FACTOR = 0.74
const ROUTE_SAMPLE_STEP = 28
const START_NODE_LINKS = 8
const ROUTE_SEA_SNAP_MAX_RADIUS = 220
const ROUTE_SEA_SNAP_RADIAL_STEPS = 22
const ROUTE_SEA_SNAP_ANGLE_STEPS = 40

interface NpcFleetLeg {
  from: Port
  to: Port
  path: Position2D[]
  segmentDistancesKm: number[]
  distanceKm: number
  travelDays: number
}

interface SeaRouteNodeDefinition {
  id: string
  lon: number
  lat: number
}

interface SeaRouteNode {
  id: string
  position: Position2D
}

interface SeaRouteEdge {
  to: string
  distanceKm: number
}

interface RouteAnchorDefinition {
  lon: number
  lat: number
}

const PORT_ROUTE_ANCHORS: Record<string, RouteAnchorDefinition> = {
  cape_town: { lon: 18.35, lat: -35.35 },
  malacca: { lon: 101.55, lat: 2.15 },
}

const SEA_ROUTE_NODE_DEFINITIONS: SeaRouteNodeDefinition[] = [
  { id: 'north_sea', lon: 2.2, lat: 53.2 },
  { id: 'dutch_coast', lon: 3.4, lat: 52.6 },
  { id: 'thames_approach', lon: 1.4, lat: 51.5 },
  { id: 'channel_east', lon: 1.0, lat: 50.4 },
  { id: 'channel_west', lon: -4.6, lat: 49.5 },
  { id: 'biscay_north', lon: -5.8, lat: 46.6 },
  { id: 'gironde_offing', lon: -2.5, lat: 45.6 },
  { id: 'biscay_south', lon: -8.2, lat: 44.2 },
  { id: 'iberia_west', lon: -10.6, lat: 39.0 },
  { id: 'tagus_offing', lon: -10.2, lat: 38.1 },
  { id: 'cadiz_offing', lon: -7.1, lat: 36.3 },
  { id: 'cape_sao_vicente', lon: -9.3, lat: 36.65 },
  { id: 'gibraltar_west', lon: -6.0, lat: 35.8 },
  { id: 'gibraltar_east', lon: -4.0, lat: 35.9 },
  { id: 'alboran_sea', lon: -2.2, lat: 35.7 },
  { id: 'western_algerian_sea', lon: 0.5, lat: 37.2 },
  { id: 'balearic_sea', lon: 2.1, lat: 38.6 },
  { id: 'gulf_of_lion', lon: 5.0, lat: 42.1 },
  { id: 'ligurian_sea', lon: 8.4, lat: 43.3 },
  { id: 'tyrrhenian_north', lon: 10.8, lat: 41.9 },
  { id: 'tyrrhenian_south', lon: 13.3, lat: 39.3 },
  { id: 'tunis_offing', lon: 11.3, lat: 36.35 },
  { id: 'sardinia_south', lon: 7.6, lat: 37.5 },
  { id: 'algerian_sea', lon: 4.0, lat: 37.7 },
  { id: 'sicily_channel', lon: 13.6, lat: 35.8 },
  { id: 'ionian_sea', lon: 18.5, lat: 36.7 },
  { id: 'adriatic_south', lon: 18.2, lat: 41.3 },
  { id: 'adriatic_north', lon: 13.6, lat: 44.6 },
  { id: 'aegean_south', lon: 24.4, lat: 36.4 },
  { id: 'aegean_north', lon: 25.6, lat: 39.0 },
  { id: 'marmara', lon: 28.6, lat: 40.6 },
  { id: 'levant_sea', lon: 30.6, lat: 33.5 },
  { id: 'alexandria_offing', lon: 29.7, lat: 32.0 },
  { id: 'madeira_lane', lon: -16.8, lat: 32.4 },
  { id: 'canary_lane', lon: -17.2, lat: 28.0 },
  { id: 'cape_verde_lane', lon: -24.0, lat: 15.0 },
  { id: 'mid_atlantic_east', lon: -27.0, lat: 28.5 },
  { id: 'mid_atlantic', lon: -41.0, lat: 27.0 },
  { id: 'west_atlantic', lon: -58.0, lat: 24.5 },
  { id: 'caribbean_north', lon: -73.0, lat: 23.5 },
  { id: 'cuba_north', lon: -80.8, lat: 24.0 },
  { id: 'hispaniola_south', lon: -70.5, lat: 17.5 },
  { id: 'equatorial_atlantic', lon: -12.0, lat: 1.0 },
  { id: 'gulf_of_guinea', lon: 1.0, lat: -5.0 },
  { id: 'angola_offing', lon: 8.0, lat: -17.0 },
  { id: 'namibia_offing', lon: 12.0, lat: -28.0 },
  { id: 'cape_west', lon: 16.0, lat: -34.0 },
  { id: 'table_bay_offing', lon: 17.85, lat: -33.75 },
  { id: 'cape_point_south', lon: 18.35, lat: -35.35 },
  { id: 'false_bay_offing', lon: 20.5, lat: -35.6 },
  { id: 'cape_east', lon: 24.0, lat: -36.0 },
  { id: 'south_indian_ocean', lon: 39.5, lat: -35.0 },
  { id: 'madagascar_east', lon: 53.0, lat: -24.0 },
  { id: 'mascarene_sea', lon: 58.0, lat: -16.0 },
  { id: 'western_indian_ocean', lon: 58.0, lat: 2.0 },
  { id: 'arabian_sea_west', lon: 64.0, lat: 8.0 },
  { id: 'arabian_sea_east', lon: 71.5, lat: 10.5 },
  { id: 'malabar_coast', lon: 74.0, lat: 10.4 },
  { id: 'comorin_south', lon: 77.2, lat: 7.0 },
  { id: 'ceylon_south', lon: 80.5, lat: 5.0 },
  { id: 'bay_of_bengal_south', lon: 86.0, lat: 7.0 },
  { id: 'bay_of_bengal', lon: 88.0, lat: 8.0 },
  { id: 'andaman_sea', lon: 96.0, lat: 6.5 },
  { id: 'malacca_west', lon: 100.0, lat: 4.2 },
  { id: 'malacca_strait', lon: 102.0, lat: 2.6 },
  { id: 'south_china_sea', lon: 111.0, lat: 13.0 },
  { id: 'pearl_river_approach', lon: 113.0, lat: 21.0 },
  { id: 'east_china_sea', lon: 124.5, lat: 28.0 },
  { id: 'nagasaki_approach', lon: 129.2, lat: 32.4 },
]

const SEA_ROUTE_EDGE_DEFINITIONS: [string, string][] = [
  ['north_sea', 'dutch_coast'],
  ['north_sea', 'thames_approach'],
  ['dutch_coast', 'channel_east'],
  ['thames_approach', 'channel_east'],
  ['channel_east', 'channel_west'],
  ['channel_west', 'biscay_north'],
  ['biscay_north', 'gironde_offing'],
  ['biscay_north', 'biscay_south'],
  ['gironde_offing', 'biscay_south'],
  ['biscay_south', 'iberia_west'],
  ['iberia_west', 'tagus_offing'],
  ['tagus_offing', 'cape_sao_vicente'],
  ['cape_sao_vicente', 'cadiz_offing'],
  ['cadiz_offing', 'gibraltar_west'],
  ['gibraltar_west', 'gibraltar_east'],
  ['gibraltar_east', 'alboran_sea'],
  ['alboran_sea', 'western_algerian_sea'],
  ['western_algerian_sea', 'algerian_sea'],
  ['balearic_sea', 'gulf_of_lion'],
  ['balearic_sea', 'tyrrhenian_north'],
  ['gulf_of_lion', 'ligurian_sea'],
  ['ligurian_sea', 'tyrrhenian_north'],
  ['tyrrhenian_north', 'tyrrhenian_south'],
  ['tyrrhenian_south', 'tunis_offing'],
  ['tunis_offing', 'sardinia_south'],
  ['sardinia_south', 'algerian_sea'],
  ['algerian_sea', 'balearic_sea'],
  ['tunis_offing', 'sicily_channel'],
  ['sicily_channel', 'ionian_sea'],
  ['ionian_sea', 'adriatic_south'],
  ['adriatic_south', 'adriatic_north'],
  ['ionian_sea', 'aegean_south'],
  ['aegean_south', 'aegean_north'],
  ['aegean_north', 'marmara'],
  ['aegean_south', 'levant_sea'],
  ['levant_sea', 'alexandria_offing'],
  ['ionian_sea', 'alexandria_offing'],
  ['iberia_west', 'madeira_lane'],
  ['madeira_lane', 'canary_lane'],
  ['canary_lane', 'cape_verde_lane'],
  ['madeira_lane', 'mid_atlantic_east'],
  ['mid_atlantic_east', 'mid_atlantic'],
  ['mid_atlantic', 'west_atlantic'],
  ['west_atlantic', 'caribbean_north'],
  ['caribbean_north', 'cuba_north'],
  ['caribbean_north', 'hispaniola_south'],
  ['cuba_north', 'hispaniola_south'],
  ['cape_verde_lane', 'equatorial_atlantic'],
  ['equatorial_atlantic', 'gulf_of_guinea'],
  ['gulf_of_guinea', 'angola_offing'],
  ['angola_offing', 'namibia_offing'],
  ['namibia_offing', 'cape_west'],
  ['cape_west', 'table_bay_offing'],
  ['cape_west', 'cape_point_south'],
  ['table_bay_offing', 'cape_point_south'],
  ['cape_point_south', 'false_bay_offing'],
  ['cape_point_south', 'cape_east'],
  ['false_bay_offing', 'cape_east'],
  ['cape_east', 'south_indian_ocean'],
  ['south_indian_ocean', 'madagascar_east'],
  ['madagascar_east', 'mascarene_sea'],
  ['mascarene_sea', 'western_indian_ocean'],
  ['western_indian_ocean', 'arabian_sea_west'],
  ['arabian_sea_west', 'arabian_sea_east'],
  ['arabian_sea_east', 'malabar_coast'],
  ['malabar_coast', 'comorin_south'],
  ['comorin_south', 'ceylon_south'],
  ['ceylon_south', 'bay_of_bengal_south'],
  ['bay_of_bengal_south', 'bay_of_bengal'],
  ['bay_of_bengal', 'andaman_sea'],
  ['andaman_sea', 'malacca_west'],
  ['malacca_west', 'malacca_strait'],
  ['malacca_strait', 'south_china_sea'],
  ['south_china_sea', 'pearl_river_approach'],
  ['pearl_river_approach', 'east_china_sea'],
  ['east_china_sea', 'nagasaki_approach'],
]

let seaRouteNodesCache: SeaRouteNode[] | null = null
let seaRouteEdgesCache: Map<string, SeaRouteEdge[]> | null = null
const fleetLegsCache = new Map<string, NpcFleetLeg[]>()

function distanceKm(a: Position2D, b: Position2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y) * WORLD_DISTANCE_SCALE
}

function distanceSq(a: Position2D, b: Position2D): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return dx * dx + dy * dy
}

function getHeading(from: Position2D, to: Position2D): number {
  return ((Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI + 360) % 360
}

function toSeaPosition(position: Position2D): Position2D {
  const [x, y] = snapPointToNearestSea([position.x, position.y])
  return { x, y }
}

function keepPositionAtSea(position: Position2D): Position2D {
  if (!isPointOnLand([position.x, position.y])) return position

  let bestPosition: Position2D | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (let radiusStep = 1; radiusStep <= ROUTE_SEA_SNAP_RADIAL_STEPS; radiusStep++) {
    const radius = (ROUTE_SEA_SNAP_MAX_RADIUS * radiusStep) / ROUTE_SEA_SNAP_RADIAL_STEPS
    for (let angleStep = 0; angleStep < ROUTE_SEA_SNAP_ANGLE_STEPS; angleStep++) {
      const angle = (angleStep / ROUTE_SEA_SNAP_ANGLE_STEPS) * Math.PI * 2
      const candidate = {
        x: position.x + Math.cos(angle) * radius,
        y: position.y + Math.sin(angle) * radius,
      }
      if (isPointOnLand([candidate.x, candidate.y])) continue

      const candidateDistance = distanceSq(position, candidate)
      if (candidateDistance < bestDistance) {
        bestDistance = candidateDistance
        bestPosition = candidate
      }
    }

    if (bestPosition) return bestPosition
  }

  return toSeaPosition(position)
}

function getPortRouteAnchor(port: Port): Position2D {
  const anchor = PORT_ROUTE_ANCHORS[port.id]
  if (!anchor) return toSeaPosition(port.position)
  return toSeaPosition(projectGeoToWorld(anchor))
}

function buildSeaRouteNodes(): SeaRouteNode[] {
  if (seaRouteNodesCache) return seaRouteNodesCache
  seaRouteNodesCache = SEA_ROUTE_NODE_DEFINITIONS.map((node) => ({
    id: node.id,
    position: toSeaPosition(projectGeoToWorld({ lon: node.lon, lat: node.lat })),
  }))
  return seaRouteNodesCache
}

function isSeaSegmentClear(from: Position2D, to: Position2D): boolean {
  const worldDistance = Math.hypot(to.x - from.x, to.y - from.y)
  const samples = Math.max(2, Math.ceil(worldDistance / ROUTE_SAMPLE_STEP))
  const progressSamples = new Set<number>()

  for (let i = 1; i < samples; i++) {
    progressSamples.add(i / samples)
  }

  for (const progress of [0.004, 0.008, 0.015, 0.025, 0.04, 0.96, 0.975, 0.985, 0.992, 0.996]) {
    progressSamples.add(progress)
  }

  for (const progress of progressSamples) {
    const sample: [number, number] = [
      from.x + (to.x - from.x) * progress,
      from.y + (to.y - from.y) * progress,
    ]
    if (isPointOnLand(sample)) return false
  }

  return true
}

function addRouteEdge(edges: Map<string, SeaRouteEdge[]>, from: string, to: string, distance: number): void {
  const current = edges.get(from) ?? []
  current.push({ to, distanceKm: distance })
  edges.set(from, current)
}

function buildSeaRouteEdges(): Map<string, SeaRouteEdge[]> {
  if (seaRouteEdgesCache) return seaRouteEdgesCache

  const nodes = buildSeaRouteNodes()
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const edges = new Map<string, SeaRouteEdge[]>()

  for (const [fromId, toId] of SEA_ROUTE_EDGE_DEFINITIONS) {
    const from = nodeById.get(fromId)
    const to = nodeById.get(toId)
    if (!from || !to) continue

    const distance = distanceKm(from.position, to.position)
    addRouteEdge(edges, fromId, toId, distance)
    addRouteEdge(edges, toId, fromId, distance)
  }

  seaRouteEdgesCache = edges
  return seaRouteEdgesCache
}

function getNearestVisibleNodeLinks(point: Position2D, nodes: SeaRouteNode[]): SeaRouteEdge[] {
  return nodes
    .map((node) => ({ to: node.id, distanceKm: distanceKm(point, node.position), node }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .filter((link) => isSeaSegmentClear(point, link.node.position))
    .slice(0, START_NODE_LINKS)
    .map(({ to, distanceKm }) => ({ to, distanceKm }))
}

function findSeaRoutePath(from: Position2D, to: Position2D): Position2D[] {
  const start = toSeaPosition(from)
  const goal = toSeaPosition(to)
  if (isSeaSegmentClear(start, goal)) return [start, goal]

  const seaNodes = buildSeaRouteNodes()
  const baseEdges = buildSeaRouteEdges()
  const nodeById = new Map(seaNodes.map((node) => [node.id, node]))
  const startLinks = getNearestVisibleNodeLinks(start, seaNodes)
  const goalLinks = getNearestVisibleNodeLinks(goal, seaNodes)

  if (startLinks.length === 0 || goalLinks.length === 0) {
    return [start, goal]
  }

  const graphEdges = new Map<string, SeaRouteEdge[]>()
  baseEdges.forEach((edges, nodeId) => {
    graphEdges.set(nodeId, [...edges])
  })

  graphEdges.set('start', startLinks)
  for (const link of startLinks) addRouteEdge(graphEdges, link.to, 'start', link.distanceKm)

  graphEdges.set('goal', goalLinks)
  for (const link of goalLinks) addRouteEdge(graphEdges, link.to, 'goal', link.distanceKm)

  const distances = new Map<string, number>([['start', 0]])
  const previous = new Map<string, string>()
  const unvisited = new Set<string>(['start', 'goal', ...seaNodes.map((node) => node.id)])

  while (unvisited.size > 0) {
    let current: string | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const nodeId of unvisited) {
      const nodeDistance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY
      if (nodeDistance < bestDistance) {
        bestDistance = nodeDistance
        current = nodeId
      }
    }

    if (!current || current === 'goal' || bestDistance === Number.POSITIVE_INFINITY) break
    unvisited.delete(current)

    for (const edge of graphEdges.get(current) ?? []) {
      if (!unvisited.has(edge.to)) continue
      const candidateDistance = bestDistance + edge.distanceKm
      if (candidateDistance >= (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) continue
      distances.set(edge.to, candidateDistance)
      previous.set(edge.to, current)
    }
  }

  if (!previous.has('goal')) return [start, goal]

  const routeIds: string[] = ['goal']
  while (routeIds[0] !== 'start') {
    const parent = previous.get(routeIds[0]!)
    if (!parent) return [start, goal]
    routeIds.unshift(parent)
  }

  return routeIds.map((nodeId) => {
    if (nodeId === 'start') return start
    if (nodeId === 'goal') return goal
    return nodeById.get(nodeId)!.position
  })
}

function getPathSegmentDistances(path: Position2D[]): number[] {
  const distances: number[] = []
  for (let i = 0; i < path.length - 1; i++) {
    distances.push(distanceKm(path[i]!, path[i + 1]!))
  }
  return distances
}

function getPathDistance(segmentDistances: number[]): number {
  return segmentDistances.reduce((sum, distance) => sum + distance, 0)
}

function applyLaneOffset(position: Position2D, from: Position2D, to: Position2D, laneOffsetKm: number): Position2D {
  if (laneOffsetKm === 0) return keepPositionAtSea(position)

  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length <= 0.0001) return keepPositionAtSea(position)

  const offset = laneOffsetKm / WORLD_DISTANCE_SCALE
  const shifted = {
    x: position.x + (dy / length) * offset,
    y: position.y - (dx / length) * offset,
  }

  return isPointOnLand([shifted.x, shifted.y]) ? keepPositionAtSea(position) : shifted
}

function interpolatePosition(from: Position2D, to: Position2D, progress: number, laneOffsetKm: number): Position2D {
  const x = from.x + (to.x - from.x) * progress
  const y = from.y + (to.y - from.y) * progress
  return applyLaneOffset({ x, y }, from, to, laneOffsetKm)
}

function interpolatePath(
  path: Position2D[],
  segmentDistancesKm: number[],
  progress: number,
  laneOffsetKm: number,
): { position: Position2D; heading: number } {
  if (path.length < 2) {
    const fallback = path[0] ?? { x: 0, y: 0 }
    return { position: fallback, heading: 0 }
  }

  const totalDistance = getPathDistance(segmentDistancesKm)
  let remainingDistance = Math.max(0, Math.min(1, progress)) * totalDistance

  for (let i = 0; i < segmentDistancesKm.length; i++) {
    const segmentDistance = segmentDistancesKm[i]!
    if (remainingDistance <= segmentDistance || i === segmentDistancesKm.length - 1) {
      const segmentProgress = segmentDistance <= 0 ? 1 : remainingDistance / segmentDistance
      const from = path[i]!
      const to = path[i + 1]!
      return {
        position: interpolatePosition(from, to, segmentProgress, laneOffsetKm),
        heading: getHeading(from, to),
      }
    }

    remainingDistance -= segmentDistance
  }

  const last = path[path.length - 1]!
  const previous = path[path.length - 2]!
  return { position: last, heading: getHeading(previous, last) }
}

function getFleetCacheKey(fleet: NpcFleetDefinition, routePorts: Port[]): string {
  const portSignature = routePorts
    .map((port) => `${port.id}:${port.position.x.toFixed(3)},${port.position.y.toFixed(3)}`)
    .join('|')
  return `${fleet.id}:${fleet.speedKnots}:${fleet.routePortIds.join('>')}:${portSignature}`
}

function buildLegs(fleet: NpcFleetDefinition, ports: Port[]): NpcFleetLeg[] {
  const portById = new Map<string, Port>(ports.map((port) => [port.id, port]))
  const routePorts = fleet.routePortIds
    .map((portId) => portById.get(portId))
    .filter((port): port is Port => Boolean(port))

  if (routePorts.length < 2) return []

  const cacheKey = getFleetCacheKey(fleet, routePorts)
  const cachedLegs = fleetLegsCache.get(cacheKey)
  if (cachedLegs) return cachedLegs

  const shouldLoopToStart = routePorts[0]?.id !== routePorts[routePorts.length - 1]?.id
  const legCount = shouldLoopToStart ? routePorts.length : routePorts.length - 1

  const legs = Array.from({ length: legCount }, (_, index) => {
    const from = routePorts[index]!
    const to = routePorts[(index + 1) % routePorts.length]!
    const path = findSeaRoutePath(getPortRouteAnchor(from), getPortRouteAnchor(to))
    const segmentDistancesKm = getPathSegmentDistances(path)
    const routeDistanceKm = Math.max(1, getPathDistance(segmentDistancesKm))
    const dailyDistance = Math.max(2.5, fleet.speedKnots * SUSTAINED_ROUTE_SPEED_FACTOR) * KM_PER_KNOT_DAY
    return {
      from,
      to,
      path,
      segmentDistancesKm,
      distanceKm: routeDistanceKm,
      travelDays: Math.max(0.5, routeDistanceKm / dailyDistance),
    }
  })

  fleetLegsCache.set(cacheKey, legs)
  return legs
}

export function getNpcFleetSnapshot(
  fleet: NpcFleetDefinition,
  ports: Port[],
  totalDays: number,
): NpcFleetSnapshot | null {
  const legs = buildLegs(fleet, ports)
  if (legs.length === 0) return null

  const cycleDays = legs.reduce((sum, leg) => sum + leg.travelDays + fleet.dwellDays, 0)
  if (cycleDays <= 0) return null

  let localDay = (totalDays + fleet.departureOffsetDays) % cycleDays
  if (localDay < 0) localDay += cycleDays

  for (const leg of legs) {
    if (localDay <= leg.travelDays) {
      const progress = Math.max(0, Math.min(1, localDay / leg.travelDays))
      const pathPosition = interpolatePath(leg.path, leg.segmentDistancesKm, progress, fleet.laneOffsetKm)
      return {
        definition: fleet,
        position: pathPosition.position,
        heading: pathPosition.heading,
        fromPortId: leg.from.id as PortId,
        toPortId: leg.to.id as PortId,
        segmentProgress: progress,
        cycleProgress: (totalDays + fleet.departureOffsetDays) / cycleDays,
        distanceKm: leg.distanceKm,
        inPort: false,
      }
    }

    localDay -= leg.travelDays
    if (localDay <= fleet.dwellDays) {
      const previous = leg.path[leg.path.length - 2] ?? leg.from.position
      const destination = leg.path[leg.path.length - 1] ?? leg.to.position
      return {
        definition: fleet,
        position: leg.to.position,
        heading: getHeading(previous, destination),
        fromPortId: leg.from.id as PortId,
        toPortId: leg.to.id as PortId,
        segmentProgress: 1,
        cycleProgress: (totalDays + fleet.departureOffsetDays) / cycleDays,
        distanceKm: leg.distanceKm,
        inPort: true,
      }
    }

    localDay -= fleet.dwellDays
  }

  return null
}

export function getNpcFleetSnapshots(
  fleets: NpcFleetDefinition[],
  ports: Port[],
  totalDays: number,
): NpcFleetSnapshot[] {
  return fleets
    .map((fleet) => getNpcFleetSnapshot(fleet, ports, totalDays))
    .filter((snapshot): snapshot is NpcFleetSnapshot => Boolean(snapshot))
}

export function getNearbyNpcFleetSnapshots(
  fleets: NpcFleetDefinition[],
  ports: Port[],
  totalDays: number,
  center: Position2D,
  radiusKm: number,
): NpcFleetSnapshot[] {
  return getNpcFleetSnapshots(fleets, ports, totalDays)
    .filter((snapshot) => distanceKm(snapshot.position, center) <= radiusKm)
}
