import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FrameTimer } from '../frame-timer';

describe('FrameTimer', () => {
  let timer: FrameTimer;

  beforeEach(() => {
    vi.useFakeTimers();
    timer = new FrameTimer(5);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return 0 FPS with no frames', () => {
    expect(timer.getFPS()).toBe(0);
    expect(timer.getAverageFrameTime()).toBe(0);
  });

  it('should calculate FPS from frame times', () => {
    // Simulate 16.67ms frames (60fps)
    for (let i = 0; i < 5; i++) {
      timer.beginFrame();
      vi.advanceTimersByTime(16.67);
      timer.endFrame();
    }

    const fps = timer.getFPS();
    expect(fps).toBeGreaterThan(50);
    expect(fps).toBeLessThan(70);
  });

  it('should track average frame time', () => {
    timer.beginFrame();
    vi.advanceTimersByTime(20);
    timer.endFrame();

    timer.beginFrame();
    vi.advanceTimersByTime(30);
    timer.endFrame();

    const avg = timer.getAverageFrameTime();
    expect(avg).toBe(25);
  });

  it('should respect max samples limit', () => {
    for (let i = 0; i < 10; i++) {
      timer.beginFrame();
      vi.advanceTimersByTime(10 + i);
      timer.endFrame();
    }

    // maxSamples = 5, so only last 5 frames should be kept
    const avg = timer.getAverageFrameTime();
    // Last 5 frames: 5+6+7+8+9 = 35/5 = 7, but with deltas 5..9
    // Actually frames 6,7,8,9,10 → times are 6,7,8,9,10 → avg = 8
    // Wait, i goes 0..9, times are 10+0, 10+1, ..., 10+9
    // Last 5: 10+5, 10+6, 10+7, 10+8, 10+9 = 15,16,17,18,19 → avg = 17
    expect(avg).toBe(17);
  });

  it('should reset measurements', () => {
    timer.beginFrame();
    vi.advanceTimersByTime(16);
    timer.endFrame();

    timer.reset();
    expect(timer.getFPS()).toBe(0);
    expect(timer.getAverageFrameTime()).toBe(0);
  });
});
