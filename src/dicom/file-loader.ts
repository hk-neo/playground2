import type { IFileLoader } from '../shared/interfaces/dicom';
import { CorruptedFileError } from '../shared/errors/dicom';

/** 브라우저 File API 기반 DICOM 파일 로더 */
export class DicomFileLoader implements IFileLoader {
  private fileSize = 0;

  /** File 객체를 ArrayBuffer로 변환 */
  async load(file: File): Promise<ArrayBuffer> {
    this.fileSize = file.size;

    if (this.fileSize === 0) {
      throw new CorruptedFileError('File is empty');
    }

    const buffer = await file.arrayBuffer();

    if (!this.validateSize(buffer.byteLength, this.fileSize)) {
      throw new CorruptedFileError(
        `File size mismatch: expected ${this.fileSize}, got ${buffer.byteLength}`,
      );
    }

    return buffer;
  }

  /** 파일 크기 일치 검증 */
  validateSize(actual: number, expected: number): boolean {
    return actual === expected;
  }
}
