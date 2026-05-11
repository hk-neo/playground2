import { describe, it, expect, beforeEach } from 'vitest';
import { VrValueReader } from '../vr-value-reader';

function toBuffer(str: string): ArrayBuffer {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes.buffer;
}

describe('VrValueReader', () => {
  let reader: VrValueReader;

  beforeEach(() => {
    reader = new VrValueReader();
  });

  describe('readLO', () => {
    it('should read long string', () => {
      expect(reader.readLO(toBuffer('Patient Study  '))).toBe('Patient Study');
    });
  });

  describe('readPN', () => {
    it('should parse Last^First format', () => {
      expect(reader.readPN(toBuffer('Kim^Sungjin'))).toBe('Kim Sungjin');
    });

    it('should parse Last^First^Middle format', () => {
      expect(reader.readPN(toBuffer('Kim^Sungjin^D'))).toBe('Kim Sungjin');
    });

    it('should handle single name', () => {
      expect(reader.readPN(toBuffer('Anonymous'))).toBe('Anonymous');
    });
  });

  describe('readDA', () => {
    it('should parse YYYYMMDD date', () => {
      const date = reader.readDA(toBuffer('20240115'));
      expect(date).not.toBeNull();
      expect(date!.getFullYear()).toBe(2024);
      expect(date!.getMonth()).toBe(0); // January
      expect(date!.getDate()).toBe(15);
    });

    it('should return null for invalid format', () => {
      expect(reader.readDA(toBuffer('invalid'))).toBeNull();
    });
  });

  describe('readTM', () => {
    it('should parse HHMMSS time', () => {
      const time = reader.readTM(toBuffer('143052'));
      expect(time).not.toBeNull();
      expect(time!.getHours()).toBe(14);
      expect(time!.getMinutes()).toBe(30);
      expect(time!.getSeconds()).toBe(52);
    });

    it('should parse HHMM time (short)', () => {
      const time = reader.readTM(toBuffer('1430'));
      expect(time).not.toBeNull();
      expect(time!.getHours()).toBe(14);
      expect(time!.getMinutes()).toBe(30);
    });
  });

  describe('readUI', () => {
    it('should read UID', () => {
      expect(reader.readUI(toBuffer('1.2.840.10008.1.2.1'))).toBe('1.2.840.10008.1.2.1');
    });
  });

  describe('readDS', () => {
    it('should parse decimal string', () => {
      expect(reader.readDS(toBuffer('3.14159'))).toBeCloseTo(3.14159);
    });

    it('should parse integer as decimal', () => {
      expect(reader.readDS(toBuffer('42'))).toBe(42);
    });
  });

  describe('readIS', () => {
    it('should parse integer string', () => {
      expect(reader.readIS(toBuffer('512'))).toBe(512);
    });

    it('should parse negative integer', () => {
      expect(reader.readIS(toBuffer('-100'))).toBe(-100);
    });
  });
});
