import { describe, it, expect } from 'vitest';
import { extractCrossSection, buildCrossSectionSpec } from '../cross-section';
import type { VolumeData } from '../../shared/types/volume';
import type { CurveFrame } from '../curve-frame';

function makeUniformVolume(value: number): VolumeData {
  const [dx, dy, dz] = [8, 8, 8];
  const buf = new ArrayBuffer(dx * dy * dz * 2);
  const view = new Int16Array(buf);
  view.fill(value);
  return {
    buffer: buf,
    dimensions: [dx, dy, dz],
    spacing: [1, 1, 1],
    origin: [0, 0, 0],
    dataType: 'int16',
  };
}

const frame: CurveFrame = {
  position: { x: 4, y: 4, z: 4 },
  tangent: { x: 1, y: 0, z: 0 },
  normal: { x: 0, y: -1, z: 0 },      // 협설
  binormal: { x: 0, y: 0, z: 1 },     // 상하
  arcLength: 0,
};

describe('cross-section', () => {
  it('extractCrossSection returns correct size and uniform sample', () => {
    const vol = makeUniformVolume(500);
    const spec = buildCrossSectionSpec('orthogonal', frame, 3, 3, 16, 8);
    const out = extractCrossSection(vol, spec);
    expect(out).toHaveLength(16 * 8);
    for (let i = 0; i < out.length; i++) {
      expect(out[i]).toBeCloseTo(500, 5);
    }
  });

  it('orthogonal spec uses curve normal as u-axis', () => {
    const spec = buildCrossSectionSpec('orthogonal', frame, 3, 3, 16, 8);
    expect(spec.uAxis.x).toBeCloseTo(frame.normal.x, 5);
    expect(spec.uAxis.y).toBeCloseTo(frame.normal.y, 5);
    expect(spec.vAxis.z).toBeCloseTo(1, 5);
  });

  it('tangential spec uses curve tangent as u-axis', () => {
    const spec = buildCrossSectionSpec('tangential', frame, 3, 3, 16, 8);
    expect(spec.uAxis.x).toBeCloseTo(frame.tangent.x, 5);
    expect(spec.uAxis.y).toBeCloseTo(frame.tangent.y, 5);
  });

  it('samples symmetric around center along u-axis', () => {
    // y에 따라 값이 변하는 볼륨으로, orthogonal(N=협설 -y 방향) 중심 대칭 확인.
    const [dx, dy, dz] = [8, 8, 8];
    const buf = new ArrayBuffer(dx * dy * dz * 2);
    const view = new Int16Array(buf);
    for (let z = 0; z < dz; z++) {
      for (let y = 0; y < dy; y++) {
        for (let x = 0; x < dx; x++) {
          view[z * dx * dy + y * dx + x] = y * 100; // y에 비례
        }
      }
    }
    const vol: VolumeData = {
      buffer: buf,
      dimensions: [dx, dy, dz],
      spacing: [1, 1, 1],
      origin: [0, 0, 0],
      dataType: 'int16',
    };
    // orthogonal u-axis = normal = -y. 가운데 col(u=0)은 y=4 → 400.
    const spec = buildCrossSectionSpec('orthogonal', frame, 2, 2, 5, 1);
    const out = extractCrossSection(vol, spec);
    const mid = out[2]; // u=0 (col 2)
    expect(mid).toBeCloseTo(400, 5);
    // 좌(col 0, u=-1): y = 4 + (-1 norm) * (-1)*-2 ... normal=-y, uHalfExtent=2.
    // u=-1 → offset = normal.y * (-1)*2 = (-1)*(-2)=+2 → y=6 → 600.
    expect(out[0]).toBeCloseTo(600, 5);
  });
});