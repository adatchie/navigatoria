// Ocean vertex shader — Gerstner波による海面変形
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveFrequency;
uniform vec2 uWindDirection;
uniform float uDetailStrength;
uniform float uLodNear;
uniform float uLodFar;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vWaveDetail;
varying float vFoam;
varying float vWaveHeight;

vec3 gerstnerWave(vec2 pos, float time, vec2 dir, float freq, float amp, float steepness) {
  float phase = dot(dir, pos) * freq + time;
  float sinP = sin(phase);
  float cosP = cos(phase);

  vec3 offset;
  offset.x = steepness * amp * dir.x * cosP;
  offset.y = steepness * amp * dir.y * cosP;
  offset.z = amp * sinP;
  return offset;
}

float getWaveDetail(vec3 worldPos) {
  float cameraDistance = distance(worldPos.xz, cameraPosition.xz);
  return 1.0 - smoothstep(uLodNear, uLodFar, cameraDistance);
}

vec3 displaceOcean(vec3 basePos, float detail) {
  vec2 windDir = normalize(uWindDirection);
  vec2 crossDir = vec2(-windDir.y, windDir.x);
  float layerDetail = clamp(detail * uDetailStrength, 0.0, 1.0);
  float layerWave = mix(0.36, 1.0, uDetailStrength);

  vec3 pos = basePos;
  pos += gerstnerWave(basePos.xy, uTime * 0.75, windDir, uWaveFrequency, uWaveHeight * layerWave, 0.42);

  if (layerDetail > 0.04) {
    pos += gerstnerWave(
      basePos.xy,
      uTime * 1.08,
      normalize(windDir + crossDir * 0.55),
      uWaveFrequency * mix(1.15, 1.72, layerDetail),
      uWaveHeight * 0.46 * layerDetail,
      0.32 * layerDetail
    );
  }

  if (layerDetail > 0.22) {
    pos += gerstnerWave(
      basePos.xy,
      uTime * 1.85,
      normalize(crossDir - windDir * 0.28),
      uWaveFrequency * 4.8,
      uWaveHeight * 0.08 * layerDetail,
      0.16 * layerDetail
    );
  }

  return pos;
}

float getFoamAmount(vec3 displacedPos, vec3 basePos, float detail) {
  float layerDetail = clamp(detail * uDetailStrength, 0.0, 1.0);
  float normalizedHeight = displacedPos.z / max(uWaveHeight, 0.001);
  float crest = smoothstep(0.42, 0.92, normalizedHeight);
  float chop = smoothstep(0.08, 0.36, length(displacedPos.xy - basePos.xy));
  return (crest * 0.78 + chop * 0.22) * layerDetail;
}

void main() {
  vUv = uv;
  vec3 baseWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  float cameraDetail = getWaveDetail(baseWorldPosition);
  vWaveDetail = clamp(cameraDetail * uDetailStrength, 0.0, 1.0);

  vec3 pos = displaceOcean(position, cameraDetail);
  vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
  vFoam = getFoamAmount(pos, position, cameraDetail);
  vWaveHeight = pos.z;

  float eps = mix(0.62, 0.16, vWaveDetail);
  vec3 posR = displaceOcean(position + vec3(eps, 0.0, 0.0), cameraDetail);
  vec3 posF = displaceOcean(position + vec3(0.0, eps, 0.0), cameraDetail);
  vec3 tangent = normalize(posR - pos);
  vec3 bitangent = normalize(posF - pos);
  vec3 localNormal = normalize(cross(tangent, bitangent));
  vNormal = normalize(mat3(modelMatrix) * localNormal);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
