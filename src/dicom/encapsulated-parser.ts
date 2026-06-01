import { CorruptedFileError } from '../shared/errors/dicom';

/** Encapsulated pixel data에서 추출한 개별 프레임 정보 */
export interface EncapsulatedFrame {
  /** 원본 버퍼 내 JPEG 데이터 시작 오프셋 */
  offset: number;
  /** JPEG 데이터 바이트 길이 */
  length: number;
}

/**
 * DICOM encapsulated pixel data에서 프레임 목록을 파싱합니다.
 *
 * encapsulated format 구조:
 * - (FFFE,E000) Item tag + 길이(4바이트) + JPEG 프레임 데이터 (반복)
 * - (FFFE,E0DD) Sequence Delimiter (종료 마커)
 *
 * @param buffer - 전체 DICOM 파일 ArrayBuffer
 * @param dataStart - encapsulated items 시작 오프셋 (PixelData 태그 헤더 이후)
 * @param dataEnd - 탐색 종료 오프셋 (기본값: 버퍼 끝)
 * @returns 추출된 프레임 목록
 */
export function parseEncapsulatedFrames(
  buffer: ArrayBuffer,
  dataStart: number,
  dataEnd?: number,
): EncapsulatedFrame[] {
  const dv = new DataView(buffer);
  const end = dataEnd ?? buffer.byteLength;
  const frames: EncapsulatedFrame[] = [];

  let pos = dataStart;

  while (pos + 8 <= end) {
    const group = dv.getUint16(pos, true);
    const element = dv.getUint16(pos + 2, true);

    // Sequence Delimiter (FFFE,E0DD) — 종료
    if (group === 0xFFFE && element === 0xE0DD) {
      break;
    }

    // Item tag (FFFE,E000)
    if (group === 0xFFFE && element === 0xE000) {
      const itemLength = dv.getUint32(pos + 4, true);

      if (itemLength === 0xFFFFFFFF) {
        // undefined length item — 다음 태그 경계까지 스캔
        break;
      }

      if (itemLength > 0) {
        frames.push({ offset: pos + 8, length: itemLength });
      }

      pos += 8 + itemLength;

      // 2바이트 패딩 정렬 (odd length)
      if (itemLength % 2 !== 0) {
        pos += 1;
      }
      continue;
    }

    // 알 수 없는 태그 — 종료
    break;
  }

  return frames;
}

/**
 * 단일 프레임 encapsulated pixel data에서 JPEG bitstream을 추출합니다.
 *
 * @param buffer - 전체 DICOM 파일 ArrayBuffer
 * @param dataStart - encapsulated items 시작 오프셋
 * @returns JPEG bitstream이 담긴 ArrayBuffer
 * @throws {CorruptedFileError} 프레임이 0개이거나 2개 이상인 경우
 */
export function extractSingleFrame(
  buffer: ArrayBuffer,
  dataStart: number,
): ArrayBuffer {
  const frames = parseEncapsulatedFrames(buffer, dataStart);

  if (frames.length === 0) {
    throw new CorruptedFileError('No frames found in encapsulated pixel data');
  }

  if (frames.length > 1) {
    throw new CorruptedFileError(
      `Expected single frame, found ${frames.length} frames in encapsulated pixel data`,
    );
  }

  const frame = frames[0];
  const src = new Uint8Array(buffer, frame.offset, frame.length);
  const dst = new Uint8Array(frame.length);
  dst.set(src);

  return dst.buffer;
}
