import { describe, it, expect, beforeEach } from 'vitest';
import { TransferSyntaxResolver } from '../transfer-syntax-resolver';
import { UnsupportedTransferSyntaxError } from '../../shared/errors/dicom';

describe('TransferSyntaxResolver', () => {
  let resolver: TransferSyntaxResolver;

  beforeEach(() => {
    resolver = new TransferSyntaxResolver();
  });

  describe('resolve', () => {
    it('should resolve Implicit VR Little Endian', () => {
      const info = resolver.resolve('1.2.840.10008.1.2');
      expect(info.name).toBe('Implicit VR Little Endian');
      expect(info.isCompressed).toBe(false);
      expect(info.isLittleEndian).toBe(true);
    });

    it('should resolve Explicit VR Little Endian', () => {
      const info = resolver.resolve('1.2.840.10008.1.2.1');
      expect(info.name).toBe('Explicit VR Little Endian');
      expect(info.isCompressed).toBe(false);
      expect(info.isLittleEndian).toBe(true);
    });

    it('should resolve Explicit VR Big Endian', () => {
      const info = resolver.resolve('1.2.840.10008.1.2.2');
      expect(info.name).toBe('Explicit VR Big Endian');
      expect(info.isLittleEndian).toBe(false);
    });

    it('should throw UnsupportedTransferSyntaxError for unknown UID', () => {
      expect(() => resolver.resolve('1.2.3.4.5.6')).toThrow(UnsupportedTransferSyntaxError);
    });
  });

  describe('isCompressed', () => {
    it('should return false for uncompressed transfer syntaxes', () => {
      expect(resolver.isCompressed('1.2.840.10008.1.2')).toBe(false);
      expect(resolver.isCompressed('1.2.840.10008.1.2.1')).toBe(false);
    });

    it('should return true for compressed transfer syntaxes', () => {
      expect(resolver.isCompressed('1.2.840.10008.1.2.5')).toBe(true);
      expect(resolver.isCompressed('1.2.840.10008.1.2.4.70')).toBe(true);
    });
  });

  describe('isSupported', () => {
    it('should return true for supported UIDs', () => {
      expect(resolver.isSupported('1.2.840.10008.1.2')).toBe(true);
      expect(resolver.isSupported('1.2.840.10008.1.2.1')).toBe(true);
    });

    it('should return false for unknown UIDs', () => {
      expect(resolver.isSupported('99.99.99')).toBe(false);
    });
  });
});
