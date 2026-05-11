import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryPool } from '../memory-pool';

describe('MemoryPool', () => {
  let pool: MemoryPool;

  beforeEach(() => {
    pool = new MemoryPool();
  });

  it('should allocate new buffer when pool is empty', () => {
    const buf = pool.acquire(1024);
    expect(buf.byteLength).toBeGreaterThanOrEqual(1024);
  });

  it('should reuse released buffer', () => {
    const buf1 = pool.acquire(1024);
    pool.release(buf1);
    const buf2 = pool.acquire(1024);
    expect(buf2).toBe(buf1);
  });

  it('should track usage stats', () => {
    pool.acquire(2048);
    pool.acquire(4096);

    const usage = pool.getUsage();
    expect(usage.totalAllocated).toBeGreaterThan(0);
    expect(usage.activeBuffers).toBe(0);

    pool.release(pool.acquire(1024));
    const usage2 = pool.getUsage();
    expect(usage2.activeBuffers).toBe(1);
  });

  it('should compact excess buffers', () => {
    const buffers: ArrayBuffer[] = [];
    for (let i = 0; i < 5; i++) {
      buffers.push(pool.acquire(1024));
    }
    for (const buf of buffers) {
      pool.release(buf);
    }

    pool.compact();
    const usage = pool.getUsage();
    expect(usage.activeBuffers).toBeLessThanOrEqual(2);
  });
});
