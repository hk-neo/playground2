/**
 * Arch Spline — Pack a PanoramicCurve into 1D GPU textures.
 *
 *   posTexture[i]  = (x, y, z) voxel coord of curve sample at t=i/(N-1)
 *   normTexture[i] = (inPlanePerp.x, inPlanePerp.y, inPlanePerp.z)
 *                    where inPlanePerp = normalize(tangent × planeNormal)
 *                    = the curve-perpendicular direction in the arch plane
 *                    (= "vertical" axis of the panorama image)
 *
 * Both textures are RGBA32F (FloatType) so we can store world-space voxel coords.
 *
 * Also uniforms are computed:
 *   - planeNormal (world-space, usually (0,0,1) for axial-plane curves)
 *   - arc length sampling range
 */
import * as THREE from 'three';
import type { IPanoramicCurve } from '../../shared/interfaces/pano';
import type { Vec3 } from '../../shared/types/core';

const EPSILON = 1e-9;

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

function sub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function normalize3(v: Vec3): Vec3 {
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (m < EPSILON) return { x: 0, y: 0, z: 1 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

function crossN(a: Vec3, b: Vec3): Vec3 {
  const cx = a.y * b.z - a.z * b.y;
  const cy = a.z * b.x - a.x * b.z;
  const cz = a.x * b.y - a.y * b.z;
  const m = Math.sqrt(cx * cx + cy * cy + cz * cz);
  if (m < EPSILON) return { x: 0, y: 0, z: 1 };
  return { x: cx / m, y: cy / m, z: cz / m };
}

/**
 * Pack an existing PanoramicCurve (uniform Catmull-Rom, custom impl) into 1D GPU textures.
 *
 * @param curve  axial-plane curve
 * @param opts.sampleCount  number of equispaced-arc-length samples (texture width)
 */
export function packArchSpline(
  curve: IPanoramicCurve,
  opts: ArchSplinePackingOptions = {},
): ArchSplineTextures {
  const N = Math.max(8, opts.sampleCount ?? 256);

  // Sample curve + tangents.
  const samples = new Array<Vec3>(N);
  const tangents = new Array<Vec3>(N);
  for (let i = 0; i < N; i++) {
    const t = N === 1 ? 0 : i / (N - 1);
    samples[i] = curve.sample(t);
    tangents[i] = curve.tangent(t);
  }

  // Plane normal: if curve has ≥3 distinct points, fit best-fit plane via
  // (p1-p0)×(p2-p0). Otherwise default Z-up.
  let planeNormal: Vec3 = { x: 0, y: 0, z: 1 };
  if (samples.length >= 3) {
    const pn = crossN(sub3(samples[1], samples[0]), sub3(samples[2], samples[0]));
    planeNormal = pn.x === 0 && pn.y === 0 && pn.z === 0 ? planeNormal : pn;
  }

  // In-plane perp at each sample (= "vertical axis" of panorama image).
  const inPlanePerps = new Array<Vec3>(N);
  for (let i = 0; i < N; i++) {
    inPlanePerps[i] = normalize3(crossN(tangents[i], planeNormal));
  }

  // Pack textures (RGBA Float32).
  const posData = new Float32Array(N * 4);
  const normData = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const s = samples[i];
    const ip = inPlanePerps[i];
    const j = i * 4;
    posData[j + 0] = s.x;
    posData[j + 1] = s.y;
    posData[j + 2] = s.z;
    posData[j + 3] = 1.0;
    normData[j + 0] = ip.x;
    normData[j + 1] = ip.y;
    normData[j + 2] = ip.z;
    normData[j + 3] = 0.0;
  }

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
