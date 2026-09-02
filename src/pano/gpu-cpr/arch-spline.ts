/**
 * Arch Spline — Pack a PanoramicCurve into 1D GPU textures.
 *
 *   posTexture[i]  = (x, y, z) voxel coord (arc-length 균등 샘플)
 *   normTexture[i] = in-plane perp (협설 방향 N) — panorama ray-cast 방향
 *
 * Both textures are RGBA32F (FloatType) so we can store world-space voxel coords.
 */
import * as THREE from 'three';
import type { IPanoramicCurve } from '../../shared/interfaces/pano';
import type { Vec3 } from '../../shared/types/core';
import { CurveFrameSampler } from '../curve-frame';

export interface ArchSplinePackingOptions {
  /** Number of curve samples (texture width). Defaults to 256. */
  sampleCount?: number;
}

export interface ArchSplineTextures {
  posTexture: THREE.DataTexture;
  normTexture: THREE.DataTexture;
  sampleCount: number;
  planeNormal: Vec3;
}

/**
 * Pack a panoramic curve into 1D GPU textures (arc-length 균등 샘플 + Frenet frame).
 *
 * @param curve  axial-plane curve
 * @param opts.sampleCount  number of equispaced-arc-length samples (texture width)
 */
export function packArchSpline(
  curve: IPanoramicCurve,
  opts: ArchSplinePackingOptions = {},
): ArchSplineTextures {
  const N = Math.max(8, opts.sampleCount ?? 256);

  // arc-length 균등 샘플 + Frenet frame (T/N/B). normal = 협설 방향.
  const sampler = new CurveFrameSampler(curve, N);

  // Pack textures (RGBA Float32).
  const posData = new Float32Array(N * 4);
  const normData = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const f = sampler.frameAt(i);
    const j = i * 4;
    posData[j + 0] = f.position.x;
    posData[j + 1] = f.position.y;
    posData[j + 2] = f.position.z;
    posData[j + 3] = 1.0;
    normData[j + 0] = f.normal.x;
    normData[j + 1] = f.normal.y;
    normData[j + 2] = f.normal.z;
    normData[j + 3] = 0.0;
  }

  // 평균 binormal(≈Z). 호환용.
  const planeNormal: Vec3 = sampler.frameAt(0).binormal;

  const posTexture = new THREE.DataTexture(posData, N, 1, THREE.RGBAFormat, THREE.FloatType);
  posTexture.minFilter = THREE.LinearFilter;
  posTexture.magFilter = THREE.LinearFilter;
  posTexture.wrapS = THREE.ClampToEdgeWrapping;
  posTexture.wrapT = THREE.ClampToEdgeWrapping;
  posTexture.needsUpdate = true;

  const normTexture = new THREE.DataTexture(normData, N, 1, THREE.RGBAFormat, THREE.FloatType);
  normTexture.minFilter = THREE.LinearFilter;
  normTexture.magFilter = THREE.LinearFilter;
  normTexture.wrapS = THREE.ClampToEdgeWrapping;
  normTexture.wrapT = THREE.ClampToEdgeWrapping;
  normTexture.needsUpdate = true;

  return { posTexture, normTexture, sampleCount: N, planeNormal };
}

export function disposeArchSplineTextures(t: ArchSplineTextures | null): void {
  if (!t) return;
  t.posTexture.dispose();
  t.normTexture.dispose();
}
