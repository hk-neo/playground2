import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DicomTagReader } from '../tag-reader';
import { PixelDataDecoder } from '../pixel-data-decoder';
import { TransferSyntaxRegistry } from '../../encoding/transfer-syntax-registry';
import { extractSingleFrame } from '../encapsulated-parser';

const CT_FILE = join(process.env.HOME!, 'Work', 'Patients', 'CT', '00000001.dcm');

describe('JPEG Lossless end-to-end with real CT file', () => {
  const SKIP = !require('fs').existsSync(CT_FILE);

  it('should parse tags from JPEG Lossless DICOM', ({ skip }) => {
    if (SKIP) skip('CT file not found');
    const buf = readFileSync(CT_FILE);
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

    const reader = new DicomTagReader(arrayBuffer);
    const tags = reader.parseAllTags();

    expect(tags.get('00020010')?.value).toBe('1.2.840.10008.1.2.4.70');
    expect(tags.get('00280010')?.value).toBe(750);
    expect(tags.get('00280011')?.value).toBe(750);
    expect(tags.get('00280100')?.value).toBe(16);
  });

  it('should extract and decode JPEG Lossless pixel data', ({ skip }) => {
    if (SKIP) skip('CT file not found');
    const buf = readFileSync(CT_FILE);
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

    const reader = new DicomTagReader(arrayBuffer);
    const tags = reader.parseAllTags();

    const tsUid = (tags.get('00020010')?.value as string) || '';
    const registry = new TransferSyntaxRegistry();
    const tsDef = registry.lookup(tsUid);

    const pixelTag = tags.get('7fe00010')!;
    expect(pixelTag).toBeDefined();
    expect(pixelTag.length).toBe(0xFFFFFFFF);

    const SHORT_VR = new Set(['AE','AS','AT','CS','DA','DS','DT','FL','FD','IS','LO','LT','PN','SH','SL','SS','ST','TM','UI','UL','US']);
    const headerSize = SHORT_VR.has(pixelTag.vr) ? 8 : 12;
    const pixelDataStart = pixelTag.offset + headerSize;

    console.log('pixelTag:', { offset: pixelTag.offset, vr: pixelTag.vr, length: pixelTag.length });
    console.log('headerSize:', headerSize, 'pixelDataStart:', pixelDataStart);

    // Step 1: Extract JPEG frame
    const jpegBuffer = extractSingleFrame(arrayBuffer, pixelDataStart);
    expect(jpegBuffer.byteLength).toBeGreaterThan(0);
    console.log('JPEG frame size:', jpegBuffer.byteLength);

    // Step 2: Decode via PixelDataDecoder
    const decoder = new PixelDataDecoder({
      bitsAllocated: 16,
      bitsStored: 16,
      pixelRepresentation: 1,
      rows: 750,
      columns: 750,
    });

    const decoded = decoder.decodeCompressed(arrayBuffer, pixelDataStart, {
      uid: tsDef.uid,
      name: tsDef.name,
      isCompressed: tsDef.isCompressed,
      isLittleEndian: tsDef.isLittleEndian,
    }, 16);

    expect(decoded.byteLength).toBe(750 * 750 * 2);
    console.log('Decoded pixel data size:', decoded.byteLength);
  });
});
