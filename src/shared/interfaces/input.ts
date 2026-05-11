import type { ApplicationInput, GestureResult, InputCallback } from '../types/input';

/** 입력 매핑 추상화 */
export interface IInputMapper {
  mapEvent(raw: Event): ApplicationInput;
}

/** 제스처 인식 추상화 */
export interface IGestureDetector {
  detect(touches: TouchList): GestureResult | null;
}
