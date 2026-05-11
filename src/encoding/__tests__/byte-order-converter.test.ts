import { describe, it, expect } from 'vitest';
import { ByteOrderConverter } from '../byte-order-converter';

describe('ByteOrderConverter', () => {
  describe('convertToLittleEndian', () => {
    it('should return buffer as-is when not big endian', () => {
      const converter = new ByteOrderConverter();
      const buf = new ArrayBuffer(4);
      const result = converter.convertToLittleEndian(buf, false);
      expect(result).toBe(buf);
    });

    it('should swap bytes for 16-bit big endian data', () => {
      const converter = new ByteOrderConverter();
      const src = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const result = converter.convertToLittleEndian(src.buffer, true);
      const view = new Uint8Array(result);
      expect(view[0]).toBe(0x02);
      expect(view[1]).toBe(0x01);
      expect(view[2]).toBe(0x04);
      expect(view[3]).toBe(0x03);
    });

    it('should handle odd-length buffers', () => {
      const converter = new ByteOrderConverter();
      const src = new Uint8Array([0xAA, 0xBB, 0xCC]);
      const result = converter.convertToLittleEndian(src.buffer, true);
      const view = new Uint8Array(result);
      expect(view[0]).toBe(0xBB);
      expect(view[1]).toBe(0xAA);
      expect(view[2]).toBe(0xCC); // last byte unchanged
    });
  });

  describe('swap16', () => {
    it('should swap 16-bit value', () => {
      expect(ByteOrderConverter.swap16(0x0102)).toBe(0x0201);
      expect(ByteOrderConverter.swap16(0xFF00)).toBe(0x00FF);
      expect(ByteOrderConverter.swap16(0x1234)).toBe(0x3412);
    });
  });

  describe('swap32', () => {
    it('should swap 32-bit value', () => {
      expect(ByteOrderConverter.swap32(0x01020304)).toBe(0x04030201);
      expect(ByteOrderConverter.swap32(0xFF000000)).toBe(0x000000FF);
    });
  });
});
