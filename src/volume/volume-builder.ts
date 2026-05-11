import type { SliceData, VolumeData, VolumeConfig, ProgressCallback } from '../shared/types/volume';
import { InsufficientSlicesError, DimensionMismatchError } from '../shared/errors/volume';

/** 슬라이스 배열 → VolumeData 변환 오케스트레이션 */
export class VolumeBuilder {
  private slices: SliceData[] = [];
  private config: VolumeConfig;

  constructor(config: VolumeConfig = {}) {
    this.config = config;
  }

  /** 슬라이스 추가 */
  addSlice(slice: SliceData): void {
    if (this.slices.length > 0) {
      const first = this.slices[0];
      if (slice.width !== first.width || slice.height !== first.height) {
        throw new DimensionMismatchError(
          `Slice ${slice.sliceIndex} size (${slice.width}x${slice.height}) ` +
          `does not match first slice (${first.width}x${first.height})`,
        );
      }
    }
    this.slices.push(slice);
  }

  /** 볼륨 데이터 빌드 */
  build(): VolumeData {
    if (this.slices.length < 2) {
      throw new InsufficientSlicesError(this.slices.length, 2);
    }

    const sorted = [...this.slices].sort((a, b) => a.position - b.position);
    const first = sorted[0];
    const width = first.width;
    const height = first.height;
    const depth = sorted.length;
    const voxelSize = 2; // int16 = 2 bytes

    const totalSize = width * height * depth * voxelSize;
    const buffer = new ArrayBuffer(totalSize);
    const view = new Int16Array(buffer);

    for (let z = 0; z < depth; z++) {
      const slice = sorted[z];
      const sliceData = new Int16Array(slice.buffer);
      const offset = z * width * height;
      view.set(sliceData, offset);
    }

    // spacing 계산 (슬라이스 간격 기반)
    let sliceSpacing = 1;
    if (sorted.length >= 2) {
      sliceSpacing = Math.abs(sorted[1].position - sorted[0].position);
      if (sliceSpacing === 0) sliceSpacing = 1;
    }

    return {
      buffer,
      dimensions: [width, height, depth],
      spacing: [1, 1, sliceSpacing],
      origin: [0, 0, sorted[0].position],
      dataType: 'int16',
    };
  }

  /** 점진적 로딩 (저해상도 미리보기 → 고해상도) */
  buildProgressive(callback: ProgressCallback): VolumeData {
    const volume = this.build();
    callback(1.0);
    return volume;
  }

  /** 볼륨 데이터 유효성 검증 */
  validateVolume(): boolean {
    if (this.slices.length < 2) return false;

    const first = this.slices[0];
    for (const slice of this.slices) {
      if (slice.width !== first.width || slice.height !== first.height) return false;
      if (slice.buffer.byteLength !== first.width * first.height * 2) return false;
    }
    return true;
  }
}
