export interface RGBA {
  r: number; g: number; b: number; a: number;
}

export interface ControlPoint {
  density: number;
  color: RGBA;
  opacity: number;
}

const CBCT_BONE_PRESET: ControlPoint[] = [
  { density: -1000, color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 0.0 },
  { density: -500, color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 0.0 },
  { density: -100, color: { r: 0.8, g: 0.4, b: 0.3, a: 1 }, opacity: 0.15 },
  { density: 200, color: { r: 0.9, g: 0.6, b: 0.5, a: 1 }, opacity: 0.3 },
  { density: 800, color: { r: 1, g: 0.95, b: 0.9, a: 1 }, opacity: 0.7 },
  { density: 1500, color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 0.9 },
  { density: 4000, color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1.0 },
];

/** 전송 함수 편집 및 GPU 텍스처 업데이트 */
export class TransferFunctionManager {
  private controlPoints: ControlPoint[] = [];
  private _preset = 'cbct_bone';
  private textureData: Uint8Array;

  constructor() {
    this.textureData = new Uint8Array(256 * 4);
    this.loadPreset('cbct_bone');
  }

  setControlPoints(points: ControlPoint[]): void {
    for (const p of points) {
      if (p.density < -1024 || p.density > 4095) {
        throw new Error(`Invalid density value: ${p.density}`);
      }
      if (p.opacity < 0 || p.opacity > 1) {
        throw new Error(`Invalid opacity value: ${p.opacity}`);
      }
    }
    this.controlPoints = [...points].sort((a, b) => a.density - b.density);
    this.updateTextureData();
  }

  getControlPoints(): ControlPoint[] {
    return [...this.controlPoints];
  }

  loadPreset(name: string): void {
    this._preset = name;
    switch (name) {
      case 'cbct_bone':
        this.setControlPoints(CBCT_BONE_PRESET);
        break;
      default:
        this.setControlPoints(CBCT_BONE_PRESET);
    }
  }

  get preset(): string { return this._preset; }

  getOpacityAt(density: number): number {
    return this.interpolateChannel(density, 'opacity');
  }

  getColorAt(density: number): RGBA {
    return {
      r: this.interpolateChannel(density, 'r'),
      g: this.interpolateChannel(density, 'g'),
      b: this.interpolateChannel(density, 'b'),
      a: 1,
    };
  }

  getTextureData(): Uint8Array {
    return this.textureData;
  }

  updateTexture(gl: WebGL2RenderingContext, texture: WebGLTexture): void {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.textureData);
  }

  createTexture(gl: WebGL2RenderingContext): WebGLTexture {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.textureData);
    return texture;
  }

  private updateTextureData(): void {
    for (let i = 0; i < 256; i++) {
      const density = this.indexToDensity(i);
      const color = this.getColorAt(density);
      const opacity = this.getOpacityAt(density);
      const idx = i * 4;
      this.textureData[idx] = Math.round(color.r * 255);
      this.textureData[idx + 1] = Math.round(color.g * 255);
      this.textureData[idx + 2] = Math.round(color.b * 255);
      this.textureData[idx + 3] = Math.round(opacity * 255);
    }
  }

  private interpolateChannel(density: number, channel: 'r' | 'g' | 'b' | 'opacity'): number {
    const points = this.controlPoints;
    if (points.length === 0) return 0;
    if (density <= points[0].density) return channel === 'opacity' ? points[0].opacity : points[0].color[channel];
    if (density >= points[points.length - 1].density) {
      const last = points[points.length - 1];
      return channel === 'opacity' ? last.opacity : last.color[channel];
    }

    for (let i = 0; i < points.length - 1; i++) {
      if (density >= points[i].density && density <= points[i + 1].density) {
        const t = (density - points[i].density) / (points[i + 1].density - points[i].density);
        const a = channel === 'opacity' ? points[i].opacity : points[i].color[channel];
        const b = channel === 'opacity' ? points[i + 1].opacity : points[i + 1].color[channel];
        return a + (b - a) * t;
      }
    }
    return 0;
  }

  private indexToDensity(index: number): number {
    return -1024 + (index / 255) * (4095 - (-1024));
  }
}
