/**
 * GPU CPR Viewport — owns a WebGL2 canvas in a host element and renders the
 * panoramic CPR view. Optional secondary viewport (cross-section) lives in the
 * same WebGL context (scissor split).
 *
 * Lifecycle:
 *   const v = new GpuCprViewport(containerEl, { ... });
 *   v.setVolume(volume);     // uploads 3D texture, fits UI
 *   v.setCurve(curve);       // packs 1D arch textures
 *   v.setWLWW(wl, ww);       // DICOM windowing
 *   v.setFocalThickness(mm);
 *   v.setProjection('max' | 'min' | 'mean');
 *   v.render();              // re-render (called automatically on state change)
 *   v.dispose();
 *
 * Detection helper:
 *   supportsGpuCpr() → true if WebGL2 + R32F color-renderable + Float texture
 *                       linear-filterable. Used by pano-wiring to decide GPU vs CPU.
 */
import * as THREE from 'three';
import type { VolumeData } from '../../shared/types/volume';
import type { IPanoramicCurve } from '../../shared/interfaces/pano';
import type { Vec3 } from '../../shared/types/core';

import { packArchSpline, disposeArchSplineTextures, type ArchSplineTextures } from './arch-spline';
import { buildVolumeTexture, disposeVolumeTexture, type VolumeTextureResult } from './volume-texture';
import { makePanoramicMaterial, type PanoramicShaderUniforms } from './panoramic-shader';
import { makeCrossSectionMaterial, type CrossSectionShaderUniforms } from './cross-section-shader';

const DEFAULT_SAMPLE_COUNT = 256;
const DEFAULT_THICKNESS_VOXELS = 200;   // default in-plane thickness in voxels
const DEFAULT_RAY_SAMPLES = 128;
const FULL_HEAD_THICKNESS_FACTOR = 1.0; // multiplier for "full CBCT" auto-thickness

export type ProjectionMode = 'max' | 'min' | 'mean';

export interface GpuCprViewportOptions {
  /** Curve sample count (texture width). Default 256. */
  sampleCount?: number;
  /** Auto-fit in-plane thickness to volume dims. */
  autoThickness?: boolean;
}

interface InternalState {
  renderer: THREE.WebGLRenderer;
  panoScene: THREE.Scene;
  crossScene: THREE.Scene;
  panoUniforms: PanoramicShaderUniforms;
  crossUniforms: CrossSectionShaderUniforms;
  panoMesh: THREE.Mesh;
  crossMesh: THREE.Mesh;
  quadGeometry: THREE.PlaneGeometry;
  orthoCam: THREE.OrthographicCamera;
  arch: ArchSplineTextures | null;
  volume: VolumeTextureResult | null;
  width: number;
  height: number;
  container: HTMLElement;
}

/**
 * Detect if this browser supports GPU CPR:
 *   - WebGL2 context
 *   - OES_texture_float_linear (or WebGL2 native)
 *   - EXT_color_buffer_float (for rendering, optional)
 */
export function supportsGpuCpr(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
    if (!gl) return false;
    // Linear filtering on float textures requires OES_texture_float_linear
    const ext = gl.getExtension('OES_texture_float_linear');
    if (!ext) return false;
    return true;
  } catch {
    return false;
  }
}

export class GpuCprViewport {
  private _state: InternalState | null = null;
  private _curve: IPanoramicCurve | null = null;
  private _volumeData: VolumeData | null = null;
  private _wl = 0;
  private _ww = 600;
  private _thickness = DEFAULT_THICKNESS_VOXELS;
  private _projection: ProjectionMode = 'max';
  private _sampleCount: number;
  private _autoThickness: boolean;
  private _sliceU = 0.5;
  private _fovWidth = 200;
  private _fovHeight = 200;
  private _enabled = false;

  /** Cross-section (right viewport) enabled? */
  private _crossEnabled = false;

  constructor(
    private readonly _container: HTMLElement,
    opts: GpuCprViewportOptions = {},
  ) {
    this._sampleCount = Math.max(32, opts.sampleCount ?? DEFAULT_SAMPLE_COUNT);
    this._autoThickness = opts.autoThickness ?? true;
  }

