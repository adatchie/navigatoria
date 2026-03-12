// ============================================================
// GameLoop — requestAnimationFrame + 固定タイムステップ
// Subscriberパターンでシステムを登録・順次呼出し
// ============================================================

import { LOOP_CONFIG } from '@/config/gameConfig.ts'

/** ゲームシステムのインターフェース */
export interface GameSystem {
  /** システム名 (デバッグ用) */
  name: string
  /** 固定タイムステップで呼ばれる更新処理 */
  update(deltaTime: number): void
  /** 優先度 (小さい方が先に実行) */
  priority?: number
}

/** フレーム統計情報 */
export interface FrameStats {
  fps: number
  frameTime: number
  updateCount: number
  drawTime: number
}

export class GameLoop {
  private _systems: GameSystem[] = []
  private _running = false
  private _animFrameId: number | null = null
  private _lastTime = 0
  private _accumulator = 0
  private _frameCount = 0
  private _fpsTimer = 0
  private _stats: FrameStats = { fps: 0, frameTime: 0, updateCount: 0, drawTime: 0 }

  /** レンダリングコールバック (React Three Fiberが管理するため外部から設定) */
  onRender?: (deltaTime: number) => void

  /** フレーム統計更新コールバック */
  onStatsUpdate?: (stats: FrameStats) => void

  /** システムを登録 */
  addSystem(system: GameSystem): void {
    this._systems.push(system)
    this._systems.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
  }

  /** システムを削除 */
  removeSystem(name: string): void {
    this._systems = this._systems.filter((s) => s.name !== name)
  }

  /** 登録済みシステム一覧 */
  getSystems(): readonly GameSystem[] {
    return this._systems
  }

  /** ループ開始 */
  start(): void {
    if (this._running) return
    this._running = true
    this._lastTime = performance.now()
    this._accumulator = 0
    this._tick(performance.now())
  }

  /** ループ停止 */
  stop(): void {
    this._running = false
    if (this._animFrameId !== null) {
      cancelAnimationFrame(this._animFrameId)
      this._animFrameId = null
    }
  }

  /** ループ中かどうか */
  get running(): boolean {
    return this._running
  }

  /** 最新のフレーム統計 */
  get stats(): FrameStats {
    return this._stats
  }

  /** 1ステップだけ手動実行 (デバッグ用) */
  stepOnce(): void {
    const dt = LOOP_CONFIG.FIXED_TIMESTEP / 1000
    for (const system of this._systems) {
      system.update(dt)
    }
  }

  private _tick = (now: number): void => {
    if (!this._running) return

    const frameStart = performance.now()
    const elapsed = now - this._lastTime
    this._lastTime = now

    // 異常に長いフレーム (タブが非アクティブだった場合等) をクランプ
    const clampedElapsed = Math.min(elapsed, LOOP_CONFIG.FIXED_TIMESTEP * LOOP_CONFIG.MAX_FRAME_SKIP)
    this._accumulator += clampedElapsed

    let updateCount = 0
    const fixedDt = LOOP_CONFIG.FIXED_TIMESTEP / 1000 // 秒に変換

    // 固定タイムステップで更新
    while (this._accumulator >= LOOP_CONFIG.FIXED_TIMESTEP && updateCount < LOOP_CONFIG.MAX_FRAME_SKIP) {
      for (const system of this._systems) {
        system.update(fixedDt)
      }
      this._accumulator -= LOOP_CONFIG.FIXED_TIMESTEP
      updateCount++
    }

    // レンダリングコールバック
    this.onRender?.(elapsed / 1000)

    // FPS計算
    const frameEnd = performance.now()
    this._frameCount++
    this._fpsTimer += frameEnd - frameStart

    if (this._fpsTimer >= 1000) {
      this._stats = {
        fps: this._frameCount,
        frameTime: this._fpsTimer / this._frameCount,
        updateCount,
        drawTime: frameEnd - frameStart,
      }
      this.onStatsUpdate?.(this._stats)
      this._frameCount = 0
      this._fpsTimer = 0
    }

    this._animFrameId = requestAnimationFrame(this._tick)
  }
}

/** シングルトンインスタンス */
export const gameLoop = new GameLoop()
