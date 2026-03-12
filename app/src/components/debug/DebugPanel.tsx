// ============================================================
// DebugPanel — leva統合デバッグパネル
// ============================================================

import { useControls, button } from 'leva'
import { useGameStore } from '@/stores/useGameStore.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useUIStore } from '@/stores/useUIStore.ts'
import { useDataStore } from '@/stores/useDataStore.ts'
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
  const { toggleDebugFlag, debugFlags } = useUIStore()

  // ゲーム時間制御
  useControls('Game Time', {
    info: {
      value: `${timeState.year}/${timeState.month}/${timeState.day} ${Math.floor(timeState.hour)}:${String(Math.floor((timeState.hour % 1) * 60)).padStart(2, '0')}`,
      editable: false,
    },
    day: { value: timeState.totalDays, editable: false },
    speed: {
      value: speed,
      options: { 'Pause': 0, '0.5x': 0.5, '1x': 1, '2x': 2, '4x': 4 },
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

  // 航海情報
  useControls('Navigation', {
    position: { value: `(${position.x.toFixed(1)}, ${position.y.toFixed(1)})`, editable: false },
    wind: { value: `${wind.direction.toFixed(0)}° / ${wind.speed.toFixed(1)}kt`, editable: false },
  })

  // マスタデータ情報
  useControls('Master Data', {
    version: { value: version, editable: false },
    ships: { value: masterData.ships.length, editable: false },
    ports: { value: masterData.ports.length, editable: false },
    tradeGoods: { value: masterData.tradeGoods.length, editable: false },
    skills: { value: masterData.skills.length, editable: false },
  })

  // 表示フラグ
  useControls('Display', {
    wireframe: {
      value: debugFlags.wireframe,
      onChange: () => toggleDebugFlag('wireframe'),
    },
    showFPS: {
      value: debugFlags.showFPS,
      onChange: () => toggleDebugFlag('showFPS'),
    },
      showPortMarkers: {
        value: debugFlags.showPortMarkers,
        onChange: () => toggleDebugFlag('showPortMarkers'),
      },
      showWindArrows: {
        value: debugFlags.showWindArrows,
        onChange: () => toggleDebugFlag('showWindArrows'),
      },
  })

  return null // levaはグローバルにパネルを表示する
}
