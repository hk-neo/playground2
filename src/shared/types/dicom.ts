/** DICOM 태그 */
export interface DicomTag {
  group: number;
  element: number;
  vr: string;
  length: number;
  value: unknown;
  offset: number;
}

/** 전송 구문 정보 (MOD-001 관점) */
export interface TransferSyntaxInfo {
  uid: string;
  name: string;
  isCompressed: boolean;
  isLittleEndian: boolean;
}

/** 전송 구문 정의 (MOD-002 관점) */
export interface TransferSyntaxDef {
  uid: string;
  name: string;
  isLittleEndian: boolean;
  isExplicitVR: boolean;
  isCompressed: boolean;
  compressionType?: string;
}

/** 픽셀 디코딩 정보 */
export interface DecodingInfo {
  bitsAllocated: number;
  bitsStored: number;
  pixelRepresentation: number;
  rows: number;
  columns: number;
}
