import { createRef, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Group,
  type Material,
} from 'three'
import { NPC_FLEETS } from '@/data/master/npcFleets.ts'
import { getNpcFleetSnapshots } from '@/game/world/npcFleetSimulation.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { worldToScene } from '@/rendering/worldTransform.ts'
import type { Nationality } from '@/types/character.ts'
import type { NpcFleetRole } from '@/types/npcFleet.ts'

interface NpcFleetPart {
  geometry: BoxGeometry | CylinderGeometry | PlaneGeometry
  material: Material
  position: [number, number, number]
  rotation?: [number, number, number]
}

const HULL_GEOMETRY = new BoxGeometry(0.42, 0.22, 1.75)
const BOW_GEOMETRY = new BoxGeometry(0.32, 0.16, 0.5)
const MAST_GEOMETRY = new CylinderGeometry(0.015, 0.02, 1.55, 6)
const SAIL_GEOMETRY = new PlaneGeometry(0.8, 0.95)
const WAKE_GEOMETRY = new PlaneGeometry(0.62, 2.2)

const NATIONALITY_COLORS: Record<Nationality, number> = {
  portugal: 0x34d399,
  spain: 0xf97316,
  england: 0x60a5fa,
  netherlands: 0xfacc15,
  france: 0xa78bfa,
  venice: 0xf87171,
  ottoman: 0x22c55e,
}

const ROLE_SCALE: Record<NpcFleetRole, number> = {
  merchant: 1.05,
  naval: 1.12,
  privateer: 1.02,
  corsair: 0.92,
  explorer: 0.98,
  smuggler: 0.88,
}

const HULL_MATERIALS = new Map<Nationality, MeshStandardMaterial>()
const FLAG_MATERIALS = new Map<Nationality, MeshBasicMaterial>()
const SAIL_MATERIAL = new MeshStandardMaterial({ color: 0xf6ead2, roughness: 0.9, side: DoubleSide })
const WAKE_MATERIAL = new MeshBasicMaterial({ color: 0xcffafe, transparent: true, opacity: 0.26, depthWrite: false, side: DoubleSide })
const MAST_MATERIAL = new MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.86 })

function getHullMaterial(nationality: Nationality): MeshStandardMaterial {
  const cached = HULL_MATERIALS.get(nationality)
  if (cached) return cached

  const material = new MeshStandardMaterial({
    color: NATIONALITY_COLORS[nationality],
    roughness: 0.76,
    metalness: 0.03,
  })
  HULL_MATERIALS.set(nationality, material)
  return material
}

function getFlagMaterial(nationality: Nationality): MeshBasicMaterial {
  const cached = FLAG_MATERIALS.get(nationality)
  if (cached) return cached

  const material = new MeshBasicMaterial({ color: NATIONALITY_COLORS[nationality], side: DoubleSide })
  FLAG_MATERIALS.set(nationality, material)
  return material
}

function buildFleetParts(nationality: Nationality): NpcFleetPart[] {
  return [
    { geometry: WAKE_GEOMETRY, material: WAKE_MATERIAL, position: [0, 0.02, -1.34], rotation: [-Math.PI / 2, 0, 0] },
    { geometry: HULL_GEOMETRY, material: getHullMaterial(nationality), position: [0, 0.19, 0] },
    { geometry: BOW_GEOMETRY, material: getHullMaterial(nationality), position: [0, 0.23, 1.08], rotation: [0.22, 0, 0] },
    { geometry: MAST_GEOMETRY, material: MAST_MATERIAL, position: [0, 0.98, 0.12] },
    { geometry: SAIL_GEOMETRY, material: SAIL_MATERIAL, position: [0, 1.08, 0.16] },
    { geometry: SAIL_GEOMETRY, material: getFlagMaterial(nationality), position: [0.2, 1.54, -0.08], rotation: [0, Math.PI / 2, 0] },
  ]
}

export function NpcFleetRenderer() {
  const fleetRefs = useMemo(
    () => Array.from({ length: NPC_FLEETS.length }, () => createRef<Group>()),
    [],
  )

  useFrame((state) => {
    const ports = useWorldStore.getState().ports
    if (ports.length === 0) return

    const totalDays = useGameStore.getState().timeState.totalDays
    const snapshots = getNpcFleetSnapshots(NPC_FLEETS, ports, totalDays)
    const elapsed = state.clock.elapsedTime

    for (let index = 0; index < fleetRefs.length; index += 1) {
      const group = fleetRefs[index]?.current
      if (!group) continue

      const snapshot = snapshots[index]
      if (!snapshot || snapshot.inPort) {
        group.position.set(0, -10000, 0)
        group.scale.setScalar(0.0001)
        continue
      }

      const [x, y, z] = worldToScene(snapshot.position)
      const fleetScale = ROLE_SCALE[snapshot.definition.role] ?? 1
      group.position.set(x, y + 0.34 + Math.sin(elapsed * 1.1 + index) * 0.035, z)
      group.rotation.set(0, (-snapshot.heading * Math.PI) / 180, 0)
      group.scale.setScalar(fleetScale)
    }
  })

  return (
    <group>
      {NPC_FLEETS.map((fleet, fleetIndex) => (
        <group key={fleet.id} ref={fleetRefs[fleetIndex]}>
          {buildFleetParts(fleet.nationality).map((part, partIndex) => (
            <mesh
              key={`${fleet.id}-${partIndex}`}
              geometry={part.geometry}
              material={part.material}
              position={part.position}
              rotation={part.rotation}
              renderOrder={3}
            />
          ))}
          <Html position={[0, 2.1, 0]} center distanceFactor={34} style={styles.label}>
            <div style={styles.labelInner}>
              <strong>{fleet.commander}</strong>
              <span>{fleet.name}</span>
            </div>
          </Html>
        </group>
      ))}
    </group>
  )
}

const styles = {
  label: {
    pointerEvents: 'none',
  },
  labelInner: {
    display: 'grid',
    gap: 2,
    minWidth: 124,
    padding: '5px 7px',
    borderRadius: 8,
    background: 'rgba(2, 8, 23, 0.62)',
    border: '1px solid rgba(191, 219, 254, 0.22)',
    color: '#dbeafe',
    fontSize: 10,
    lineHeight: 1.2,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    textShadow: '0 1px 4px #000',
  },
} satisfies Record<string, CSSProperties>
