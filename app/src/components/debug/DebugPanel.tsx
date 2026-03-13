// ============================================================
// DebugPanel — leva統合デバッグパネル
// ============================================================

import { useControls, button } from 'leva'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useUIStore } from '@/stores/useUIStore.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
import { usePlayerStore } from '@/stores/usePlayerStore.ts'
import type { GameSpeed } from '@/types/common.ts'

export function DebugPanel() {
  const debugFlags = useUIStore((s) => s.debugFlags)
  const showDebugPanel = debugFlags.showDebugPanel

  if (!showDebugPanel) return null

  return <DebugPanelInner />
}

function DebugPanelInner() {
  const { setSpeed, togglePause, skipDays, setHour, timeState, speed } = useGameStore()
  const { wind, position } = useNavigationStore()
  const { masterData, version } = useDataStore()
  const { setDebugFlag, debugFlags } = useUIStore()
  const player = usePlayerStore((s) => s.player)
  const setMoney = usePlayerStore((s) => s.setMoney)
  const debugSetLevel = usePlayerStore((s) => s.debugSetLevel)

  useControls('Game Time', {
    info: {
      value: `${timeState.year}/${timeState.month}/${timeState.day} ${Math.floor(timeState.hour)}:${String(Math.floor((timeState.hour % 1) * 60)).padStart(2, '0')}`,
      editable: false,
    },
    day: { value: timeState.totalDays, editable: false },
    speed: {
      value: speed,
      options: { Pause: 0, '0.5x': 0.5, '1x': 1, '2x': 2, '4x': 4 },
      onChange: (v: GameSpeed) => setSpeed(v),
    },
    pause: button(() => togglePause(), { disabled: false }),
    'Skip 1 Day': button(() => skipDays(1)),
    'Skip 7 Days': button(() => skipDays(7)),
    'Skip 30 Days': button(() => skipDays(30)),
    'Set Morning': button(() => setHour(8)),
    'Set Noon': button(() => setHour(12)),
    'Set Evening': button(() => setHour(18)),
    'Set Night': button(() => setHour(22)),
  })

  useControls('Navigation', {
    position: { value: `(${position.x.toFixed(1)}, ${position.y.toFixed(1)})`, editable: false },
    wind: { value: `${wind.direction.toFixed(0)}° / ${wind.speed.toFixed(1)}kt`, editable: false },
  })

  useControls('Player Cheats', {
    money: {
      value: player?.money ?? 0,
      min: 0,
      max: 9999999,
      step: 100,
      onChange: (value: number) => {
        if (!player) return
        setMoney(Math.max(0, Math.floor(value)))
      },
    },
    tradeLevel: {
      value: player?.stats.tradeLevel ?? 1,
      min: 1,
      max: 75,
      step: 1,
      onChange: (value: number) => {
        if (!player) return
        debugSetLevel('trade', Math.max(1, Math.floor(value)))
      },
    },
    combatLevel: {
      value: player?.stats.combatLevel ?? 1,
      min: 1,
      max: 75,
      step: 1,
      onChange: (value: number) => {
        if (!player) return
        debugSetLevel('combat', Math.max(1, Math.floor(value)))
      },
    },
    adventureLevel: {
      value: player?.stats.adventureLevel ?? 1,
      min: 1,
      max: 75,
      step: 1,
      onChange: (value: number) => {
        if (!player) return
        debugSetLevel('adventure', Math.max(1, Math.floor(value)))
      },
    },
    'Money +10k': button(() => {
      if (!player) return
      setMoney(player.money + 10000)
    }),
    'Money 500k': button(() => setMoney(500000)),
    'All Lv 10': button(() => {
      debugSetLevel('trade', 10)
      debugSetLevel('combat', 10)
      debugSetLevel('adventure', 10)
    }),
    'All Lv 30': button(() => {
      debugSetLevel('trade', 30)
      debugSetLevel('combat', 30)
      debugSetLevel('adventure', 30)
    }),
  })

  useControls('Master Data', {
    version: { value: version, editable: false },
    ships: { value: masterData.ships.length, editable: false },
    ports: { value: masterData.ports.length, editable: false },
    tradeGoods: { value: masterData.tradeGoods.length, editable: false },
    skills: { value: masterData.skills.length, editable: false },
  })

  useControls('Display', {
    wireframe: {
      value: debugFlags.wireframe,
      onChange: (value: boolean) => setDebugFlag('wireframe', value),
    },
    showFPS: {
      value: debugFlags.showFPS,
      onChange: (value: boolean) => setDebugFlag('showFPS', value),
    },
    showPortMarkers: {
      value: debugFlags.showPortMarkers,
      onChange: (value: boolean) => setDebugFlag('showPortMarkers', value),
    },
    showWindArrows: {
      value: debugFlags.showWindArrows,
      onChange: (value: boolean) => setDebugFlag('showWindArrows', value),
    },
  })

  return null
}
