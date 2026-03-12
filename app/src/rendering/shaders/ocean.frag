// Ocean fragment shader — 海面の色と反射
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uFresnelPower;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vWaveDetail;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);

  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), uFresnelPower);
  vec3 baseColor = mix(uDeepColor, uShallowColor, fresnel);

  vec3 sunDir = normalize(uSunDirection);
  vec3 halfDir = normalize(sunDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), mix(96.0, 256.0, vWaveDetail));
  vec3 specular = uSunColor * spec * mix(0.35, 0.8, vWaveDetail);

  float diffuse = max(dot(normal, sunDir), 0.0) * 0.3 + 0.4;
  vec3 finalColor = baseColor * diffuse + specular;

  float foam = smoothstep(0.62, 0.84, normal.y + sin(vWorldPosition.x * 3.0 + uTime) * 0.1);
  finalColor = mix(finalColor, vec3(1.0), foam * 0.1 * vWaveDetail);

  gl_FragColor = vec4(finalColor, 0.92);
}
