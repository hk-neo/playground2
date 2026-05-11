import type { ICharDecoder } from '../shared/interfaces/transfer-syntax';
import { EncodingDetectionError } from '../shared/errors/transfer-syntax';

/** ISO-2022-JP 이스케이프 시퀀스 패턴 */
const ISO_2022_ESCAPES: RegExp = /\x1B\$[B@]|\x1B\(B|\x1B\(J/;

/** 다양한 문자 인코딩 디코딩 */
export class CharEncodingDecoder implements ICharDecoder {
  private currentEncoding = 'utf-8';

  /** 버퍼를 문자열로 디코딩 */
  decode(buffer: ArrayBuffer, encoding?: string): string {
    const enc = encoding ?? this.currentEncoding;

    try {
      const decoder = new TextDecoder(enc, { fatal: false });
      return decoder.decode(buffer);
    } catch {
      throw new EncodingDetectionError(`Failed to decode with encoding: ${enc}`);
    }
  }

  /** 인코딩 자동 감지 */
  detectEncoding(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);

    // BOM 체크
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return 'utf-8';
    }

    // ISO-2022-JP 이스케이프 시퀀스 체크
    const text = new TextDecoder('ascii', { fatal: false }).decode(buffer);
    if (ISO_2022_ESCAPES.test(text)) {
      return 'iso-2022-jp';
    }

    // 기본 UTF-8
    return 'utf-8';
  }

  /** 현재 인코딩 설정 */
  setEncoding(encoding: string): void {
    this.currentEncoding = encoding;
  }
}
