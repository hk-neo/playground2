/**
 * Panoramic CPR Shader — GPU Curved Planar Reformation for dental panoramic view.
 *
 * World coordinate system: matches source VolumeData voxel coords.
 *
 * Texture coordinate system:
 *   - The 3D volume texture is downsampled (mean pool) to fit a GPU memory
 *     budget. We sample at uvw = worldCoord / textureDims (NOT sourceDims).
 *   - Linear filtering between downsampled voxels gives smooth mean values.
 *
 * Value → HU:
 *   - format='float32' : the value IS HU. Set u_valueToHuOffset=0, scale=1.
 *   - format='uint8'   : the value is (HU-huMin)/range * 255 → reverse to HU
 *                        via u_valueToHu = (val/255) * range + huMin.
 *
 * Geometry:
 *   vUv.x ∈ [0,1]  → curve param (along arch)
 *   vUv.y ∈ [0,1]  → in-plane depth offset (front-back)
 *   Ray march      → along planeNormal (sup-inf, head top to chin)
 *                    over source dims.z extent.
 */
import * as THREE from 'three';
import type { Vec3 } from '../../shared/types/core';

export interface PanoramicShaderUniforms extends Record<string, THREE.IUniform> {
  u_volume: { value: THREE.Data3DTexture | null };
  u_curvePosTex: { value: THREE.DataTexture | null };
  u_curveNormTex: { value: THREE.DataTexture | null };
  u_volumeTextureDims: { value: THREE.Vector3 };  // actual 3D texture dims (downsampled)
  u_volumeSourceDims: { value: THREE.Vector3 };   // original world dims (for ray extent)
  u_planeNormal: { value: THREE.Vector3 };
  u_focalThickness: { value: number };
  u_raySamples: { value: number };
  u_windowLevel: { value: number };
  u_windowWidth: { value: number };
  u_projection: { value: number };
  u_valueToHu: { value: THREE.Vector2 };           // (scale, offset) → HU = val*scale + offset
  u_hasCurve: { value: boolean };
}

export function makePanoramicMaterial(
  planeNormal: Vec3 = { x: 0, y: 0, z: 1 },
): { material: THREE.ShaderMaterial; uniforms: PanoramicShaderUniforms } {
  const uniforms: PanoramicShaderUniforms = {
    u_volume: { value: null },
    u_curvePosTex: { value: null },
    u_curveNormTex: { value: null },
    u_volumeTextureDims: { value: new THREE.Vector3(1, 1, 1) },
    u_volumeSourceDims: { value: new THREE.Vector3(1, 1, 1) },
    u_planeNormal: { value: new THREE.Vector3(planeNormal.x, planeNormal.y, planeNormal.z) },
    u_focalThickness: { value: 200 },
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
uniform vec3  u_planeNormal;
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
  // Convert sample to HU using the (scale, offset) pair.
  return raw * u_valueToHu.x + u_valueToHu.y;
}

void main() {
  if (!u_hasCurve) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  vec3 center = texture(u_curvePosTex, vec2(vUv.x, 0.5)).xyz;
  vec3 perp   = texture(u_curveNormTex, vec2(vUv.x, 0.5)).xyz;

  float halfT = u_focalThickness * 0.5;
  vec3 origin = center + perp * (vUv.y * 2.0 - 1.0) * halfT;

  vec3 dir = u_planeNormal;
  float dStart = 0.0;
  float dEnd   = u_volumeSourceDims.z;
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
    float d = mix(dStart, dEnd, tk);
    vec3 vox = origin + dir * d;
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
