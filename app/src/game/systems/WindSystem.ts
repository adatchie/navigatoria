// ============================================================
// WindSystem — 風向・風速計算
// ============================================================

import type { GameSystem } from '@/game/GameLoop.ts'
import { useNavigationStore } from '@/stores/useNavigationStore.ts'
import { useWorldStore } from '@/stores/useWorldStore.ts'
import { useGameStore } from '@/stores/useGameStore.ts'
import { getZoneAtPosition } from '@/game/world/queries.ts'

export class WindSystem implements GameSystem {
  name = 'WindSystem'
  priority = 5 // Navigationより先に更新

  update(_deltaTime: number): void {
    const worldStore = useWorldStore.getState()
    const navigationStore = useNavigationStore.getState()
    const { gameTime } = useGameStore.getState()
    const zone = getZoneAtPosition(navigationStore.position, worldStore.zones)

    if (!zone) return

    const season = gameTime.getSeason()
    const dayOfYear = gameTime.getDayOfYear()
    const seasonalWind = zone.baseWind[season]
    const drift = Math.sin(dayOfYear / 7) * 8
    const gust = Math.cos(dayOfYear / 5) * 1.5
    const direction = (seasonalWind.direction + drift + 360) % 360
    const speed = Math.max(1, seasonalWind.speed + gust)

    navigationStore.setWind({ direction, speed })
    worldStore.setGlobalWind({ direction, speed })
    worldStore.setSeason(season)
  }
}
