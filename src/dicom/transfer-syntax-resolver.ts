import type { TransferSyntaxInfo } from '../shared/types/dicom';
import { UnsupportedTransferSyntaxError } from '../shared/errors/dicom';

/** DICOM 표준 전송 구문 UID */
const TRANSFER_SYNTAXES: Record<string, TransferSyntaxInfo> = {
  '1.2.840.10008.1.2': {
    uid: '1.2.840.10008.1.2',
    name: 'Implicit VR Little Endian',
    isCompressed: false,
    isLittleEndian: true,
  },
  '1.2.840.10008.1.2.1': {
    uid: '1.2.840.10008.1.2.1',
    name: 'Explicit VR Little Endian',
    isCompressed: false,
    isLittleEndian: true,
  },
  '1.2.840.10008.1.2.2': {
    uid: '1.2.840.10008.1.2.2',
    name: 'Explicit VR Big Endian',
    isCompressed: false,
    isLittleEndian: false,
  },
  '1.2.840.10008.1.2.5': {
    uid: '1.2.840.10008.1.2.5',
    name: 'RLE Lossless',
    isCompressed: true,
    isLittleEndian: true,
  },
  '1.2.840.10008.1.2.4.70': {
    uid: '1.2.840.10008.1.2.4.70',
    name: 'JPEG Lossless, Non-Hierarchical',
    isCompressed: true,
    isLittleEndian: true,
  },
  '1.2.840.10008.1.2.4.80': {
    uid: '1.2.840.10008.1.2.4.80',
    name: 'JPEG-LS Lossless',
    isCompressed: true,
    isLittleEndian: true,
  },
};

/** 전송 구문 UID 해석 및 디코딩 전략 선택 */
export class TransferSyntaxResolver {
  private supportedUIDs: Map<string, TransferSyntaxInfo>;

  constructor() {
    this.supportedUIDs = new Map(Object.entries(TRANSFER_SYNTAXES));
  }

  /** 전송 구문 UID로 정보 조회 */
  resolve(uid: string): TransferSyntaxInfo {
    const info = this.supportedUIDs.get(uid);
    if (!info) {
      throw new UnsupportedTransferSyntaxError(uid);
    }
    return info;
  }

  /** 압축 여부 확인 */
  isCompressed(uid: string): boolean {
    return this.resolve(uid).isCompressed;
  }

  /** 지원 여부 확인 */
  isSupported(uid: string): boolean {
    return this.supportedUIDs.has(uid);
  }
}
