import type { DicomTag } from '../shared/types/dicom';
import type { DicomTags } from '../shared/types/patient';
import { InvalidDicomError, MissingTagError } from '../shared/errors/dicom';

/** DICOM 매직 바이트 오프셋 */
const DICM_PREFIX_OFFSET = 128;
const DICM_MAGIC = 0x4d434944; // 'DICM' as 32-bit LE: D=0x44, I=0x49, C=0x43, M=0x4d

/** DICOM 태그 그룹/엘리먼트 상수 */
const GROUP_FILE_META_INFO = 0x0002;
const TAG_TRANSFER_SYNTAX_UID = 0x00020010;
const TAG_PIXEL_DATA = 0x7fe00010;

/** VR 타입에 따른 길이 필드 크기 (Explicit VR) */
const SHORT_VR_LENGTH_SIZE: Record<string, boolean> = {
  AE: true, AS: true, AT: true, CS: true, DA: true, DS: true, DT: true,
  FL: true, FD: true, IS: true, LO: true, LT: true, PN: true, SH: true,
  SL: true, SS: true, ST: true, TM: true, UI: true, UL: true, UN: true,
  US: true, UR: true, UT: true,
};

/** DICOM 태그 리더 - 메타헤더 검증, 태그 파싱, VR 해석 */
export class DicomTagReader {
  private dataView: DataView;
  private byteOffset = 0;
  private littleEndian = true;
  private isExplicitVR = true;

  constructor(buffer: ArrayBuffer) {
    this.dataView = new DataView(buffer);
  }

  /** DICM 매직 바이트 검증 */
  validateMagicByte(): boolean {
    if (this.dataView.byteLength < DICM_PREFIX_OFFSET + 4) {
      return false;
    }
    const magic = this.dataView.getUint32(DICM_PREFIX_OFFSET, true);
    return magic === DICM_MAGIC;
  }

  /** 전체 태그 파싱 */
  parseAllTags(): DicomTags {
    if (!this.validateMagicByte()) {
      throw new InvalidDicomError();
    }

    const tags: DicomTags = new Map();

    // 파일 메타 정보는 항상 Explicit VR Little Endian
    this.byteOffset = DICM_PREFIX_OFFSET + 4;
    this.littleEndian = true;
    this.isExplicitVR = true;

    // 파일 메타 정보 그룹 파싱 (group 0002)
    this.parseMetaGroup(tags);

    // 전송 구문에 따라 VR 모드 설정
    const transferSyntax = tags.get('00020010')?.value as string | undefined;
    if (transferSyntax === '1.2.840.10008.1.2') {
      this.isExplicitVR = false;
    }

    // 나머지 데이터셋 파싱
    this.parseDataset(tags);

    return tags;
  }

  /** 파일 메타 정보 그룹(0002) 파싱 */
  private parseMetaGroup(tags: DicomTags): void {
    // (0002,0000) Group Length 태그 읽기 - 항상 Explicit VR LE
    const groupTag = this.readTagExplicit();
    if (!groupTag || groupTag.group !== 0x0002 || groupTag.element !== 0x0000) {
      return;
    }

    const metaLength = groupTag.value as number;
    if (metaLength === 0xFFFFFFFF) {
      return;
    }

    const metaEnd = this.byteOffset + metaLength;

    while (this.byteOffset < metaEnd && this.byteOffset < this.dataView.byteLength - 7) {
      const tag = this.readTagExplicit();
      if (tag) {
        tags.set(this.tagKey(tag.group, tag.element), tag);
      }
    }

    this.byteOffset = metaEnd;
  }

  /** 데이터셋 파싱 */
  private parseDataset(tags: DicomTags): void {
    while (this.byteOffset < this.dataView.byteLength - 7) {
      const group = this.dataView.getUint16(this.byteOffset, this.littleEndian);
      const element = this.dataView.getUint16(this.byteOffset + 2, this.littleEndian);

      // Pixel Data (7FE0,0010) 이후는 파싱 중단
      if (group === 0x7FE0 && element === 0x0010) {
        break;
      }

      // Sequence delimiter 태그는 스킵
      if (group === 0xFFFE) {
        this.byteOffset += 8;
        continue;
      }

      const tag = this.isExplicitVR
        ? this.readTagExplicit()
        : this.readTagImplicit();

      if (tag) {
        // SQ(undefined length)는 시퀀스 끝까지 스킵
        if (tag.vr === 'SQ' && tag.length === 0xFFFFFFFF) {
          this.skipSequence();
        } else {
          tags.set(this.tagKey(tag.group, tag.element), tag);
        }
      }
    }
  }

