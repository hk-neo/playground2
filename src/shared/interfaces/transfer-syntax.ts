import type { TransferSyntaxDef } from '../types/dicom';

/** 전송 구문 조회 추상화 */
export interface ITransferSyntaxProvider {
  lookup(uid: string): TransferSyntaxDef;
  isSupported(uid: string): boolean;
}

/** 문자 디코딩 추상화 */
export interface ICharDecoder {
  decode(buffer: ArrayBuffer, encoding?: string): string;
  detectEncoding(buffer: ArrayBuffer): string;
  setEncoding(encoding: string): void;
}
