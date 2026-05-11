/** 렌더링 프레임 시간 측정 및 FPS 모니터링 */
export class FrameTimer {
  private frameTimes: number[] = [];
  private lastTime = 0;
  private readonly maxSamples: number;

  constructor(maxSamples = 60) {
    this.maxSamples = maxSamples;
  }

  /** 프레임 시작 시 호출 */
  beginFrame(): void {
    this.lastTime = performance.now();
  }

  /** 프레임 종료 시 호출 */
  endFrame(): void {
    const now = performance.now();
    const elapsed = now - this.lastTime;
    this.frameTimes.push(elapsed);

    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
  }

  /** 현재 FPS 조회 */
  getFPS(): number {
    if (this.frameTimes.length === 0) return 0;
    const avg = this.getAverageFrameTime();
    return avg > 0 ? 1000 / avg : 0;
  }

  /** 평균 프레임 시간 (ms) */
  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    return sum / this.frameTimes.length;
  }

  /** 측정 기록 초기화 */
  reset(): void {
    this.frameTimes = [];
    this.lastTime = 0;
  }
}
