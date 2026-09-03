// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CpuCprBackend } from '../cpu-backend';
import { prepareCurveSamples } from '../curve-samples';
import type {
  CprCurve,
  CprMode,
  CprVolume,
  NormalizedCprExtractOptions,
} from '../types';
import { createWasmBindings, type WasmBindings } from '../wasm-bindings';

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

function expectParity(
  actual: ReturnType<WasmBindings['extract']>,
  expected: ReturnType<CpuCprBackend['extract']>,
): void {
  expect(actual.width).toBe(expected.width);
  expect(actual.height).toBe(expected.height);
  expect(actual.data).toHaveLength(expected.data.length);
  for (let index = 0; index < expected.data.length; index++) {
    expect(actual.data[index]).toBeCloseTo(expected.data[index], 4);
  }
}

function extractBoth(
  bindings: WasmBindings,
  volume: CprVolume,
  inputCurve: CprCurve,
  options: NormalizedCprExtractOptions,
): void {
  const cpu = new CpuCprBackend();
  cpu.setVolume(volume);
  const expected = cpu.extract(inputCurve, options);
  const preparedCurve = prepareCurveSamples(inputCurve, volume, 512);

  expectParity(bindings.extract(preparedCurve, options), expected);
}

describe('AssemblyScript CPR kernel', () => {
  let bindings: WasmBindings;

  beforeAll(async () => {
    const binary = await readFile(new URL('../generated/cpr.wasm', import.meta.url));
    const wasmUrl = `data:application/wasm;base64,${binary.toString('base64')}`;
    bindings = await createWasmBindings(wasmUrl);
  });

  afterAll(() => bindings.dispose());

  it.each(fixtures)('matches the CPU oracle for $name data in every projection mode', ({ volume }) => {
    bindings.setVolume(volume);

    for (const mode of modes) {
      extractBoth(bindings, volume, curve, {
        thickness: 2.5,
        pixelSize: 0.5,
        mode,
        depthRangeMm: [1.25, 6.25],
      });
    }
  });

  it('matches the CPU oracle at and beyond the volume boundary', () => {
    const boundaryDimensions = [4, 4, 3] as const;
    const data = new Int16Array(
      boundaryDimensions[0] * boundaryDimensions[1] * boundaryDimensions[2],
    );
    for (let z = 0; z < boundaryDimensions[2]; z++) {
      for (let y = 0; y < boundaryDimensions[1]; y++) {
        for (let x = 0; x < boundaryDimensions[0]; x++) {
          data[z * 16 + y * 4 + x] = z * 100 + y * 10 + x;
        }
      }
    }
    const volume: CprVolume = {
      data,
      dimensions: boundaryDimensions,
      spacing: [1, 1, 1],
    };
    const boundaryCurve: CprCurve = {
      points: [
        { x: -1, y: 0, z: 0 },
        { x: 3, y: 0, z: 0 },
      ],
      sample: (t) => ({ x: -1 + 4 * t, y: 0, z: 0 }),
    };
    const options: NormalizedCprExtractOptions = {
      thickness: 1,
      pixelSize: 1,
      mode: 'sum',
      depthRangeMm: [0, 3],
    };

    bindings.setVolume(volume);
    extractBoth(bindings, volume, boundaryCurve, options);
  });

  it('matches the CPU oracle when thickness is zero', () => {
    const volume = fixtures[2].volume;
    const options: NormalizedCprExtractOptions = {
      thickness: 0,
      pixelSize: 0.5,
      mode: 'mean',
      depthRangeMm: [0, 7.5],
    };

    bindings.setVolume(volume);
    extractBoth(bindings, volume, curve, options);
  });

  it('keeps one resident volume copy and returns independently owned results', () => {
    const volume = makeVolume((length) => new Int16Array(length), (x, y, z) => x + y * 20 + z * 400);
    const original = new Int16Array(volume.data);
    const snapshot: CprVolume = { ...volume, data: original };
    const options: NormalizedCprExtractOptions = {
      thickness: 2.5,
      pixelSize: 0.5,
      mode: 'mean',
      depthRangeMm: [1.25, 6.25],
    };
    const preparedCurve = prepareCurveSamples(curve, volume, 512);
    const cpu = new CpuCprBackend();
    cpu.setVolume(snapshot);
    const expected = cpu.extract(curve, options);

    bindings.setVolume(volume);
    volume.data.fill(0);
    const first = bindings.extract(preparedCurve, options);
    const second = bindings.extract(preparedCurve, options);

    expectParity(first, expected);
    expectParity(second, expected);
    expect(first.data.buffer).not.toBe(second.data.buffer);
  });
});
