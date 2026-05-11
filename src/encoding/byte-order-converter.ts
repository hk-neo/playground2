import { ByteOrderError } from '../shared/errors/transfer-syntax';

/** 빅엔디안/리틀엔디안 바이트 순서 변환 */
export class ByteOrderConverter {
  /** 빅엔디안 버퍼를 리틀엔디안으로 변환 (필요시) */
  convertToLittleEndian(buffer: ArrayBuffer, isBigEndian: boolean): ArrayBuffer {
    if (!isBigEndian) return buffer;
    return this.swapBytes(buffer);
  }

  /** 전체 버퍼 바이트 스왑 (16-bit 단위) */
  private swapBytes(buffer: ArrayBuffer): ArrayBuffer {
    const src = new Uint8Array(buffer);
    const dst = new Uint8Array(buffer.byteLength);

    for (let i = 0; i < src.length - 1; i += 2) {
      dst[i] = src[i + 1];
      dst[i + 1] = src[i];
    }
    // 홀수 길이 마지막 바이트는 그대로 유지
    if (src.length % 2 !== 0) {
      dst[src.length - 1] = src[src.length - 1];
    }
    return dst.buffer;
  }

  /** 16-bit 값 바이트 스왑 */
  static swap16(value: number): number {
    return ((value & 0xFF) << 8) | ((value >> 8) & 0xFF);
  }

  /** 32-bit 값 바이트 스왑 */
  static swap32(value: number): number {
    return (
      ((value & 0xFF) << 24) |
      (((value >> 8) & 0xFF) << 16) |
      (((value >> 16) & 0xFF) << 8) |
      ((value >> 24) & 0xFF)
    ) >>> 0;
  }
}
