import type { RawBuffer, DicomTags } from '../types/patient';
import type { DecodingInfo } from '../types/dicom';
import type { VolumeData } from '../types/volume';

/** 파일 로드 추상화 */
export interface IFileLoader {
  load(file: File): Promise<RawBuffer>;
  validateSize(actual: number, expected: number): boolean;
}

/** 태그 파싱 추상화 */
export interface ITagParser {
  parse(buffer: ArrayBuffer): DicomTags;
}

/** 픽셀 디코딩 추상화 */
export interface IPixelDecoder {
  decode(buffer: ArrayBuffer, info: DecodingInfo): VolumeData;
}
