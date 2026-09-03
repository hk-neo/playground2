import { ArchPresser } from '../pano/arch-presser';
import type { VolumeData } from '../shared/types/volume';
import type {
  CprCurve,
  CprVolume,
  NormalizedCprExtractOptions,
} from './types';

interface CpuVolumeData extends VolumeData {
  byteOffset: number;
  dataLength: number;
}

export interface CprBackendResult {
  data: Float32Array;
  width: number;
  height: number;
}

export interface InternalCprBackend {
  setVolume(volume: CprVolume): void;
  extract(curve: CprCurve, options: NormalizedCprExtractOptions): CprBackendResult;
  dispose(): void;
}

export class CpuCprBackend implements InternalCprBackend {
  private readonly archPresser = new ArchPresser();
  private volume?: CpuVolumeData;

  setVolume(volume: CprVolume): void {
    this.volume = {
      buffer: volume.data.buffer as ArrayBuffer,
      dimensions: [...volume.dimensions],
      spacing: [...volume.spacing],
      origin: [0, 0, 0],
      dataType: volume.data instanceof Int16Array ? 'int16' : 'uint16',
      byteOffset: volume.data.byteOffset,
      dataLength: volume.data.length,
    };
  }

  extract(curve: CprCurve, options: NormalizedCprExtractOptions): CprBackendResult {
    if (!this.volume) {
      throw new Error('CPU backend requires a volume before extraction');
    }

    this.archPresser.setThickness(options.thickness);
    this.archPresser.setPixelSize(options.pixelSize);
    this.archPresser.setMode(options.mode);
    this.archPresser.setDepthRangeMm(options.depthRangeMm[0], options.depthRangeMm[1]);
    return this.archPresser.extract(curve, this.volume);
  }

  dispose(): void {
    this.volume = undefined;
  }
}
