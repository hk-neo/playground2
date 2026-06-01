import type { TransferSyntaxInfo, DecodingInfo } from '../shared/types/dicom';
import { CorruptedFileError } from '../shared/errors/dicom';
import { Decoder } from 'jpeg-lossless-decoder-js';
import { extractSingleFrame } from './encapsulated-parser';

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

  /** 비압축 픽셀 데이터 디코딩 */
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

  /**
   * 압축 픽셀 데이터 디코딩 (JPEG Lossless 등).
   *
   * @param fullBuffer - 전체 DICOM 파일 ArrayBuffer
   * @param pixelDataStart - encapsulated items 시작 오프셋 (PixelData 태그 헤더 이후)
   * @param syntax - 전송 구문 정보
   * @param bitsAllocated - 픽셀 당 할당 비트 수
   * @returns 디코딩된 픽셀 데이터 ArrayBuffer
   */
  decodeCompressed(
    fullBuffer: ArrayBuffer,
    pixelDataStart: number,
    syntax: TransferSyntaxInfo,
    bitsAllocated: number,
  ): ArrayBuffer {
    if (!syntax.isCompressed) {
      throw new CorruptedFileError(
        `decodeCompressed() called for uncompressed syntax '${syntax.name}'`,
      );
    }

    return this.decodeJpegLossless(fullBuffer, pixelDataStart, bitsAllocated);
  }

  /** JPEG Lossless 디코딩 */
  private decodeJpegLossless(
    fullBuffer: ArrayBuffer,
    pixelDataStart: number,
    _bitsAllocated: number,
  ): ArrayBuffer {
    const jpegBuffer = extractSingleFrame(fullBuffer, pixelDataStart);
    const decoder = new Decoder();
    return decoder.decompress(jpegBuffer, 0, jpegBuffer.byteLength);
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
