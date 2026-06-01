import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DecodingInfo, TransferSyntaxInfo } from '../../shared/types/dicom';
import { CorruptedFileError } from '../../shared/errors/dicom';

const JPEG_LOSSLESS: TransferSyntaxInfo = {
  uid: '1.2.840.10008.1.2.4.70',
  name: 'JPEG Lossless, Non-Hierarchical',
  isCompressed: true,
  isLittleEndian: true,
};

const LE_UNCOMPRESSED: TransferSyntaxInfo = {
  uid: '1.2.840.10008.1.2.1',
  name: 'Explicit VR Little Endian',
  isCompressed: false,
  isLittleEndian: true,
};

const DECODING_INFO: DecodingInfo = {
  bitsAllocated: 16,
  bitsStored: 16,
  pixelRepresentation: 1,
  rows: 4,
  columns: 4,
};

// Mock at top level with proper class constructor
const mockDecompress = vi.fn();

vi.mock('jpeg-lossless-decoder-js', () => ({
  Decoder: vi.fn().mockImplementation(function () {
    return { decompress: mockDecompress };
  }),
}));

import { PixelDataDecoder } from '../pixel-data-decoder';

describe('PixelDataDecoder compressed path', () => {
  beforeEach(() => {
    mockDecompress.mockReset();
  });

  describe('decode (uncompressed)', () => {
    it('should still throw CorruptedFileError for compressed syntax', () => {
      const decoder = new PixelDataDecoder(DECODING_INFO);
      const data = new ArrayBuffer(32);

      expect(() => decoder.decode(data, JPEG_LOSSLESS)).toThrow(CorruptedFileError);
    });
  });

  describe('decodeCompressed', () => {
    it('should throw CorruptedFileError for uncompressed syntax', () => {
      const decoder = new PixelDataDecoder(DECODING_INFO);
      const buffer = new ArrayBuffer(128);

      expect(() => decoder.decodeCompressed(buffer, 12, LE_UNCOMPRESSED, 16)).toThrow(CorruptedFileError);
    });

    it('should call JPEG decoder and return decompressed data', () => {
      const decodedBuffer = new ArrayBuffer(32);
      mockDecompress.mockReturnValue(decodedBuffer);

      // Build encapsulated buffer with one JPEG frame
      const jpegData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xC3, 0x00, 0x01, 0x00, 0x02, 0xFF, 0xD9]);
      const buffer = new ArrayBuffer(128);
      const dv = new DataView(buffer);
      const offset = 12;

      // Item tag at offset
      dv.setUint16(offset, 0xFFFE, true);
      dv.setUint16(offset + 2, 0xE000, true);
      dv.setUint32(offset + 4, jpegData.length, true);
      new Uint8Array(buffer).set(jpegData, offset + 8);
      // Sequence Delimiter
      dv.setUint16(offset + 8 + jpegData.length, 0xFFFE, true);
      dv.setUint16(offset + 10 + jpegData.length, 0xE0DD, true);

      const decoder = new PixelDataDecoder(DECODING_INFO);
      const result = decoder.decodeCompressed(buffer, offset, JPEG_LOSSLESS, 16);

      expect(mockDecompress).toHaveBeenCalledTimes(1);
      // Verify the decompress was called
      const callArgs = mockDecompress.mock.calls[0] as [ArrayBuffer, number, number];
      expect(callArgs[1]).toBe(0);
      expect(callArgs[2]).toBe(jpegData.length);
      expect(callArgs[0].byteLength).toBe(jpegData.length);
      expect(result).toBe(decodedBuffer);
    });
  });
});
