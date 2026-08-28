/**
 * Cross-Section Shader — single normal-plane slice at chosen curve position.
 *
 *   vUv.x ∈ [0,1] → in-plane (perp axis)    = bucco-lingual direction
 *   vUv.y ∈ [0,1] → along planeNormal       = superior-inferior (head top to chin)
 *
 * P(u,v) = curveCenter + perp*(u*2-1)*(fovW/2) + planeNormal*(v*2-1)*(fovH/2)
 *
 * Click-drag on panorama → updates u_sliceU on the right viewport.
 */
import * as THREE from 'three';

export interface CrossSectionShaderUniforms extends Record<string, THREE.IUniform> {
  u_volume: { value: THREE.Data3DTexture | null };
  u_curvePosTex: { value: THREE.DataTexture | null };
  u_curveNormTex: { value: THREE.DataTexture | null };
  u_volumeTextureDims: { value: THREE.Vector3 };
  u_volumeSourceDims: { value: THREE.Vector3 };
  u_planeNormal: { value: THREE.Vector3 };
  u_sliceU: { value: number };
  u_fovWidth: { value: number };
  u_fovHeight: { value: number };
  u_windowLevel: { value: number };
  u_windowWidth: { value: number };
  u_valueToHu: { value: THREE.Vector2 };
}

export function makeCrossSectionMaterial(
  planeNormal: { x: number; y: number; z: number } = { x: 0, y: 0, z: 1 },
): { material: THREE.ShaderMaterial; uniforms: CrossSectionShaderUniforms } {
  const uniforms: CrossSectionShaderUniforms = {
    u_volume: { value: null },
    u_curvePosTex: { value: null },
    u_curveNormTex: { value: null },
    u_volumeTextureDims: { value: new THREE.Vector3(1, 1, 1) },
    u_volumeSourceDims: { value: new THREE.Vector3(1, 1, 1) },
    u_planeNormal: { value: new THREE.Vector3(planeNormal.x, planeNormal.y, planeNormal.z) },
    u_sliceU: { value: 0.5 },
    u_fovWidth: { value: 200 },
    u_fovHeight: { value: 200 },
    u_windowLevel: { value: 0 },
    u_windowWidth: { value: 600 },
    u_valueToHu: { value: new THREE.Vector2(1, 0) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader: VERT,
    fragmentShader: FRAG,
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

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;

uniform sampler3D u_volume;
uniform sampler2D u_curvePosTex;
uniform sampler2D u_curveNormTex;
uniform vec3  u_volumeTextureDims;
uniform vec3  u_volumeSourceDims;
uniform vec3  u_planeNormal;
uniform float u_sliceU;
uniform float u_fovWidth;
uniform float u_fovHeight;
uniform float u_windowLevel;
uniform float u_windowWidth;
uniform vec2  u_valueToHu;

in vec2 vUv;
out vec4 fragColor;

void main() {
  vec3 center = texture(u_curvePosTex, vec2(u_sliceU, 0.5)).xyz;
  vec3 perp   = texture(u_curveNormTex, vec2(u_sliceU, 0.5)).xyz;
  vec3 dir    = u_planeNormal;

  float u = vUv.x * 2.0 - 1.0;
  float v = vUv.y * 2.0 - 1.0;

  vec3 vox = center + perp * (u * u_fovWidth * 0.5) + dir * (v * u_fovHeight * 0.5);

  vec3 uvw = vox / u_volumeSourceDims;
  uvw = clamp(uvw, vec3(0.0), vec3(1.0));
  float raw = texture(u_volume, uvw).r;
  float val = raw * u_valueToHu.x + u_valueToHu.y;

  float lower = u_windowLevel - u_windowWidth * 0.5;
  float upper = u_windowLevel + u_windowWidth * 0.5;
  if (upper <= lower) upper = lower + 1.0;
  float displayVal = clamp((val - lower) / (upper - lower), 0.0, 1.0);

  fragColor = vec4(vec3(displayVal), 1.0);
}
`;
