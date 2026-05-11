import { describe, it, expect } from 'vitest';
import { RectangleROI } from '../rectangle-roi';
import { CircleROI } from '../circle-roi';
import { FreehandROI } from '../freehand-roi';
import { ROIToolFactory } from '../roi-tool-factory';
import { InvalidROIError } from '../../shared/errors/measurement';

describe('RectangleROI', () => {
  it('should contain point inside', () => {
    const roi = new RectangleROI();
    roi.setOrigin({ x: 10, y: 10 });
    roi.setSize(50, 30);
    expect(roi.contains({ x: 30, y: 20 })).toBe(true);
  });

  it('should not contain point outside', () => {
    const roi = new RectangleROI();
    roi.setOrigin({ x: 10, y: 10 });
    roi.setSize(50, 30);
    expect(roi.contains({ x: 0, y: 0 })).toBe(false);
  });

  it('should calculate area', () => {
    const roi = new RectangleROI();
    roi.setSize(50, 30);
    expect(roi.getArea()).toBe(1500);
  });

  it('should throw InvalidROIError for tiny size', () => {
    const roi = new RectangleROI();
    expect(() => roi.setSize(0.5, 10)).toThrow(InvalidROIError);
  });

  it('should return volume bounds', () => {
    const roi = new RectangleROI();
    roi.setOrigin({ x: 10, y: 20 });
    roi.setSize(50, 30);
    const bounds = roi.getVolumeBounds();
    expect(bounds.min.x).toBe(10);
    expect(bounds.max.x).toBe(60);
  });
});

describe('CircleROI', () => {
  it('should contain point inside', () => {
    const roi = new CircleROI();
    roi.setCenter({ x: 50, y: 50 });
    roi.setRadius(30);
    expect(roi.contains({ x: 60, y: 60 })).toBe(true);
  });

  it('should not contain point outside', () => {
    const roi = new CircleROI();
    roi.setCenter({ x: 50, y: 50 });
    roi.setRadius(10);
    expect(roi.contains({ x: 100, y: 100 })).toBe(false);
  });

  it('should calculate area', () => {
    const roi = new CircleROI();
    roi.setRadius(10);
    expect(roi.getArea()).toBeCloseTo(Math.PI * 100, 2);
  });

  it('should return volume bounds', () => {
    const roi = new CircleROI();
    roi.setCenter({ x: 50, y: 50 });
    roi.setRadius(20);
    const bounds = roi.getVolumeBounds();
    expect(bounds.min.x).toBe(30);
    expect(bounds.max.x).toBe(70);
  });
});

describe('FreehandROI', () => {
  it('should contain point inside triangle', () => {
    const roi = new FreehandROI();
    roi.addPoint({ x: 0, y: 0 });
    roi.addPoint({ x: 100, y: 0 });
    roi.addPoint({ x: 50, y: 100 });
    roi.close();
    expect(roi.contains({ x: 50, y: 30 })).toBe(true);
  });

  it('should not contain point outside', () => {
    const roi = new FreehandROI();
    roi.addPoint({ x: 0, y: 0 });
    roi.addPoint({ x: 100, y: 0 });
    roi.addPoint({ x: 50, y: 100 });
    roi.close();
    expect(roi.contains({ x: 200, y: 200 })).toBe(false);
  });

  it('should calculate area with shoelace formula', () => {
    const roi = new FreehandROI();
    roi.addPoint({ x: 0, y: 0 });
    roi.addPoint({ x: 100, y: 0 });
    roi.addPoint({ x: 100, y: 100 });
    roi.addPoint({ x: 0, y: 100 });
    expect(roi.getArea()).toBe(10000);
  });

  it('should throw InvalidROIError when closing with < 3 points', () => {
    const roi = new FreehandROI();
    roi.addPoint({ x: 0, y: 0 });
    roi.addPoint({ x: 1, y: 1 });
    expect(() => roi.close()).toThrow(InvalidROIError);
  });

  it('should simplify with Douglas-Peucker', () => {
    const roi = new FreehandROI();
    // Add points on a straight line with noise
    roi.addPoint({ x: 0, y: 0 });
    roi.addPoint({ x: 25, y: 0.1 });
    roi.addPoint({ x: 50, y: 0 });
    roi.addPoint({ x: 75, y: 0.1 });
    roi.addPoint({ x: 100, y: 0 });
    roi.simplify(1.0);
    expect(roi.points.length).toBeLessThanOrEqual(3);
  });

  it('should return volume bounds', () => {
    const roi = new FreehandROI();
    roi.addPoint({ x: 10, y: 20 });
    roi.addPoint({ x: 100, y: 200 });
    const bounds = roi.getVolumeBounds();
    expect(bounds.min.x).toBe(10);
    expect(bounds.max.y).toBe(200);
  });
});

describe('ROIToolFactory', () => {
  it('should create all ROI types', () => {
    const factory = new ROIToolFactory();
    expect(factory.createRectangle()).toBeInstanceOf(RectangleROI);
    expect(factory.createCircle()).toBeInstanceOf(CircleROI);
    expect(factory.createFreehand()).toBeInstanceOf(FreehandROI);
  });
});
