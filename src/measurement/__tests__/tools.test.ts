import { describe, it, expect } from 'vitest';
import { DistanceTool } from '../distance-tool';
import { AngleTool } from '../angle-tool';
import { InsufficientPointsError } from '../../shared/errors/measurement';

describe('DistanceTool', () => {
  it('should calculate distance between two points', () => {
    const tool = new DistanceTool({ row: 0.2, col: 0.2, isAvailable: true });
    tool.setStart({ x: 0, y: 0 });
    tool.setEnd({ x: 100, y: 0 });
    const result = tool.calculate();
    expect(result.value).toBeCloseTo(20, 1);
    expect(result.unit).toBe('mm');
  });

  it('should calculate diagonal distance', () => {
    const tool = new DistanceTool({ row: 0.2, col: 0.2, isAvailable: true });
    tool.setStart({ x: 0, y: 0 });
    tool.setEnd({ x: 100, y: 100 });
    const result = tool.calculate();
    expect(result.value).toBeCloseTo(28.28, 1);
  });

  it('should throw InsufficientPointsError with 0 points', () => {
    const tool = new DistanceTool();
    expect(() => tool.calculate()).toThrow(InsufficientPointsError);
  });

  it('should throw InsufficientPointsError with 1 point', () => {
    const tool = new DistanceTool();
    tool.setStart({ x: 0, y: 0 });
    expect(() => tool.calculate()).toThrow(InsufficientPointsError);
  });

  it('should return fallback result from getResult', () => {
    const tool = new DistanceTool();
    const result = tool.getResult();
    expect(result.value).toBe(0);
    expect(result.formatted).toBe('측정 불가');
  });

  it('should reset on deactivate', () => {
    const tool = new DistanceTool();
    tool.setStart({ x: 0, y: 0 });
    tool.deactivate();
    expect(tool.startPoint).toBeNull();
  });

  it('should handle input events', () => {
    const tool = new DistanceTool();
    tool.activate();
    tool.handleInput({ type: 'MouseDown' as any, position: { x: 10, y: 20 }, delta: { x: 0, y: 0 } });
    expect(tool.startPoint).toEqual({ x: 10, y: 20 });
  });

  it('should use pixel units when spacing unavailable', () => {
    const tool = new DistanceTool({ row: 1, col: 1, isAvailable: false });
    tool.setStart({ x: 0, y: 0 });
    tool.setEnd({ x: 50, y: 0 });
    const result = tool.calculate();
    expect(result.value).toBe(50);
  });
});

describe('AngleTool', () => {
  it('should calculate 90-degree angle', () => {
    const tool = new AngleTool();
    tool.addPoint({ x: 0, y: 100 });
    tool.addPoint({ x: 0, y: 0 });
    tool.addPoint({ x: 100, y: 0 });
    const result = tool.calculate();
    expect(result.value).toBeCloseTo(90, 1);
    expect(result.unit).toBe('degree');
    expect(result.formatted).toContain('90');
  });

  it('should calculate 180-degree angle', () => {
    const tool = new AngleTool();
    tool.addPoint({ x: -100, y: 0 });
    tool.addPoint({ x: 0, y: 0 });
    tool.addPoint({ x: 100, y: 0 });
    const result = tool.calculate();
    expect(result.value).toBeCloseTo(180, 0);
  });

  it('should throw InsufficientPointsError with less than 3 points', () => {
    const tool = new AngleTool();
    tool.addPoint({ x: 0, y: 0 });
    tool.addPoint({ x: 1, y: 1 });
    expect(() => tool.calculate()).toThrow(InsufficientPointsError);
  });

  it('should not add more than 3 points', () => {
    const tool = new AngleTool();
    expect(tool.addPoint({ x: 0, y: 0 })).toBe(true);
    expect(tool.addPoint({ x: 1, y: 1 })).toBe(true);
    expect(tool.addPoint({ x: 2, y: 2 })).toBe(true);
    expect(tool.addPoint({ x: 3, y: 3 })).toBe(false);
  });

  it('should compute angle correctly', () => {
    const tool = new AngleTool();
    const angle = tool.computeAngle({ x: 10, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 });
    expect(angle).toBeCloseTo(90, 1);
  });
});
