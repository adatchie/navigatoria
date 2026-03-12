// ============================================================
// AutoSave — 一定間隔と寄港時の自動セーブ
// ============================================================

import { SaveManager } from './SaveManager.ts'
import type { GameSnapshot } from './GameState.ts'

const AUTOSAVE_PREFIX = 'AUTO'

export class AutoSave {
  private intervalId: number | null = null
  private dockSignature: string | null = null
  private readonly capture: () => GameSnapshot | null
  private readonly intervalMs: number

  constructor(capture: () => GameSnapshot | null, intervalMs = 120000) {
    this.capture = capture
    this.intervalMs = intervalMs
  }

  start(): void {
    if (this.intervalId !== null) return
    this.intervalId = window.setInterval(() => {
      void this.saveInterval()
    }, this.intervalMs)
  }

  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  async triggerDockAutoSave(portId: string): Promise<void> {
    if (this.dockSignature === portId) return
    this.dockSignature = portId
    await this.writeAutoSave(`${AUTOSAVE_PREFIX}:DOCK:${portId}`)
  }

  resetDockSignature(): void {
    this.dockSignature = null
  }

  private async saveInterval(): Promise<void> {
    await this.writeAutoSave(`${AUTOSAVE_PREFIX}:SEA`)
  }

  private async writeAutoSave(name: string): Promise<void> {
    const snapshot = this.capture()
    if (!snapshot || !snapshot.player.player) return

    const saves = await SaveManager.listSaves()
    const existing = saves.find((save) => save.name === name)
    const payload = {
      ...snapshot,
      playerName: snapshot.player.player.name,
      gameTime: snapshot.gameTime,
    }

    if (existing?.id) {
      await SaveManager.overwrite(existing.id, payload)
      return
    }

    await SaveManager.save(name, payload)
  }
}
