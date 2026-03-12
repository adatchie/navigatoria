// Sail vertex shader [STUB] — 帆の風アニメーション (Phase 1で完成)
// 頂点のY座標に応じた膨らみ + フラッターを実現

uniform float uTime;
uniform float uWindStrength;   // 風の強さ (0-1)
uniform vec2 uWindDirection;   // 風向き (正規化済み)

varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vNormal = normalMatrix * normal;

  vec3 pos = position;

  // 風による膨らみ (Y座標の中央付近が最大)
  float bulge = sin(uv.y * 3.14159) * uWindStrength * 0.3;
  pos += normal * bulge;

  // フラッター (上部がより揺れる)
  float flutter = sin(uTime * 3.0 + uv.y * 5.0) * uv.y * uWindStrength * 0.05;
  pos += normal * flutter;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
