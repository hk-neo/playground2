import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DicomTagReader } from '../tag-reader';
import { DicomFileLoader } from '../file-loader';
import { TransferSyntaxResolver } from '../transfer-syntax-resolver';
import { PixelDataDecoder } from '../pixel-data-decoder';

const DICOM_DIR = join(process.env.HOME!, 'Projects', '정성진ct');
const SAMPLE_FILE = join(DICOM_DIR, '10001.dcm');

describe('DICOM Integration (real file)', () => {
  it('should parse a real DICOM file end-to-end', () => {
    const nodeBuffer = readFileSync(SAMPLE_FILE);
    const buffer = nodeBuffer.buffer.slice(
      nodeBuffer.byteOffset,
      nodeBuffer.byteOffset + nodeBuffer.byteLength,
    );

    const reader = new DicomTagReader(buffer);
    expect(reader.validateMagicByte()).toBe(true);

    const tags = reader.parseAllTags();

    // 핵심 태그 존재 확인
    expect(tags.has('00020010')).toBe(true); // Transfer Syntax UID
    expect(tags.has('00100020')).toBe(true); // Patient ID
    expect(tags.has('00280010')).toBe(true); // Rows
    expect(tags.has('00280011')).toBe(true); // Columns

    // 태그 값 확인
    const rows = tags.get('00280010')!.value as number;
    const columns = tags.get('00280011')!.value as number;
    expect(rows).toBeGreaterThan(0);
    expect(columns).toBeGreaterThan(0);

    // 필수 태그 검증 통과
    expect(() => DicomTagReader.validateRequiredTags(tags)).not.toThrow();
  });

  it('should resolve transfer syntax from parsed tags', () => {
    const nodeBuffer = readFileSync(SAMPLE_FILE);
    const buffer = nodeBuffer.buffer.slice(
      nodeBuffer.byteOffset,
      nodeBuffer.byteOffset + nodeBuffer.byteLength,
    );

    const reader = new DicomTagReader(buffer);
    const tags = reader.parseAllTags();

    const tsUID = tags.get('00020010')!.value as string;
    expect(tsUID).toBeTruthy();

    const resolver = new TransferSyntaxResolver();
    expect(resolver.isSupported(tsUID)).toBe(true);

    const info = resolver.resolve(tsUID);
    expect(info.isLittleEndian).toBe(true);
  });

  it('should have pixel metadata for decoding', () => {
    const nodeBuffer = readFileSync(SAMPLE_FILE);
    const buffer = nodeBuffer.buffer.slice(
      nodeBuffer.byteOffset,
      nodeBuffer.byteOffset + nodeBuffer.byteLength,
    );

    const reader = new DicomTagReader(buffer);
    const tags = reader.parseAllTags();

    const bitsAllocated = tags.get('00280100')!.value as number;
    const bitsStored = tags.get('00280101')!.value as number;
    const pixelRepresentation = tags.get('00280103')!.value as number;
    const rows = tags.get('00280010')!.value as number;
    const columns = tags.get('00280011')!.value as number;

    expect([8, 16]).toContain(bitsAllocated);
    expect(bitsStored).toBeGreaterThan(0);
    expect([0, 1]).toContain(pixelRepresentation);
    expect(rows).toBeGreaterThan(0);
    expect(columns).toBeGreaterThan(0);

    const decoder = new PixelDataDecoder({
      bitsAllocated,
      bitsStored,
      pixelRepresentation,
      rows,
      columns,
    });

    // 픽셀 데이터 크기 검증
    const expectedSize = rows * columns * (bitsAllocated / 8);
    expect(expectedSize).toBeGreaterThan(0);
  });
});
