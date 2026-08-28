import { describe, expect, it } from 'vitest';
import { PANORAMIC_FRAGMENT_SHADER } from '../panoramic-shader';

describe('panoramic empty state', () => {
  it('renders black instead of windowed gray when no curve is set', () => {
    expect(PANORAMIC_FRAGMENT_SHADER).toContain('u_hasCurve');
    expect(PANORAMIC_FRAGMENT_SHADER).toContain('fragColor = vec4(0.0, 0.0, 0.0, 1.0)');
  });
});
