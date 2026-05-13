// Ocean fragment shader — 海面の色と反射
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform float uFresnelPower;
uniform float uFoamStrength;
uniform float uWindIntensity;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vWaveDetail;
varying float vFoam;
varying float vWaveHeight;

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
  float specPower = mix(48.0, 140.0, vWaveDetail);
  float spec = pow(max(dot(normal, halfDir), 0.0), specPower);
  vec3 specular = uSunColor * spec * mix(0.08, 0.22, vWaveDetail);

  float diffuse = max(dot(normal, sunDir), 0.0) * 0.32 + 0.42;
  vec3 finalColor = baseColor * diffuse + specular;

  float foam = smoothstep(0.32, 0.88, vFoam) * uFoamStrength * mix(0.32, 1.0, uWindIntensity);
  finalColor = mix(finalColor, vec3(0.92, 0.98, 1.0), foam * 0.48);

  gl_FragColor = vec4(finalColor, 1.0);
}
