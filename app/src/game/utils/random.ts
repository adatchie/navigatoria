// ============================================================
// シード付き擬似乱数生成器 (Mulberry32)
// セーブ/ロード時に同じシードで再現可能
// ============================================================

export class SeededRandom {
  private _seed: number

  constructor(seed?: number) {
    this._seed = seed ?? Math.floor(Math.random() * 2147483647)
  }

  /** 0.0 - 1.0 の乱数 */
  next(): number {
    // Mulberry32
    let t = (this._seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** min以上max未満の整数乱数 */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min
  }

  /** min以上max以下の浮動小数乱数 */
  float(min: number, max: number): number {
    return this.next() * (max - min) + min
  }

  /** 配列からランダムに1要素選択 */
  pick<T>(array: readonly T[]): T {
    return array[this.int(0, array.length)]!
  }

  /** 配列をシャッフル (Fisher-Yates) */
  shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i + 1)
      ;[result[i], result[j]] = [result[j]!, result[i]!]
    }
    return result
  }

  /** 確率判定 (0.0-1.0) */
  chance(probability: number): boolean {
    return this.next() < probability
  }

  /** 現在のシード値 (セーブ用) */
  get seed(): number {
    return this._seed
  }
  set seed(value: number) {
    this._seed = value
  }
}

/** グローバル乱数インスタンス */
export const globalRandom = new SeededRandom()
