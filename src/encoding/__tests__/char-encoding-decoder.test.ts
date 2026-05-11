import { describe, it, expect, beforeEach } from 'vitest';
import { CharEncodingDecoder } from '../char-encoding-decoder';
import { EncodingDetectionError } from '../../shared/errors/transfer-syntax';

describe('CharEncodingDecoder', () => {
  let decoder: CharEncodingDecoder;

  beforeEach(() => {
    decoder = new CharEncodingDecoder();
  });

  describe('decode', () => {
    it('should decode UTF-8 string', () => {
      const text = 'Hello CBCT';
      const buf = new TextEncoder().encode(text);
      expect(decoder.decode(buf.buffer)).toBe(text);
    });

    it('should decode with explicit encoding', () => {
      const text = 'Test';
      const buf = new TextEncoder().encode(text);
      expect(decoder.decode(buf.buffer, 'utf-8')).toBe(text);
    });

    it('should use current encoding when none specified', () => {
      decoder.setEncoding('utf-8');
      const text = '환자';
      const buf = new TextEncoder().encode(text);
      expect(decoder.decode(buf.buffer)).toBe(text);
    });

    it('should throw EncodingDetectionError for invalid encoding', () => {
      const buf = new ArrayBuffer(4);
      expect(() => decoder.decode(buf, 'invalid-encoding-xyz')).toThrow(EncodingDetectionError);
    });
  });

  describe('detectEncoding', () => {
    it('should detect UTF-8 from BOM', () => {
      const buf = new Uint8Array([0xEF, 0xBB, 0xBF, 0x48, 0x65, 0x6C, 0x6C, 0x6F]);
      expect(decoder.detectEncoding(buf.buffer)).toBe('utf-8');
    });

    it('should default to UTF-8 for plain ASCII', () => {
      const buf = new TextEncoder().encode('Hello');
      expect(decoder.detectEncoding(buf.buffer)).toBe('utf-8');
    });
  });

  describe('setEncoding', () => {
    it('should change default encoding', () => {
      decoder.setEncoding('ascii');
      const buf = new TextEncoder().encode('test');
      expect(decoder.decode(buf.buffer)).toBe('test');
    });
  });
});
