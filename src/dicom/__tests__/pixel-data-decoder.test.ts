import { describe, it, expect } from 'vitest';
import { PixelDataDecoder } from '../pixel-data-decoder';
import type { DecodingInfo, TransferSyntaxInfo } from '../../shared/types/dicom';
import { CorruptedFileError } from '../../shared/errors/dicom';

const LE_UNCOMPRESSED: TransferSyntaxInfo = {
  uid: '1.2.840.10008.1.2.1',
  name: 'Explicit VR Little Endian',
  isCompressed: false,
  isLittleEndian: true,
};

const BE_UNCOMPRESSED: TransferSyntaxInfo = {
  uid: '1.2.840.10008.1.2.2',
  name: 'Explicit VR Big Endian',
  isCompressed: false,
  isLittleEndian: false,
};

const COMPRESSED: TransferSyntaxInfo = {
  uid: '1.2.840.10008.1.2.5',
  name: 'RLE Lossless',
  isCompressed: true,
  isLittleEndian: true,
};

const DECODING_INFO_16BIT: DecodingInfo = {
  bitsAllocated: 16,
  bitsStored: 12,
  pixelRepresentation: 0,
  rows: 4,
  columns: 4,
};

describe('PixelDataDecoder', () => {
  describe('decode', () => {
    it('should return buffer as-is for LE uncompressed', () => {
      const decoder = new PixelDataDecoder(DECODING_INFO_16BIT);
      const data = new Int16Array([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600]);

      const result = decoder.decode(data.buffer, LE_UNCOMPRESSED);
      expect(result).toBe(data.buffer);
    });

    it('should swap bytes for BE uncompressed 16-bit', () => {
      const decoder = new PixelDataDecoder(DECODING_INFO_16BIT);
      // Big-endian 0x0102 → should become 0x0201 in LE
      const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

      const result = decoder.decode(data.buffer, BE_UNCOMPRESSED);
      const resultView = new Uint8Array(result);
      expect(resultView[0]).toBe(0x02);
      expect(resultView[1]).toBe(0x01);
      expect(resultView[2]).toBe(0x04);
      expect(resultView[3]).toBe(0x03);
    });

    it('should not swap for 8-bit BE data', () => {
      const info8bit: DecodingInfo = {
        bitsAllocated: 8, bitsStored: 8, pixelRepresentation: 0, rows: 2, columns: 2,
      };
      const decoder = new PixelDataDecoder(info8bit);
      const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

      const result = decoder.decode(data.buffer, BE_UNCOMPRESSED);
      expect(new Uint8Array(result)).toEqual(data);
    });

    it('should throw CorruptedFileError for compressed syntax', () => {
      const decoder = new PixelDataDecoder(DECODING_INFO_16BIT);
      const data = new ArrayBuffer(32);

      expect(() => decoder.decode(data, COMPRESSED)).toThrow(CorruptedFileError);
    });
  });

  describe('validatePixelData', () => {
    it('should return true for correct size', () => {
      const decoder = new PixelDataDecoder(DECODING_INFO_16BIT);
      // 4 * 4 * (16/8) = 32 bytes
      const data = new ArrayBuffer(32);
      expect(decoder.validatePixelData(data)).toBe(true);
    });

    it('should return false for wrong size', () => {
      const decoder = new PixelDataDecoder(DECODING_INFO_16BIT);
      const data = new ArrayBuffer(16);
      expect(decoder.validatePixelData(data)).toBe(false);
    });
  });
});
