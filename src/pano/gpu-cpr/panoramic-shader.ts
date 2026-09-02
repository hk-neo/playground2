/**
 * Panoramic CPR Shader — GPU Curved Planar Reformation for dental panoramic view.
 *
 * 표준 치과 파노라마 기하:
 *   - 가로(vUv.x) = arch arc-length
 *   - 세로(vUv.y) = superior-inferior (z 머리↔턱)
 *   - 각 (u, v)에서 ray = in-plane normal(협설 N) 방향으로
 *     ±focalThickness/2 범위를 MIP/min/mean 적분.
 *
 * World coordinate system: source VolumeData voxel coords.
 *   - 3D volume texture는 (필요시) downsampled. sampling은 voxCoord / sourceDims로
 *     [0,1] 정규화 후 진행 (내부 해상도와 무관하게 전체 볼륨 커버).
 *   - format='float32' : value IS HU (u_valueToHu = (1,0))
 *   - format='uint8'   : value = (HU-huMin)/range*255 → reverse.
 */
import * as THREE from 'three';

export interface PanoramicShaderUniforms extends Record<string, THREE.IUniform> {
  u_volume: { value: THREE.Data3DTexture | null };
  u_curvePosTex: { value: THREE.DataTexture | null };
  u_curveNormTex: { value: THREE.DataTexture | null };
  u_volumeTextureDims: { value: THREE.Vector3 };  // 다운샘플된 실제 텍스처 dims
  u_volumeSourceDims: { value: THREE.Vector3 };   // 원본 world dims (z extent 등)
  u_depthMinVox: { value: number };               // 표시 z 범위 하한 (턱)
  u_depthMaxVox: { value: number };               // 표시 z 범위 상한 (머리)
  u_focalThickness: { value: number };            // 협설 방향 ray 적분 반경 (voxel)
  u_raySamples: { value: number };
  u_windowLevel: { value: number };
  u_windowWidth: { value: number };
  u_projection: { value: number };
  u_valueToHu: { value: THREE.Vector2 };          // (scale, offset) → HU = val*scale + offset
  u_hasCurve: { value: boolean };
}

export function makePanoramicMaterial(): {
  material: THREE.ShaderMaterial;
  uniforms: PanoramicShaderUniforms;
} {
  const uniforms: PanoramicShaderUniforms = {
    u_volume: { value: null },
    u_curvePosTex: { value: null },
    u_curveNormTex: { value: null },
    u_volumeTextureDims: { value: new THREE.Vector3(1, 1, 1) },
    u_volumeSourceDims: { value: new THREE.Vector3(1, 1, 1) },
    u_depthMinVox: { value: 0 },
    u_depthMaxVox: { value: 1 },
    u_focalThickness: { value: 40 },
    u_raySamples: { value: 128 },
    u_windowLevel: { value: 0 },
    u_windowWidth: { value: 600 },
    u_projection: { value: 0 },
    u_valueToHu: { value: new THREE.Vector2(1, 0) },
    u_hasCurve: { value: false },
  };

  const material = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader: VERT,
    fragmentShader: PANORAMIC_FRAGMENT_SHADER,
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  return { material, uniforms };
}

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const PANORAMIC_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
precision highp sampler3D;

uniform sampler3D u_volume;
uniform sampler2D u_curvePosTex;
uniform sampler2D u_curveNormTex;
uniform vec3  u_volumeTextureDims;
uniform vec3  u_volumeSourceDims;
uniform float u_depthMinVox;
uniform float u_depthMaxVox;
uniform float u_focalThickness;
uniform int   u_raySamples;
uniform float u_windowLevel;
uniform float u_windowWidth;
uniform int   u_projection;
uniform vec2  u_valueToHu;
uniform bool  u_hasCurve;

in vec2 vUv;
out vec4 fragColor;

float sampleVolumeClamp(vec3 voxCoord) {
  vec3 uvw = voxCoord / u_volumeSourceDims;
  uvw = clamp(uvw, vec3(0.0), vec3(1.0));
  float raw = texture(u_volume, uvw).r;
  return raw * u_valueToHu.x + u_valueToHu.y;
}

void main() {
  if (!u_hasCurve) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // curve 위치 (arc-length u) + 협설 법선 N
  vec3 center = texture(u_curvePosTex, vec2(vUv.x, 0.5)).xyz;
  vec3 normal = normalize(texture(u_curveNormTex, vec2(vUv.x, 0.5)).xyz);

  // 세로(vUv.y)를 z(머리↔턱)로 매핑. vUv.y=1(상단) → 머리(큰 z), vUv.y=0(하단) → 턱(작은 z).
  // (quad의 vUv.y=1이 화면 상단이고, CPU ArchPresser의 v=0 상단=머리와 일치하도록 mix 방향 설정)
  float zVox = mix(u_depthMinVox, u_depthMaxVox, vUv.y);
  vec3 origin = vec3(center.x, center.y, zVox);

  // ray: 협설 법선 방향 ±halfT
  float halfT = u_focalThickness * 0.5;
  int N = u_raySamples;
  if (N < 1) N = 1;

  bool isMax = u_projection == 0;
  bool isMin = u_projection == 1;
  bool isMean = u_projection == 2;

  float acc = isMin ? 1.0e9 : -1.0e9;
  float sum = 0.0;
  int cnt = 0;
  for (int k = 0; k < 1024; k++) {
    if (k >= N) break;
    float tk = (N == 1) ? 0.0 : float(k) / float(N - 1);
    float d = mix(-halfT, halfT, tk);
    vec3 vox = origin + normal * d;
    float v = sampleVolumeClamp(vox);
    if (isMax) {
      acc = max(acc, v);
    } else if (isMin) {
      acc = min(acc, v);
    } else if (isMean) {
      sum += v;
      cnt++;
    }
  }
  if (isMean) {
    acc = (cnt > 0) ? (sum / float(cnt)) : 0.0;
  }

  // Window/Level on HU value.
  float lower = u_windowLevel - u_windowWidth * 0.5;
  float upper = u_windowLevel + u_windowWidth * 0.5;
  if (upper <= lower) upper = lower + 1.0;
  float displayVal = clamp((acc - lower) / (upper - lower), 0.0, 1.0);

  fragColor = vec4(vec3(displayVal), 1.0);
}
`;