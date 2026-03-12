// ============================================================
// GameTime — ゲーム内時間管理
// 1ゲーム日 = 120リアル秒 (デフォルト)
// ============================================================

import { TIME_CONFIG } from '@/config/gameConfig.ts'
import type { GameTimeState, GameSpeed } from '@/types/common.ts'
import type { Season } from '@/types/world.ts'

export class GameTime {
  private _totalGameSeconds = 0
  private _speed: GameSpeed = 1
  private _paused = false

  /** リアル秒 → ゲーム秒の変換係数 */
  private get _timeScale(): number {
    if (this._paused) return 0
    // 1ゲーム日(86400ゲーム秒) = 120リアル秒
    // → 1リアル秒 = 720ゲーム秒
    const baseScale = 86400 / TIME_CONFIG.REAL_SECONDS_PER_GAME_DAY
    return baseScale * this._speed
  }

  /** リアルタイムのdeltaTime(秒)でゲーム時間を進める */
  update(realDeltaSeconds: number): void {
    this._totalGameSeconds += realDeltaSeconds * this._timeScale
  }

  /** 現在のゲーム時間状態を取得 */
  getState(): GameTimeState {
    const totalDays = Math.floor(this._totalGameSeconds / 86400)
    const hour = (this._totalGameSeconds % 86400) / 3600

    // 年月日計算
    let remainingDays = totalDays
    let year = TIME_CONFIG.START_YEAR
    let month = TIME_CONFIG.START_MONTH - 1 // 0-indexed
    let day = TIME_CONFIG.START_DAY - 1

    remainingDays += day
    month += 0

    while (remainingDays > 0) {
      const daysInMonth = TIME_CONFIG.DAYS_PER_MONTH[month]!
      if (remainingDays < daysInMonth) {
        break
      }
      remainingDays -= daysInMonth
      month++
      if (month >= 12) {
        month = 0
        year++
      }
    }

    return {
      totalDays,
      hour,
      year,
      month: month + 1,
      day: remainingDays + 1,
    }
  }

  /** 年間通算日 (1-365) */
  getDayOfYear(): number {
    const state = this.getState()
    let dayOfYear = state.day
    for (let i = 0; i < state.month - 1; i++) {
      dayOfYear += TIME_CONFIG.DAYS_PER_MONTH[i]!
    }
    return dayOfYear
  }

  /** 現在の季節 */
  getSeason(): Season {
    const dayOfYear = this.getDayOfYear()
    if (dayOfYear < 80 || dayOfYear >= 355) return 'winter'
    if (dayOfYear < 172) return 'spring'
    if (dayOfYear < 264) return 'summer'
    return 'autumn'
  }

  /** 速度設定 */
  get speed(): GameSpeed {
    return this._speed
  }
  set speed(value: GameSpeed) {
    this._speed = value
  }

  get paused(): boolean {
    return this._paused
  }
  set paused(value: boolean) {
    this._paused = value
  }

  /** 総ゲーム秒 */
  get totalGameSeconds(): number {
    return this._totalGameSeconds
  }

  /** 指定日数分スキップ */
  skipDays(days: number): void {
    this._totalGameSeconds += days * 86400
  }

  /** 指定時間にセット */
  setHour(hour: number): void {
    const wholeDays = Math.floor(this._totalGameSeconds / 86400)
    this._totalGameSeconds = wholeDays * 86400 + hour * 3600
  }

  /** セーブ/ロード用 */
  serialize(): number {
    return this._totalGameSeconds
  }
  deserialize(totalSeconds: number): void {
    this._totalGameSeconds = totalSeconds
  }
}
