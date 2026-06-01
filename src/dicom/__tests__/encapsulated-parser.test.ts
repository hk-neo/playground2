import { describe, it, expect } from 'vitest';
import { parseEncapsulatedFrames, extractSingleFrame } from '../encapsulated-parser';
import { CorruptedFileError } from '../../shared/errors/dicom';
import { DicomBufferBuilder } from './helpers';

/** encapsulated items만 포함하는 버퍼 생성 (PixelData 태그 헤더 이후부터) */
function buildEncapsulatedBuffer(frames: Uint8Array[]): ArrayBuffer {
  const builder = new DicomBufferBuilder();
  for (const frame of frames) {
    builder.addEncapsulatedItem(frame);
  }
  builder.addSequenceDelimiter();
  return builder.build();
}

describe('parseEncapsulatedFrames', () => {
  it('should parse a single frame', () => {
    const frameData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xC3, 0x00, 0x01]); // mock JPEG header
    const buffer = buildEncapsulatedBuffer([frameData]);

    const frames = parseEncapsulatedFrames(buffer, 0);

    expect(frames).toHaveLength(1);
    expect(frames[0].length).toBe(frameData.length);
    expect(frames[0].offset).toBe(8); // item header(8) 이후
  });

  it('should parse multiple frames', () => {
    const frame1 = new Uint8Array([0x01, 0x02, 0x03]);
    const frame2 = new Uint8Array([0x04, 0x05, 0x06, 0x07]);
    const buffer = buildEncapsulatedBuffer([frame1, frame2]);

    const frames = parseEncapsulatedFrames(buffer, 0);

    expect(frames).toHaveLength(2);
    expect(frames[0].length).toBe(3);
    expect(frames[1].length).toBe(4);
    // frame1: item header(8) + data(3) + padding(1) = 12, frame2 starts at 12 + 8 = 20
    expect(frames[1].offset).toBe(20);
  });

  it('should return empty array for buffer with only delimiter', () => {
    const builder = new DicomBufferBuilder();
    builder.addSequenceDelimiter();
    const buffer = builder.build();

    const frames = parseEncapsulatedFrames(buffer, 0);

    expect(frames).toHaveLength(0);
  });

  it('should stop at Sequence Delimiter', () => {
    const frame = new Uint8Array([0xAA, 0xBB]);
    const builder = new DicomBufferBuilder();
    builder.addEncapsulatedItem(frame);
    builder.addSequenceDelimiter();
    // Add garbage after delimiter — should not be parsed
    builder.addBytes(new Uint8Array([0xFF, 0xFE, 0xE0, 0x00, 0x00, 0x00, 0x00, 0x02, 0xCC, 0xDD]));
    const buffer = builder.build();

    const frames = parseEncapsulatedFrames(buffer, 0);

    expect(frames).toHaveLength(1);
    expect(frames[0].length).toBe(2);
  });

  it('should skip empty items', () => {
    const builder = new DicomBufferBuilder();
    builder.addEncapsulatedItem(new Uint8Array(0)); // empty item
    builder.addEncapsulatedItem(new Uint8Array([0x42]));
    builder.addSequenceDelimiter();
    const buffer = builder.build();

    const frames = parseEncapsulatedFrames(buffer, 0);

    expect(frames).toHaveLength(1);
    expect(frames[0].length).toBe(1);
  });
});

describe('extractSingleFrame', () => {
  it('should extract single frame bytes correctly', () => {
    const frameData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xC3, 0x00, 0x01, 0x02, 0x03]);
    const buffer = buildEncapsulatedBuffer([frameData]);

    const result = extractSingleFrame(buffer, 0);

    expect(result.byteLength).toBe(frameData.length);
    const resultBytes = new Uint8Array(result);
    for (let i = 0; i < frameData.length; i++) {
      expect(resultBytes[i]).toBe(frameData[i]);
    }
  });

  it('should throw CorruptedFileError when no frames found', () => {
    const builder = new DicomBufferBuilder();
    builder.addSequenceDelimiter();
    const buffer = builder.build();

    expect(() => extractSingleFrame(buffer, 0)).toThrow(CorruptedFileError);
  });

  it('should throw CorruptedFileError when multiple frames found', () => {
    const buffer = buildEncapsulatedBuffer([
      new Uint8Array([0x01]),
      new Uint8Array([0x02]),
    ]);

    expect(() => extractSingleFrame(buffer, 0)).toThrow(CorruptedFileError);
  });
});
