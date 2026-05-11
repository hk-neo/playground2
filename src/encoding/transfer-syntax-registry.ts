import type { TransferSyntaxDef } from '../shared/types/dicom';
import type { ITransferSyntaxProvider } from '../shared/interfaces/transfer-syntax';
import { UnsupportedTransferSyntaxError } from '../shared/errors/dicom';

/** DICOM 표준 전송 구문 정의 */
const STANDARD_SYNTAXES: TransferSyntaxDef[] = [
  {
    uid: '1.2.840.10008.1.2',
    name: 'Implicit VR Little Endian',
    isLittleEndian: true,
    isExplicitVR: false,
    isCompressed: false,
  },
  {
    uid: '1.2.840.10008.1.2.1',
    name: 'Explicit VR Little Endian',
    isLittleEndian: true,
    isExplicitVR: true,
    isCompressed: false,
  },
  {
    uid: '1.2.840.10008.1.2.2',
    name: 'Explicit VR Big Endian',
    isLittleEndian: false,
    isExplicitVR: true,
    isCompressed: false,
  },
  {
    uid: '1.2.840.10008.1.2.5',
    name: 'RLE Lossless',
    isLittleEndian: true,
    isExplicitVR: true,
    isCompressed: true,
    compressionType: 'rle',
  },
  {
    uid: '1.2.840.10008.1.2.4.70',
    name: 'JPEG Lossless, Non-Hierarchical',
    isLittleEndian: true,
    isExplicitVR: true,
    isCompressed: true,
    compressionType: 'jpeg-lossless',
  },
  {
    uid: '1.2.840.10008.1.2.4.80',
    name: 'JPEG-LS Lossless',
    isLittleEndian: true,
    isExplicitVR: true,
    isCompressed: true,
    compressionType: 'jpeg-ls',
  },
];

/** 지원 가능한 전송 구문 UID 목록 관리 및 조회 */
export class TransferSyntaxRegistry implements ITransferSyntaxProvider {
  private registry: Map<string, TransferSyntaxDef>;

  constructor() {
    this.registry = new Map();
    for (const def of STANDARD_SYNTAXES) {
      this.registry.set(def.uid, def);
    }
  }

  /** 전송 구문 등록 */
  register(uid: string, def: TransferSyntaxDef): void {
    this.registry.set(uid, def);
  }

  /** 전송 구문 정의 조회 */
  lookup(uid: string): TransferSyntaxDef {
    const cleanUID = uid.replace(/\0/g, '').trim();
    const def = this.registry.get(cleanUID);
    if (!def) {
      throw new UnsupportedTransferSyntaxError(cleanUID);
    }
    return def;
  }

  /** 지원 여부 확인 */
  isSupported(uid: string): boolean {
    return this.registry.has(uid);
  }
}
