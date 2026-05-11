import { describe, it, expect } from 'vitest';
import { DicomFileLoader } from '../file-loader';
import { CorruptedFileError } from '../../shared/errors/dicom';

function createMockFile(size: number, content?: Uint8Array): File {
  const data = content ?? new Uint8Array(size);
  return new File([data.buffer as ArrayBuffer], 'test.dcm', { type: 'application/dicom' });
}

describe('DicomFileLoader', () => {
  it('should load a file into ArrayBuffer', async () => {
    const loader = new DicomFileLoader();
    const content = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const file = createMockFile(4, content);

    const buffer = await loader.load(file);
    expect(buffer.byteLength).toBe(4);
    expect(new Uint8Array(buffer)).toEqual(content);
  });

  it('should throw CorruptedFileError for empty file', async () => {
    const loader = new DicomFileLoader();
    const file = createMockFile(0);

    await expect(loader.load(file)).rejects.toThrow(CorruptedFileError);
  });

  it('should validate matching file sizes', () => {
    const loader = new DicomFileLoader();
    expect(loader.validateSize(1024, 1024)).toBe(true);
  });

  it('should reject mismatched file sizes', () => {
    const loader = new DicomFileLoader();
    expect(loader.validateSize(1024, 2048)).toBe(false);
  });
});
