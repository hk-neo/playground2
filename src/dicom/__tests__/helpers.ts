import { InvalidDicomError, MissingTagError } from '../../shared/errors/dicom';

/** 테스트용 DICOM 버퍼 빌더 */
export class DicomBufferBuilder {
  private parts: Uint8Array[] = [];

  /** 128바이트 프리앰블 + 'DICM' 매직 바이트 */
  addPreamble(): this {
    const preamble = new Uint8Array(128);
    this.parts.push(preamble);
    const magic = new Uint8Array([0x44, 0x49, 0x43, 0x4d]); // 'DICM'
    this.parts.push(magic);
    return this;
  }

  /** 파일 메타 정보 그룹 길이 (4바이트) */
  addMetaGroupLength(length: number): this {
    this.parts.push(new Uint8Array(new ArrayBuffer(0))); // placeholder
    const buf = new ArrayBuffer(4);
    new DataView(buf).setUint32(0, length, true);
    this.parts.push(new Uint8Array(buf));
    return this;
  }

  /** Explicit VR 태그 (짧은 길이) 추가 */
  addExplicitTagShort(group: number, element: number, vr: string, value: string): this {
    const tagBuf = new ArrayBuffer(2 + 2 + 2 + 2);
    const dv = new DataView(tagBuf);
    dv.setUint16(0, group, true);
    dv.setUint16(2, element, true);
    // VR as 2 ASCII chars
    tagBuf as ArrayBuffer;
    const bytes = new Uint8Array(tagBuf);
    bytes[4] = vr.charCodeAt(0);
    bytes[5] = vr.charCodeAt(1);
    dv.setUint16(6, value.length, true);
    this.parts.push(bytes);

    const valBytes = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i++) {
      valBytes[i] = value.charCodeAt(i);
    }
    this.parts.push(valBytes);
    return this;
  }

  /** Explicit VR 태그 (US 타입) 추가 */
  addExplicitTagUS(group: number, element: number, value: number): this {
    const tagBuf = new ArrayBuffer(2 + 2 + 2 + 2);
    const dv = new DataView(tagBuf);
    dv.setUint16(0, group, true);
    dv.setUint16(2, element, true);
    const bytes = new Uint8Array(tagBuf);
    bytes[4] = 'U'.charCodeAt(0);
    bytes[5] = 'S'.charCodeAt(0);
    dv.setUint16(6, 2, true); // length = 2 for US
    this.parts.push(bytes);

    const valBuf = new ArrayBuffer(2);
    new DataView(valBuf).setUint16(0, value, true);
    this.parts.push(new Uint8Array(valBuf));
    return this;
  }

  /** Encapsulated pixel data 태그 추가 (OW VR, undefined length + items + delimiter) */
  addEncapsulatedPixelDataTag(frames: Uint8Array[]): this {
    // 태그 헤더: (7FE0,0010) OW reserved(2) length=0xFFFFFFFF
    const header = new ArrayBuffer(12);
    const hdv = new DataView(header);
    hdv.setUint16(0, 0x7FE0, true);  // group
    hdv.setUint16(2, 0x0010, true);  // element
    const hbytes = new Uint8Array(header);
    hbytes[4] = 'O'.charCodeAt(0);
    hbytes[5] = 'W'.charCodeAt(0);
    // bytes 6-7: reserved (0)
    hdv.setUint32(8, 0xFFFFFFFF, true); // undefined length
    this.parts.push(new Uint8Array(header));

    // 각 프레임을 Item으로 추가
    for (const frame of frames) {
      this.addEncapsulatedItem(frame);
    }

    // Sequence Delimiter (FFFE,E0DD) + 4 zero bytes
    this.addSequenceDelimiter();

    return this;
  }

  /** Encapsulated Item 추가: (FFFE,E000) + length(4) + data (+ padding if odd) */
  addEncapsulatedItem(data: Uint8Array): this {
    const itemHeader = new ArrayBuffer(8);
    const dv = new DataView(itemHeader);
    dv.setUint16(0, 0xFFFE, true);
    dv.setUint16(2, 0xE000, true);
    dv.setUint32(4, data.length, true);
    this.parts.push(new Uint8Array(itemHeader));
    this.parts.push(data);
    // DICOM even-byte alignment: pad odd-length items
    if (data.length % 2 !== 0) {
      this.parts.push(new Uint8Array([0x00]));
    }
    return this;
  }

  /** Sequence Delimiter 추가: (FFFE,E0DD) + 4 zero bytes */
  addSequenceDelimiter(): this {
    const delim = new ArrayBuffer(8);
    const dv = new DataView(delim);
    dv.setUint16(0, 0xFFFE, true);
    dv.setUint16(2, 0xE0DD, true);
    dv.setUint32(4, 0, true);
    this.parts.push(new Uint8Array(delim));
    return this;
  }

  /** 바이트 배열 직접 추가 */
  addBytes(bytes: Uint8Array): this {
    this.parts.push(bytes);
    return this;
  }

  /** 최종 ArrayBuffer 생성 */
  build(): ArrayBuffer {
    const totalLength = this.parts.reduce((sum, p) => sum + p.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of this.parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result.buffer;
  }
}

