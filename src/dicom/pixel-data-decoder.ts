import type { TransferSyntaxInfo, DecodingInfo } from '../shared/types/dicom';
import { CorruptedFileError } from '../shared/errors/dicom';

/** 압축/비압축 픽셀 데이터 디코딩 */
export class PixelDataDecoder {
  private bitsAllocated: number;
  private pixelRepresentation: number;
  private rows: number;
  private columns: number;

  constructor(info: DecodingInfo) {
    this.bitsAllocated = info.bitsAllocated;
    this.pixelRepresentation = info.pixelRepresentation;
    this.rows = info.rows;
    this.columns = info.columns;
  }

  /** 픽셀 데이터 디코딩 */
  decode(pixelBuffer: ArrayBuffer, syntax: TransferSyntaxInfo): ArrayBuffer {
    if (syntax.isCompressed) {
      throw new CorruptedFileError(
        `Compressed transfer syntax '${syntax.name}' is not yet supported`,
      );
    }

    // 비압축: 엔디안 변환만 필요
    if (!syntax.isLittleEndian) {
      return this.swapEndian(pixelBuffer);
    }

    return pixelBuffer;
  }

  /** 픽셀 데이터 무결성 검증 */
  validatePixelData(decoded: ArrayBuffer): boolean {
    const expectedSize = this.rows * this.columns * (this.bitsAllocated / 8);
    return decoded.byteLength === expectedSize;
  }

  /** 빅엔디안 → 리틀엔디안 변환 */
  private swapEndian(buffer: ArrayBuffer): ArrayBuffer {
    const bytesPerSample = this.bitsAllocated / 8;

    if (bytesPerSample === 1) return buffer;

    const src = new Uint8Array(buffer);
    const dst = new Uint8Array(buffer.byteLength);

    for (let i = 0; i < src.length; i += bytesPerSample) {
      for (let j = 0; j < bytesPerSample; j++) {
        dst[i + j] = src[i + bytesPerSample - 1 - j];
      }
    }

    return dst.buffer;
  }
}