  /** Initialise the WebGL2 canvas inside the container. Returns true if successful. */
  init(): boolean {
    if (this._state) return true;
    if (!supportsGpuCpr()) return false;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      });
    } catch {
      return false;
    }
    renderer.setClearColor(0x000000, 1);
    renderer.autoClear = false;

    const quadGeometry = new THREE.PlaneGeometry(2, 2);
    const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const panoScene = new THREE.Scene();
    const crossScene = new THREE.Scene();

    const { material: panoMat, uniforms: panoUniforms } = makePanoramicMaterial();
    const { material: crossMat, uniforms: crossUniforms } = makeCrossSectionMaterial();

    const panoMesh = new THREE.Mesh(quadGeometry, panoMat);
    const crossMesh = new THREE.Mesh(quadGeometry, crossMat);
    panoScene.add(panoMesh);
    crossScene.add(crossMesh);

    // Compose a shared canvas for both viewports.
    const canvas = renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.setAttribute('data-gpu-cpr', '1');
    // Make sure container is positioned.
    const cs = getComputedStyle(this._container);
    if (cs.position === 'static') {
      this._container.style.position = 'relative';
    }
    this._container.appendChild(canvas);

    this._state = {
      renderer,
      panoScene,
      crossScene,
      panoUniforms,
      crossUniforms,
      panoMesh,
      crossMesh,
      quadGeometry,
      orthoCam,
      arch: null,
      volume: null,
      width: 0,
      height: 0,
      container: this._container,
    };
    this._enabled = true;
    return true;
  }

  setVolume(volume: VolumeData | null): void {
    this._volumeData = volume;
    if (!this._state) return;
    if (this._state.volume) {
      disposeVolumeTexture(this._state.volume);
      this._state.volume = null;
    }
    if (!volume) return;
    const vt = buildVolumeTexture(volume);
    this._state.volume = vt;
    const [sx, sy, sz] = vt.sourceDimensions;
    const [tdx, tdy, tdz] = vt.dimensions;
    this._state.panoUniforms.u_volume.value = vt.texture;
    this._state.crossUniforms.u_volume.value = vt.texture;
    this._state.panoUniforms.u_volumeTextureDims.value.set(tdx, tdy, tdz);
    this._state.panoUniforms.u_volumeSourceDims.value.set(sx, sy, sz);
    this._state.crossUniforms.u_volumeTextureDims.value.set(tdx, tdy, tdz);
    this._state.crossUniforms.u_volumeSourceDims.value.set(sx, sy, sz);

    // Set HU conversion based on format.
    if (vt.format === 'uint8') {
      const HU_MIN = -1000;
      const HU_MAX = 3000;
      // value is 0..255 (byte). HU = (val/255)*range + huMin
      const scale = (HU_MAX - HU_MIN) / 255;
      const offset = HU_MIN;
      this._state.panoUniforms.u_valueToHu.value.set(scale, offset);
      this._state.crossUniforms.u_valueToHu.value.set(scale, offset);
    } else {
      // float32 → value IS HU.
      this._state.panoUniforms.u_valueToHu.value.set(1, 0);
      this._state.crossUniforms.u_valueToHu.value.set(1, 0);
    }

    // Auto-thickness = full head depth (in source voxel units).
    if (this._autoThickness) {
      const sp = volume.spacing;
      const headDepth = Math.max(sx * sp[0], sy * sp[1]);
      this._thickness = headDepth;
      this._fovWidth = headDepth;
    }

    // 표준 파노라마 기하: 세로 = z(머리↔턱) full range.
    this._state.panoUniforms.u_depthMinVox.value = 0;
    this._state.panoUniforms.u_depthMaxVox.value = Math.max(0, sz - 1);

    // Cross-section defaults: full source volume z for sup-inf FOV.
    this._fovHeight = sz;

    this.applyAllUniforms();
    if (this._curve) this._refreshArch();
    this.render();
  }

  setCurve(curve: IPanoramicCurve | null): void {
    this._curve = curve;
    if (!this._state) return;
    this._refreshArch();
    this.render();
  }

  /** Allow only the panoramic viewport (hide cross-section). */
  setCrossSectionEnabled(enabled: boolean): void {
    this._crossEnabled = enabled;
    this.render();
  }

  setWLWW(wl: number, ww: number): void {
    this._wl = wl;
    this._ww = Math.max(1, ww);
    if (this._state) {
      this._state.panoUniforms.u_windowLevel.value = this._wl;
      this._state.panoUniforms.u_windowWidth.value = this._ww;
      this._state.crossUniforms.u_windowLevel.value = this._wl;
      this._state.crossUniforms.u_windowWidth.value = this._ww;
      this.render();
    }
  }

  setFocalThickness(voxels: number): void {
    this._thickness = Math.max(0, voxels);
    if (this._state) {
      this._state.panoUniforms.u_focalThickness.value = this._thickness;
      this.render();
    }
  }

  /** Panorama 세로(z) 표시 범위를 voxel 단위로 설정 (CPU ArchPresser depth 범위와 일치). */
  setDepthRangeVox(min: number, max: number): void {
    if (this._state) {
      this._state.panoUniforms.u_depthMinVox.value = min;
      this._state.panoUniforms.u_depthMaxVox.value = max;
      this.render();
    }
  }

  setProjection(mode: ProjectionMode): void {
    this._projection = mode;
    const code = mode === 'max' ? 0 : mode === 'min' ? 1 : 2;
    if (this._state) {
      this._state.panoUniforms.u_projection.value = code;
      this.render();
    }
  }

  setSliceU(u: number): void {
    this._sliceU = Math.max(0, Math.min(1, u));
    if (this._state) {
      this._state.crossUniforms.u_sliceU.value = this._sliceU;
      this.render();
    }
  }

  /** Resize the renderer to the container. */
  resize(): void {
    if (!this._state) return;
    const rect = this._container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this._state.renderer.setSize(w, h, false);
    this._state.width = w;
    this._state.height = h;
    this.render();
  }

  /** Re-render the scene. */
  render(): void {
    if (!this._state) return;
    const { renderer, panoScene, crossScene, orthoCam } = this._state;
    const w = this._state.width || this._container.clientWidth || 1;
    const h = this._state.height || this._container.clientHeight || 1;
    if (w === 0 || h === 0) return;
    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);

    if (this._crossEnabled) {
      const split = Math.floor(w * 0.6);
      // Left: panorama
      renderer.setViewport(0, 0, split, h);
      renderer.setScissor(0, 0, split, h);
      renderer.render(panoScene, orthoCam);
      // Right: cross-section
      renderer.setViewport(split, 0, w - split, h);
      renderer.setScissor(split, 0, w - split, h);
      renderer.render(crossScene, orthoCam);
    } else {
      renderer.setViewport(0, 0, w, h);
      renderer.setScissor(0, 0, w, h);
      renderer.render(panoScene, orthoCam);
    }
    renderer.setScissorTest(false);
  }

  dispose(): void {
    if (!this._state) return;
    const { renderer, arch, volume, crossMesh, panoMesh, quadGeometry } = this._state;
    disposeArchSplineTextures(arch);
    disposeVolumeTexture(volume);
    (crossMesh.material as THREE.Material).dispose();
    (panoMesh.material as THREE.Material).dispose();
    quadGeometry.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    renderer.dispose();
    this._state = null;
    this._enabled = false;
  }

  get enabled(): boolean { return this._enabled; }

  private _refreshArch(): void {
    if (!this._state) return;
    if (!this._curve || this._curve.points.length < 2) {
      disposeArchSplineTextures(this._state.arch);
      this._state.arch = null;
      this._state.panoUniforms.u_curvePosTex.value = null;
      this._state.panoUniforms.u_curveNormTex.value = null;
      this._state.crossUniforms.u_curvePosTex.value = null;
      this._state.crossUniforms.u_curveNormTex.value = null;
      this._state.panoUniforms.u_hasCurve.value = false;
      return;
    }
    disposeArchSplineTextures(this._state.arch);
    const arch = packArchSpline(this._curve, { sampleCount: this._sampleCount });
    this._state.arch = arch;
    this._state.panoUniforms.u_curvePosTex.value = arch.posTexture;
    this._state.panoUniforms.u_curveNormTex.value = arch.normTexture;
    this._state.crossUniforms.u_curvePosTex.value = arch.posTexture;
    this._state.crossUniforms.u_curveNormTex.value = arch.normTexture;
    this._state.panoUniforms.u_hasCurve.value = true;
    // planeNormal in shader stays (0,0,1) for axial-curve → sup-inf integration
  }

  private applyAllUniforms(): void {
    if (!this._state) return;
    const u = this._state.panoUniforms;
    u.u_focalThickness.value = this._thickness;
    u.u_raySamples.value = DEFAULT_RAY_SAMPLES;
    u.u_windowLevel.value = this._wl;
    u.u_windowWidth.value = this._ww;
    u.u_projection.value = this._projection === 'max' ? 0 : this._projection === 'min' ? 1 : 2;
    const cu = this._state.crossUniforms;
    cu.u_sliceU.value = this._sliceU;
    cu.u_fovWidth.value = this._fovWidth;
    cu.u_fovHeight.value = this._fovHeight;
    cu.u_windowLevel.value = this._wl;
    cu.u_windowWidth.value = this._ww;
  }
}

/** Vec3 helper export to keep imports tidy. */
export type { Vec3 };
