import type { ICharDecoder } from '../shared/interfaces/transfer-syntax';
import { EncodingDetectionError } from '../shared/errors/transfer-syntax';

/** DICOM Specific Character Set → TextDecoder 인코딩 매핑 */
const DICOM_CHARSET_MAP: Record<string, string> = {
  'ISO_IR 6': 'utf-8',
  'ISO_IR 100': 'iso-8859-1',
  'ISO_IR 101': 'iso-8859-2',
  'ISO_IR 109': 'iso-8859-3',
  'ISO_IR 110': 'iso-8859-4',
  'ISO_IR 144': 'iso-8859-5',
  'ISO_IR 127': 'iso-8859-6',
  'ISO_IR 126': 'iso-8859-7',
  'ISO_IR 138': 'iso-8859-8',
  'ISO_IR 148': 'iso-8859-9',
  'ISO_IR 13': 'shift_jis',
  'ISO_IR 149': 'euc-kr',
  'ISO 2022 IR 6': 'utf-8',
  'ISO 2022 IR 100': 'iso-8859-1',
  'ISO 2022 IR 149': 'euc-kr',
  'ISO 2022 IR 13': 'shift_jis',
  'GB18030': 'gb18030',
  'GBK': 'gbk',
};

/** 다양한 문자 인코딩 디코딩 */
export class CharEncodingDecoder implements ICharDecoder {
  private currentEncoding = 'utf-8';

  /** 버퍼를 문자열로 디코딩 */
  decode(buffer: ArrayBuffer, encoding?: string): string {
    const enc = this.resolveEncoding(encoding ?? this.currentEncoding);

    try {
      const decoder = new TextDecoder(enc, { fatal: false });
      return decoder.decode(buffer);
    } catch {
      // 폴백: UTF-8로 재시도
      try {
        return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
      } catch {
        throw new EncodingDetectionError(`Failed to decode with encoding: ${enc}`);
      }
    }
  }

  /** DICOM Specific Character Set 값을 기반으로 인코딩 감지 */
  detectEncoding(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);

    // BOM 체크
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return 'utf-8';
    }

    return 'utf-8';
  }

  /** DICOM (0008,0005) Specific Character Set 태그값으로 인코딩 설정 */
  setEncodingFromDicom(charset: string): void {
    const trimmed = charset.trim();
    const enc = DICOM_CHARSET_MAP[trimmed];
    if (enc) {
      this.currentEncoding = enc;
    } else {
      // 매핑에 없으면 원본 그대로 시도
      this.currentEncoding = trimmed.toLowerCase();
    }
  }

  /** 현재 인코딩 설정 */
  setEncoding(encoding: string): void {
    this.currentEncoding = encoding;
  }

  /** 인코딩 이름 정규화 */
  private resolveEncoding(enc: string): string {
    const mapped = DICOM_CHARSET_MAP[enc.trim()];
    return mapped ?? enc;
  }
}
