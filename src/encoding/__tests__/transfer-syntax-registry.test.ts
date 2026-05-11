import { describe, it, expect, beforeEach } from 'vitest';
import { TransferSyntaxRegistry } from '../transfer-syntax-registry';
import { UnsupportedTransferSyntaxError } from '../../shared/errors/dicom';

describe('TransferSyntaxRegistry', () => {
  let registry: TransferSyntaxRegistry;

  beforeEach(() => {
    registry = new TransferSyntaxRegistry();
  });

  describe('lookup', () => {
    it('should return Implicit VR LE definition', () => {
      const def = registry.lookup('1.2.840.10008.1.2');
      expect(def.name).toBe('Implicit VR Little Endian');
      expect(def.isExplicitVR).toBe(false);
      expect(def.isLittleEndian).toBe(true);
      expect(def.isCompressed).toBe(false);
    });

    it('should return Explicit VR LE definition', () => {
      const def = registry.lookup('1.2.840.10008.1.2.1');
      expect(def.isExplicitVR).toBe(true);
    });

    it('should return Explicit VR BE definition', () => {
      const def = registry.lookup('1.2.840.10008.1.2.2');
      expect(def.isLittleEndian).toBe(false);
    });

    it('should return compressed syntax with compressionType', () => {
      const def = registry.lookup('1.2.840.10008.1.2.5');
      expect(def.isCompressed).toBe(true);
      expect(def.compressionType).toBe('rle');
    });

    it('should throw for unknown UID', () => {
      expect(() => registry.lookup('9.9.9.9')).toThrow(UnsupportedTransferSyntaxError);
    });
  });

  describe('isSupported', () => {
    it('should return true for standard UIDs', () => {
      expect(registry.isSupported('1.2.840.10008.1.2')).toBe(true);
      expect(registry.isSupported('1.2.840.10008.1.2.1')).toBe(true);
    });

    it('should return false for unknown UIDs', () => {
      expect(registry.isSupported('9.9.9.9')).toBe(false);
    });
  });

  describe('register', () => {
    it('should allow registering custom syntax', () => {
      registry.register('1.2.3.4.5', {
        uid: '1.2.3.4.5',
        name: 'Custom Syntax',
        isLittleEndian: true,
        isExplicitVR: true,
        isCompressed: false,
      });

      expect(registry.isSupported('1.2.3.4.5')).toBe(true);
      expect(registry.lookup('1.2.3.4.5').name).toBe('Custom Syntax');
    });
  });
});
