import { describe, expect, it } from 'vitest';
import { ArchPresser } from '../../pano/arch-presser';
import type { VolumeData } from '../../shared/types/volume';
import { CpuCprBackend } from '../cpu-backend';
import type {
  CprCurve,
  CprMode,
  CprVolume,
  NormalizedCprExtractOptions,
} from '../types';

const dimensions = [20, 20, 6] as const;
const spacing = [0.5, 0.75, 1.25] as const;
const modes: CprMode[] = ['sum', 'mean', 'min', 'max'];

const curve: CprCurve = {
  points: [
    { x: 2, y: 9.5, z: 0 },
    { x: 17, y: 9.5, z: 0 },
  ],
  sample: (t) => ({ x: 2 + 15 * t, y: 9.5, z: 0 }),
};

function makeVolume(
  createData: (length: number) => Int16Array | Uint16Array,
  valueAt: (x: number, y: number, z: number) => number,
): CprVolume {
  const [width, height, depth] = dimensions;
  const data = createData(width * height * depth);

  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        data[z * width * height + y * width + x] = valueAt(x, y, z);
      }
    }
  }

  return { data, dimensions, spacing };
}

const fixtures = [
  {
    name: 'constant',
    volume: makeVolume((length) => new Uint16Array(length), () => 125),
  },
  {
    name: 'z-gradient',
    volume: makeVolume((length) => new Int16Array(length), (_x, _y, z) => z * 100 - 200),
  },
  {
    name: 'radial-gradient',
    volume: makeVolume(
      (length) => new Int16Array(length),
      (x, y) => Math.round(Math.sqrt((x - 9.5) ** 2 + (y - 9.5) ** 2) * 10),
    ),
  },
];

function asVolumeData(volume: CprVolume): VolumeData {
  return {
    buffer: volume.data.buffer as ArrayBuffer,
    dimensions: [...volume.dimensions],
    spacing: [...volume.spacing],
    origin: [0, 0, 0],
    dataType: volume.data instanceof Int16Array ? 'int16' : 'uint16',
  };
}

describe('CpuCprBackend', () => {
  it.each(fixtures.flatMap((fixture) => modes.map((mode) => ({ ...fixture, mode }))))(
    'matches ArchPresser for $name data in $mode mode',
    ({ volume, mode }) => {
      const options: NormalizedCprExtractOptions = {
        thickness: 2.5,
        pixelSize: 0.5,
        mode,
        depthRangeMm: [1.25, 6.25],
      };
      const reference = new ArchPresser({
        thickness: options.thickness,
        pixelSize: options.pixelSize,
        mode: options.mode,
        depthMinMm: options.depthRangeMm[0],
        depthMaxMm: options.depthRangeMm[1],
      }).extract(curve, asVolumeData(volume));
      const backend = new CpuCprBackend();

      backend.setVolume(volume);
      const actual = backend.extract(curve, options);

      expect(actual.width).toBe(reference.width);
      expect(actual.height).toBe(reference.height);
      expect(actual.data).toEqual(reference.data);
    },
  );

  it('keeps a zero-copy reference to an offset volume view', () => {
    const voxelCount = dimensions[0] * dimensions[1] * dimensions[2];
    const backing = new Int16Array(voxelCount + 4);
    backing.fill(-1000);
    const data = new Int16Array(backing.buffer, 4 * Int16Array.BYTES_PER_ELEMENT, voxelCount);
    for (let index = 0; index < data.length; index++) data[index] = index;
    const volume: CprVolume = { data, dimensions, spacing };
    const options: NormalizedCprExtractOptions = {
      thickness: 2.5,
      pixelSize: 0.5,
      mode: 'mean',
      depthRangeMm: [1.25, 6.25],
    };
    const backend = new CpuCprBackend();
    backend.setVolume(volume);

    const initial = backend.extract(curve, options);
    const compactInitial = new CpuCprBackend();
    compactInitial.setVolume({
      data: new Int16Array(data),
      dimensions,
      spacing,
    });
    expect(initial.data).toEqual(compactInitial.extract(curve, options).data);

    for (let index = 0; index < data.length; index++) data[index] += 500;
    const updated = backend.extract(curve, options);
    const compactUpdated = new CpuCprBackend();
    compactUpdated.setVolume({
      data: new Int16Array(data),
      dimensions,
      spacing,
    });
    expect(updated.data).toEqual(compactUpdated.extract(curve, options).data);
  });
});
