import { describe, expect, it } from 'vitest';
import { getWlwwApplier, setSharedWlww } from '../slice-renderer';

describe('shared MPR windowing', () => {
  it('initializes the curve-editor renderer to the main viewer WL/WW', () => {
    setSharedWlww(500, 2500);

    expect(getWlwwApplier().windowLevel).toBe(500);
    expect(getWlwwApplier().windowWidth).toBe(2500);
  });
});
