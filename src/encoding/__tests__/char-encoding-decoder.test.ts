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

    it('should fallback to UTF-8 for unsupported encoding', () => {
      const buf = new TextEncoder().encode('test');
      const result = decoder.decode(buf.buffer, 'invalid-encoding-xyz');
      // 폴백으로 UTF-8 디코딩됨
      expect(typeof result).toBe('string');
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

  describe('setEncodingFromDicom', () => {
    it('should map ISO 2022 IR 149 to euc-kr', () => {
      decoder.setEncodingFromDicom('ISO 2022 IR 149');
      // EUC-KR로 '정성진' 인코딩된 바이트
      const eucKrBytes = new Uint8Array([0xc1, 0xa4, 0xbc, 0xba, 0xc1, 0xf8]);
      const result = decoder.decode(eucKrBytes.buffer);
      expect(result).toBe('정성진');
    });

    it('should map ISO_IR 149 to euc-kr', () => {
      decoder.setEncodingFromDicom('ISO_IR 149');
      const eucKrBytes = new Uint8Array([0xc1, 0xa4, 0xbc, 0xba, 0xc1, 0xf8]);
      const result = decoder.decode(eucKrBytes.buffer);
      expect(result).toBe('정성진');
    });

    it('should default to utf-8 for unknown charset', () => {
      decoder.setEncodingFromDicom('UNKNOWN_CHARSET');
      const buf = new TextEncoder().encode('test');
      expect(decoder.decode(buf.buffer)).toBe('test');
    });
  });
});
