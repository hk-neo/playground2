import type { Vec2 } from './core';

/** 입력 이벤트 타입 */
export enum InputType {
  MouseDown = 'MouseDown',
  MouseMove = 'MouseMove',
  MouseUp = 'MouseUp',
  Wheel = 'Wheel',
  TouchStart = 'TouchStart',
  TouchMove = 'TouchMove',
  TouchEnd = 'TouchEnd',
  KeyDown = 'KeyDown',
}

/** 제스처 타입 */
export enum GestureType {
  None = 'None',
  Pinch = 'Pinch',
  Pan = 'Pan',
  Tap = 'Tap',
}

/** 키보드 보조키 상태 */
export interface KeyModifiers {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

/** 애플리케이션 입력 이벤트 */
export interface ApplicationInput {
  type: InputType;
  position: Vec2;
  delta: Vec2;
  button?: number;
  scale?: number;
  gesture?: GestureType;
  modifiers?: KeyModifiers;
}

/** 핀치 줌 결과 */
export interface PinchResult {
  scale: number;
  center: Vec2;
}

/** 제스처 인식 결과 */
export interface GestureResult {
  type: GestureType;
  scale?: number;
  center?: Vec2;
}

/** 입력 콜백 */
export type InputCallback = (input: ApplicationInput) => void;

/** 단축키 액션 */
export type ShortcutAction = () => void;