/** 최소한의 유효한 DICOM 버퍼 생성 (메타 + 필수 태그 포함) */
export function buildMinimalDicomBuffer(): ArrayBuffer {
  // 메타 정보 바이트 (Transfer Syntax UID)
  const tsUID = '1.2.840.10008.1.2.1'; // Explicit VR LE
  const metaTagBytes = buildMetaTag(0x0002, 0x0010, 'UI', tsUID);

  const builder = new DicomBufferBuilder();
  builder.addPreamble();

  // 메타 그룹 길이
  const metaLengthBuf = new ArrayBuffer(4);
  new DataView(metaLengthBuf).setUint32(0, metaTagBytes.length, true);
  // (0002,0000) Group Length tag
  const groupLenTag = new ArrayBuffer(8 + 4);
  const glDv = new DataView(groupLenTag);
  glDv.setUint16(0, 0x0002, true);
  glDv.setUint16(2, 0x0000, true);
  glDv.setUint8(4, 'U'.charCodeAt(0));
  glDv.setUint8(5, 'L'.charCodeAt(0));
  glDv.setUint16(6, 4, true);
  glDv.setUint32(8, metaTagBytes.length, true);
  builder.addBytes(new Uint8Array(groupLenTag));
  builder.addBytes(metaTagBytes);

  // 데이터셋 필수 태그들 (Explicit VR LE)
  builder.addExplicitTagUS(0x0028, 0x0010, 512); // Rows
  builder.addExplicitTagUS(0x0028, 0x0011, 512); // Columns
  builder.addExplicitTagShort(0x0010, 0x0020, 'LO', 'PATIENT001'); // Patient ID
  builder.addExplicitTagShort(0x0010, 0x0010, 'PN', 'Test^Patient'); // Patient Name

  return builder.build();
}

/** 메타 태그 바이트 생성 */
function buildMetaTag(group: number, element: number, vr: string, value: string): Uint8Array {
  const paddedValue = value.padEnd(value.length % 2 === 0 ? value.length : value.length + 1, '\0');
  const buf = new ArrayBuffer(8 + paddedValue.length);
  const dv = new DataView(buf);
  dv.setUint16(0, group, true);
  dv.setUint16(2, element, true);
  const bytes = new Uint8Array(buf);
  bytes[4] = vr.charCodeAt(0);
  bytes[5] = vr.charCodeAt(1);
  dv.setUint16(6, paddedValue.length, true);
  for (let i = 0; i < paddedValue.length; i++) {
    bytes[8 + i] = paddedValue.charCodeAt(i);
  }
  return bytes;
}
