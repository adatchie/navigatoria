// ============================================================
// AssetLoader — GLB/テクスチャの非同期ロード + LRUキャッシュ
// ============================================================

import { Mesh, Texture, TextureLoader } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'

interface CacheEntry<T> {
  data: T
  lastAccess: number
  size: number
}

interface AssetLoaderConfig {
  maxCacheSize: number
  maxEntries: number
}

const DEFAULT_CONFIG: AssetLoaderConfig = {
  maxCacheSize: 256 * 1024 * 1024,
  maxEntries: 100,
}

class AssetLoaderImpl {
  private _gltfLoader = new GLTFLoader()
  private _textureLoader = new TextureLoader()
  private _gltfCache = new Map<string, CacheEntry<GLTF>>()
  private _textureCache = new Map<string, CacheEntry<Texture>>()
  private _loadingPromises = new Map<string, Promise<unknown>>()
  private _config: AssetLoaderConfig

  constructor(config: Partial<AssetLoaderConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config }
  }

  async loadGLTF(url: string): Promise<GLTF> {
    const cached = this._gltfCache.get(url)
    if (cached) {
      cached.lastAccess = Date.now()
      return cached.data
    }

    const existing = this._loadingPromises.get(url)
    if (existing) return existing as Promise<GLTF>

    const promise = new Promise<GLTF>((resolve, reject) => {
      this._gltfLoader.load(
        url,
        (gltf) => {
          this._gltfCache.set(url, {
            data: gltf,
            lastAccess: Date.now(),
            size: this._estimateGLTFSize(gltf),
          })
          this._evictIfNeeded(this._gltfCache)
          this._loadingPromises.delete(url)
          console.log(`[AssetLoader] Loaded GLTF: ${url}`)
          resolve(gltf)
        },
        undefined,
        (error) => {
          this._loadingPromises.delete(url)
          console.error(`[AssetLoader] Failed to load GLTF: ${url}`, error)
          reject(error)
        },
      )
    })

    this._loadingPromises.set(url, promise)
    return promise
  }

  async loadTexture(url: string): Promise<Texture> {
    const cached = this._textureCache.get(url)
    if (cached) {
      cached.lastAccess = Date.now()
      return cached.data
    }

    const existing = this._loadingPromises.get(url)
    if (existing) return existing as Promise<Texture>

    const promise = new Promise<Texture>((resolve, reject) => {
      this._textureLoader.load(
        url,
        (texture) => {
          this._textureCache.set(url, {
            data: texture,
            lastAccess: Date.now(),
            size: this._estimateTextureSize(texture),
          })
          this._evictIfNeeded(this._textureCache)
          this._loadingPromises.delete(url)
          resolve(texture)
        },
        undefined,
        (error) => {
          this._loadingPromises.delete(url)
          reject(error)
        },
      )
    })

    this._loadingPromises.set(url, promise)
    return promise
  }

  clearCache(): void {
    this._gltfCache.clear()
    this._textureCache.clear()
    console.log('[AssetLoader] Cache cleared')
  }

  getCacheStats(): { gltfCount: number; textureCount: number; totalSize: number } {
    let totalSize = 0
    for (const entry of this._gltfCache.values()) totalSize += entry.size
    for (const entry of this._textureCache.values()) totalSize += entry.size
    return {
      gltfCount: this._gltfCache.size,
      textureCount: this._textureCache.size,
      totalSize,
    }
  }

  private _evictIfNeeded<T>(cache: Map<string, CacheEntry<T>>): void {
    while (cache.size > this._config.maxEntries) {
      let oldestKey = ''
      let oldestTime = Infinity
      for (const [key, entry] of cache) {
        if (entry.lastAccess < oldestTime) {
          oldestTime = entry.lastAccess
          oldestKey = key
        }
      }
      if (oldestKey) {
        cache.delete(oldestKey)
        console.log(`[AssetLoader] Evicted: ${oldestKey}`)
      }
    }
  }

  private _estimateGLTFSize(gltf: GLTF): number {
    let size = 0
    gltf.scene.traverse((child) => {
      if (child instanceof Mesh) {
        const geo = child.geometry
        if (geo.attributes.position) {
          size += geo.attributes.position.array.byteLength
        }
        if (geo.attributes.normal) {
          size += geo.attributes.normal.array.byteLength
        }
        if (geo.attributes.uv) {
          size += geo.attributes.uv.array.byteLength
        }
      }
    })
    return size || 1024 * 100
  }

  private _estimateTextureSize(texture: Texture): number {
    const image = texture.image as { width?: number; height?: number } | undefined
    if (image && image.width && image.height) {
      return image.width * image.height * 4
    }
    return 1024 * 256
  }
}

export const assetLoader = new AssetLoaderImpl()
