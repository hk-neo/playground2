import { describe, it, expect } from 'vitest';
import { DicomTagReader } from '../tag-reader';
import { DicomBufferBuilder, buildMinimalDicomBuffer } from './helpers';
import { InvalidDicomError, MissingTagError } from '../../shared/errors/dicom';

describe('DicomTagReader', () => {
  describe('validateMagicByte', () => {
    it('should return true for valid DICM magic byte', () => {
      const builder = new DicomBufferBuilder().addPreamble();
      const reader = new DicomTagReader(builder.build());
      expect(reader.validateMagicByte()).toBe(true);
    });

    it('should return false for invalid magic byte', () => {
      const buffer = new ArrayBuffer(132);
      const reader = new DicomTagReader(buffer);
      expect(reader.validateMagicByte()).toBe(false);
    });

    it('should return false for buffer too small', () => {
      const buffer = new ArrayBuffer(50);
      const reader = new DicomTagReader(buffer);
      expect(reader.validateMagicByte()).toBe(false);
    });
  });

  describe('parseAllTags', () => {
    it('should throw InvalidDicomError for non-DICOM file', () => {
      const buffer = new ArrayBuffer(200);
      const reader = new DicomTagReader(buffer);
      expect(() => reader.parseAllTags()).toThrow(InvalidDicomError);
    });

    it('should parse minimal valid DICOM file', () => {
      const buffer = buildMinimalDicomBuffer();
      const reader = new DicomTagReader(buffer);
      const tags = reader.parseAllTags();

      // Transfer Syntax UID
      expect(tags.has('00020010')).toBe(true);
      expect(tags.get('00020010')!.value).toContain('1.2.840.10008.1.2.1');

      // Patient ID
      expect(tags.has('00100020')).toBe(true);
      expect(tags.get('00100020')!.value).toBe('PATIENT001');

      // Patient Name
      expect(tags.has('00100010')).toBe(true);
      expect(tags.get('00100010')!.value).toBe('Test^Patient');

      // Rows
      expect(tags.has('00280010')).toBe(true);
      expect(tags.get('00280010')!.value).toBe(512);

      // Columns
      expect(tags.has('00280011')).toBe(true);
      expect(tags.get('00280011')!.value).toBe(512);
    });

    it('should return tag with correct structure', () => {
      const buffer = buildMinimalDicomBuffer();
      const reader = new DicomTagReader(buffer);
      const tags = reader.parseAllTags();
      const tag = tags.get('00280010')!;

      expect(tag).toHaveProperty('group', 0x0028);
      expect(tag).toHaveProperty('element', 0x0010);
      expect(tag).toHaveProperty('vr', 'US');
      expect(tag).toHaveProperty('length', 2);
      expect(tag).toHaveProperty('offset');
    });
  });

  describe('validateRequiredTags', () => {
    it('should pass when all required tags are present', () => {
      const buffer = buildMinimalDicomBuffer();
      const reader = new DicomTagReader(buffer);
      const tags = reader.parseAllTags();
      expect(() => DicomTagReader.validateRequiredTags(tags)).not.toThrow();
    });

    it('should throw MissingTagError when Patient ID is missing', () => {
      const buffer = buildMinimalDicomBuffer();
      const reader = new DicomTagReader(buffer);
      const tags = reader.parseAllTags();
      tags.delete('00100020');
      expect(() => DicomTagReader.validateRequiredTags(tags)).toThrow(MissingTagError);
    });
  });
});
