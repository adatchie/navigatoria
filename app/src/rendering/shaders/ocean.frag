// Ocean fragment shader — 海面の色と反射
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uFresnelPower;
uniform float uFoamStrength;
uniform float uWindIntensity;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vWaveDetail;
varying float vFoam;
varying float vWaveHeight;

float sparkleNoise(vec2 p) {
  float waveA = sin(p.x * 3.7 + p.y * 1.9 + uTime * 1.5);
  float waveB = sin(p.x * -1.6 + p.y * 4.8 - uTime * 1.1);
  return waveA * waveB * 0.5 + 0.5;
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);

  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), uFresnelPower);
  float heightTint = smoothstep(-0.4, 1.4, vWaveHeight);
  vec3 troughColor = uDeepColor * 0.72;
  vec3 crestColor = mix(uDeepColor, uShallowColor, 0.68);
  vec3 baseColor = mix(troughColor, crestColor, heightTint);
  baseColor = mix(baseColor, uShallowColor, fresnel * 0.72);

  vec3 sunDir = normalize(uSunDirection);
  vec3 halfDir = normalize(sunDir + viewDir);
  float specPower = mix(72.0, 360.0, vWaveDetail);
  float spec = pow(max(dot(normal, halfDir), 0.0), specPower);
  float glint = pow(max(dot(reflect(-sunDir, normal), viewDir), 0.0), mix(180.0, 680.0, vWaveDetail));
  float sparkle = smoothstep(0.78, 0.97, sparkleNoise(vWorldPosition.xz)) * vWaveDetail;
  vec3 specular = uSunColor * (spec * mix(0.22, 0.82, vWaveDetail) + glint * sparkle * 1.35);

  float diffuse = max(dot(normal, sunDir), 0.0) * 0.32 + 0.42;
  vec3 finalColor = baseColor * diffuse + specular;

  float foam = smoothstep(0.32, 0.88, vFoam) * uFoamStrength * mix(0.32, 1.0, uWindIntensity);
  finalColor = mix(finalColor, vec3(0.92, 0.98, 1.0), foam * 0.48);

  gl_FragColor = vec4(finalColor, mix(0.9, 0.96, vWaveDetail));
}
