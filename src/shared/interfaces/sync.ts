import type { Vec3 } from '../types/core';
import type { MPRPlane } from '../types/rendering';
import type { SyncEventData, MPRPosition, EventSubscriber } from '../types/sync';

/** 뷰포트 추상화 */
export interface IViewport {
  getPosition(): Vec3;
  setPosition(pos: Vec3): void;
  getPlane(): MPRPlane;
}

/** 이벤트 버스 추상화 */
export interface IEventBus {
  subscribe(event: string, callback: EventSubscriber): void;
  unsubscribe(event: string, callback: EventSubscriber): void;
  publish(event: string, data: SyncEventData): void;
  clear(): void;
}

/** 좌표 변환 추상화 */
export interface ICoordinateTransformer {
  mprTo3D(point: Vec3, plane: MPRPlane): Vec3;
  threeDToMPR(point: Vec3): MPRPosition;
  computeTransformMatrix(): Float32Array;
  validateTransform(): boolean;
}
