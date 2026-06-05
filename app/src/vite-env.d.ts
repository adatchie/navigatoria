/// <reference types="vite/client" />

declare module '*.vert' {
  const value: string
  export default value
}

declare module '*.frag' {
  const value: string
  export default value
}

declare module '*.glsl' {
  const value: string
  export default value
}

declare module 'three/examples/jsm/objects/Water.js' {
  import {
    ColorRepresentation,
    Mesh,
    Texture,
    Vector3,
    type BufferGeometry,
    type Material,
    type Side,
  } from 'three'

  export interface WaterOptions {
    textureWidth?: number
    textureHeight?: number
    clipBias?: number
    alpha?: number
    time?: number
    waterNormals?: Texture | null
    sunDirection?: Vector3
    sunColor?: ColorRepresentation
    waterColor?: ColorRepresentation
    eye?: Vector3
    distortionScale?: number
    side?: Side
    fog?: boolean
  }

  export class Water extends Mesh {
    readonly isWater: true
    material: Material
    constructor(geometry: BufferGeometry, options?: WaterOptions)
  }
}
