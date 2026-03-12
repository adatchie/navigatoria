// Ocean vertex shader — Gerstner波による海面変形
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveFrequency;
uniform vec2 uWindDirection;
uniform float uLodNear;
uniform float uLodFar;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vWaveDetail;

vec3 gerstnerWave(vec2 pos, float time, vec2 dir, float freq, float amp, float steepness) {
  float phase = dot(dir, pos) * freq + time;
  float sinP = sin(phase);
  float cosP = cos(phase);

  vec3 offset;
  offset.x = steepness * amp * dir.x * cosP;
  offset.z = steepness * amp * dir.y * cosP;
  offset.y = amp * sinP;
  return offset;
}

float getWaveDetail(vec3 worldPos) {
  float cameraDistance = distance(worldPos.xz, cameraPosition.xz);
  return 1.0 - smoothstep(uLodNear, uLodFar, cameraDistance);
}

void main() {
  vUv = uv;
  vec3 pos = position;
  vec3 baseWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  vWaveDetail = getWaveDetail(baseWorldPosition);

  vec2 windDir = normalize(uWindDirection);
  vec2 crossDir = vec2(-windDir.y, windDir.x);

  pos += gerstnerWave(pos.xz, uTime * 0.8, windDir, uWaveFrequency, uWaveHeight, 0.4);

  if (vWaveDetail > 0.05) {
    pos += gerstnerWave(
      pos.xz,
      uTime * 1.1,
      normalize(windDir + crossDir),
      uWaveFrequency * mix(1.05, 1.5, vWaveDetail),
      uWaveHeight * 0.5 * vWaveDetail,
      0.3 * vWaveDetail
    );
  }

  if (vWaveDetail > 0.35) {
    pos += gerstnerWave(
      pos.xz,
      uTime * 1.5,
      crossDir,
      uWaveFrequency * 3.0,
      uWaveHeight * 0.15 * vWaveDetail,
      0.2 * vWaveDetail
    );
  }

  vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;

  float eps = mix(0.24, 0.1, vWaveDetail);
  vec3 posR = position + vec3(eps, 0.0, 0.0);
  vec3 posF = position + vec3(0.0, 0.0, eps);

  posR += gerstnerWave(posR.xz, uTime * 0.8, windDir, uWaveFrequency, uWaveHeight, 0.4);
  posF += gerstnerWave(posF.xz, uTime * 0.8, windDir, uWaveFrequency, uWaveHeight, 0.4);

  if (vWaveDetail > 0.05) {
    vec2 diagonalDir = normalize(windDir + crossDir);
    posR += gerstnerWave(posR.xz, uTime * 1.1, diagonalDir, uWaveFrequency * mix(1.05, 1.5, vWaveDetail), uWaveHeight * 0.5 * vWaveDetail, 0.3 * vWaveDetail);
    posF += gerstnerWave(posF.xz, uTime * 1.1, diagonalDir, uWaveFrequency * mix(1.05, 1.5, vWaveDetail), uWaveHeight * 0.5 * vWaveDetail, 0.3 * vWaveDetail);
  }

  if (vWaveDetail > 0.35) {
    posR += gerstnerWave(posR.xz, uTime * 1.5, crossDir, uWaveFrequency * 3.0, uWaveHeight * 0.15 * vWaveDetail, 0.2 * vWaveDetail);
    posF += gerstnerWave(posF.xz, uTime * 1.5, crossDir, uWaveFrequency * 3.0, uWaveHeight * 0.15 * vWaveDetail, 0.2 * vWaveDetail);
  }

  vec3 tangent = normalize(posR - pos);
  vec3 bitangent = normalize(posF - pos);
  vNormal = normalize(cross(bitangent, tangent));

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
