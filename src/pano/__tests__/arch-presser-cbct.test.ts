/**
 * 실제 DICOM CBCT로 ArchPresser 검증.
 * DICOM_SAMPLE_FILE 또는 기본 경로의 단일 슬라이스로 volume을 합성해서 테스트.
 * (전체 666장 로딩은 메모리/CBCT 가정상 부담 → 단일 슬라이스 + z-axis replicate로 3D 합성)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DicomTagReader } from '../../dicom/tag-reader';
import { ArchPresser } from '../arch-presser';
import { PanoramicCurve } from '../panoramic-curve';
import type { VolumeData } from '../../shared/types/volume';

const SAMPLE_FILE = process.env.DICOM_SAMPLE_FILE
  || join(process.env.HOME!, 'Projects', '정성진ct', '10001.dcm');

function loadDicomVolume(): VolumeData | null {
  let nodeBuf: Buffer;
  try { nodeBuf = readFileSync(SAMPLE_FILE); } catch { return null; }
  const buf = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength) as ArrayBuffer;
  const tags = new DicomTagReader(buf).parseAllTags();
  const rows = tags.get('00280010')!.value as number;
  const cols = tags.get('00280011')!.value as number;
  const px = String(tags.get('00280030')!.value).split('\\').map(Number);
  const sliceThick = parseFloat(String(tags.get('00180050')!.value).split('\\')[0]);
  const ip = String(tags.get('00200032')!.value).split('\\').map(Number);
  const pxTag = tags.get('7fe00010')!;
  const int16 = new Int16Array(buf.slice(pxTag.offset, pxTag.offset + pxTag.length));
  // 단일 슬라이스를 z 방향으로 3번 replicate해서 최소 3D volume 만들기 (테스트 목적)
  const dz = 3;
  const total = rows * cols * dz;
  const vol = new Int16Array(total);
  for (let z = 0; z < dz; z++) vol.set(int16, z * rows * cols);
  return {
    buffer: vol.buffer,
    dimensions: [cols, rows, dz],
    spacing: [px[1] || 0.3, px[0] || 0.3, sliceThick],
    origin: [ip[0] || 0, ip[1] || 0, ip[2] || 0],
    dataType: 'int16',
  };
}

describe.skipIf(!loadDicomVolumeSafe())('ArchPresser on real CBCT slice', () => {
  it('produces valid panorama (no NaN, right shape, in HU range)', () => {
    const v = loadDicomVolume();
    if (!v) return;
    const [dx, dy, dz] = v.dimensions;
    const c = new PanoramicCurve();
    // 가로 arch (left → right), y는 머리 중심
    c.addPoint({ x: dx * 0.15, y: dy * 0.5, z: Math.floor(dz / 2) });
    c.addPoint({ x: dx * 0.5,  y: dy * 0.55, z: Math.floor(dz / 2) });
    c.addPoint({ x: dx * 0.85, y: dy * 0.5, z: Math.floor(dz / 2) });

    for (const mode of ['mean', 'min', 'max'] as const) {
      const ap = new ArchPresser({ thickness: 5, pixelSize: 1, mode });
      const t0 = performance.now();
      const r = ap.extract(c, v);
      const t1 = performance.now();
      // 모양 검증
      expect(r.data.length).toBe(r.width * r.height);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
      // No NaN / Infinity
      for (let i = 0; i < r.data.length; i++) {
        expect(Number.isFinite(r.data[i])).toBe(true);
      }
      // HU 범위 (CT는 보통 -1000 ~ +3000 정도, 우리 CBCT는 -30392 ~ +32736 raw)
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < r.data.length; i++) {
        if (r.data[i] < mn) mn = r.data[i];
        if (r.data[i] > mx) mx = r.data[i];
      }
      expect(mn).toBeGreaterThanOrEqual(-30392);
      expect(mx).toBeLessThanOrEqual(32736);
      console.log(`  [${mode}] ${r.width}×${r.height}, HU=[${mn.toFixed(0)}, ${mx.toFixed(0)}], ${(t1-t0).toFixed(0)}ms`);
    }
  });
});

function loadDicomVolumeSafe(): boolean {
  try { readFileSync(SAMPLE_FILE); return true; } catch { return false; }
}