  /** SQ(undefined length) 시퀀스 스킵 - (FFFE,E0DD)까지 */
  private skipSequence(): void {
    let depth = 1;

    while (this.byteOffset < this.dataView.byteLength - 7 && depth > 0) {
      const group = this.dataView.getUint16(this.byteOffset, this.littleEndian);
      const element = this.dataView.getUint16(this.byteOffset + 2, this.littleEndian);
      const length = this.dataView.getUint32(this.byteOffset + 4, this.littleEndian);

      // Sequence Delimitation Item
      if (group === 0xFFFE && element === 0xE0DD) {
        this.byteOffset += 8;
        depth--;
        continue;
      }

      // Item Delimitation Item
      if (group === 0xFFFE && element === 0xE00D) {
        this.byteOffset += 8;
        continue;
      }

      // Item Tag (FFFE,E000)
      if (group === 0xFFFE && element === 0xE000) {
        if (length !== 0xFFFFFFFF) {
          // Known-length item: jump over contents
          this.byteOffset += 8 + length;
        } else {
          this.byteOffset += 8;
        }
        continue;
      }

      // 중첩 SQ 태그
      const vr = this.readString(this.byteOffset + 4, 2);
      if (vr === 'SQ') {
        const sqLen = this.dataView.getUint32(this.byteOffset + 8, this.littleEndian);
        this.byteOffset += 12;
        if (sqLen === 0xFFFFFFFF) {
          depth++;
        } else {
          this.byteOffset += sqLen;
        }
        continue;
      }

      // 일반 태그: 길이만큼 점프
      if (this.isExplicitVR) {
        if (SHORT_VR_LENGTH_SIZE[vr]) {
          const tagLen = this.dataView.getUint16(this.byteOffset + 6, this.littleEndian);
          this.byteOffset += 8 + tagLen;
        } else {
          const tagLen = this.dataView.getUint32(this.byteOffset + 8, this.littleEndian);
          this.byteOffset += 12 + (tagLen === 0xFFFFFFFF ? 0 : tagLen);
        }
      } else {
        this.byteOffset += 8 + (length === 0xFFFFFFFF ? 0 : length);
      }
    }
  }

  /** Explicit VR 모드에서 태그 읽기 */
  private readTagExplicit(): DicomTag | null {
    const offset = this.byteOffset;

    const group = this.dataView.getUint16(offset, this.littleEndian);
    const element = this.dataView.getUint16(offset + 2, this.littleEndian);
    const vr = this.readString(offset + 4, 2);

    this.byteOffset = offset + 4 + 2;

    let length: number;
    if (SHORT_VR_LENGTH_SIZE[vr]) {
      length = this.dataView.getUint16(this.byteOffset, this.littleEndian);
      this.byteOffset += 2;
    } else {
      this.byteOffset += 2; // skip reserved bytes
      length = this.dataView.getUint32(this.byteOffset, this.littleEndian);
      this.byteOffset += 4;
    }

    if (length === 0xFFFFFFFF) {
      return { group, element, vr, length, value: undefined, offset };
    }

    const value = this.readValue(vr, length);
    return { group, element, vr, length, value, offset };
  }

  /** Implicit VR 모드에서 태그 읽기 */
  private readTagImplicit(): DicomTag | null {
    const offset = this.byteOffset;

    const group = this.dataView.getUint16(offset, this.littleEndian);
    const element = this.dataView.getUint16(offset + 2, this.littleEndian);
    const length = this.dataView.getUint32(offset + 4, this.littleEndian);

    this.byteOffset = offset + 8;

    if (length === 0xFFFFFFFF) {
      return { group, element, vr: 'UN', length, value: undefined, offset };
    }

    const value = this.readValue('UN', length);
    return { group, element, vr: 'UN', length, value, offset };
  }

  /** VR 타입별 값 읽기 */
  private readValue(vr: string, length: number): unknown {
    if (length <= 0 || this.byteOffset + length > this.dataView.byteLength) {
      this.byteOffset += Math.max(length, 0);
      return undefined;
    }

    const start = this.byteOffset;

    switch (vr) {
      case 'US':
        this.byteOffset += length;
        return this.dataView.getUint16(start, this.littleEndian);
      case 'SS':
        this.byteOffset += length;
        return this.dataView.getInt16(start, this.littleEndian);
      case 'UL':
        this.byteOffset += length;
        return this.dataView.getUint32(start, this.littleEndian);
      case 'SL':
        this.byteOffset += length;
        return this.dataView.getInt32(start, this.littleEndian);
      case 'FL':
        this.byteOffset += length;
        return this.dataView.getFloat32(start, this.littleEndian);
      case 'FD':
        this.byteOffset += length;
        return this.dataView.getFloat64(start, this.littleEndian);
      case 'AT': {
        this.byteOffset += length;
        const g = this.dataView.getUint16(start, this.littleEndian);
        const e = this.dataView.getUint16(start + 2, this.littleEndian);
        return this.tagKey(g, e);
      }
      default:
        this.byteOffset += length;
        return this.readString(start, length).trimEnd();
    }
  }

  /** 지정 위치에서 문자열 읽기 */
  private readString(offset: number, length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      const byte = this.dataView.getUint8(offset + i);
      if (byte === 0) break;
      result += String.fromCharCode(byte);
    }
    return result;
  }

  /** 태그 키 문자열 생성 (ggggeeee 형식) */
  private tagKey(group: number, element: number): string {
    return group.toString(16).padStart(4, '0') + element.toString(16).padStart(4, '0');
  }

  /** 필수 태그 존재 확인 */
  static validateRequiredTags(tags: DicomTags): void {
    const required = [
      { key: '00100020', name: 'Patient ID' },
      { key: '00280010', name: 'Rows' },
      { key: '00280011', name: 'Columns' },
    ];

    for (const { key, name } of required) {
      if (!tags.has(key)) {
        throw new MissingTagError(name);
      }
    }
  }
}
