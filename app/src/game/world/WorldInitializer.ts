import { buildZonesFromPorts } from './zones.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { createPortId } from '@/types/common.ts'

export function initializeWorld(): void {
  const { ports } = useDataStore.getState().masterData
  const worldStore = useWorldStore.getState()
  const navigationStore = useNavigationStore.getState()

  worldStore.setPorts(ports)
  worldStore.setZones(buildZonesFromPorts(ports))
  worldStore.setLoaded(true)

  const currentPort = ports.find((port) => port.id === 'lisbon') ?? ports[0]
  if (!currentPort) return

  navigationStore.setPosition(currentPort.position)
  navigationStore.setSailRatio(0)
  navigationStore.setDockedPort(createPortId(currentPort.id))
  navigationStore.setMode('docked')
}
