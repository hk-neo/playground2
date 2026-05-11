import type { MemoryUsage } from '../shared/types/volume';

/** ArrayBuffer 풀 관리 및 재사용으로 GC 최적화 */
export class MemoryPool {
  private pool = new Map<number, ArrayBuffer[]>();
  private totalAllocated = 0;
  private totalReleased = 0;

  /** 버퍼 획득 (풀에 있으면 재사용, 없으면 새로 생성) */
  acquire(size: number): ArrayBuffer {
    const bucketSize = this.alignSize(size);
    const bucket = this.pool.get(bucketSize);

    if (bucket && bucket.length > 0) {
      const buffer = bucket.pop()!;
      return buffer;
    }

    this.totalAllocated += bucketSize;
    return new ArrayBuffer(bucketSize);
  }

  /** 버퍼 반환 (풀에 저장) */
  release(buffer: ArrayBuffer): void {
    const size = buffer.byteLength;
    if (!this.pool.has(size)) {
      this.pool.set(size, []);
    }
    this.pool.get(size)!.push(buffer);
    this.totalReleased += size;
  }

  /** 사용하지 않는 버퍼 정리 */
  compact(): void {
    for (const [size, bucket] of this.pool) {
      if (bucket.length > 2) {
        const keep = bucket.splice(0, bucket.length - 2);
        for (const buf of keep) {
          this.totalReleased -= buf.byteLength;
        }
      }
    }
  }

  /** 메모리 사용량 조회 */
  getUsage(): MemoryUsage {
    let activeBuffers = 0;
    for (const bucket of this.pool.values()) {
      activeBuffers += bucket.length;
    }
    return {
      totalAllocated: this.totalAllocated,
      totalReleased: this.totalReleased,
      activeBuffers,
    };
  }

  /** 1KB 단위로 정렬 */
  private alignSize(size: number): number {
    const alignment = 1024;
    return Math.ceil(size / alignment) * alignment;
  }
}
