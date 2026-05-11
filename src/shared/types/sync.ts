import type { Vec3 } from './core';
import type { MPRPlane } from './rendering';

/** 동기화 상태 */
export interface SyncState {
  enabled: boolean;
  lastSource: string | null;
  lastTimestamp: number;
  pendingSync: SyncEvent | null;
}

/** 동기화 이벤트 */
export interface SyncEvent {
  source: string;
  target: string;
  position: Vec3;
  plane: MPRPlane;
  timestamp: number;
}

/** 동기화 이벤트 데이터 */
export interface SyncEventData {
  position: Vec3;
  plane?: MPRPlane;
  source: string;
}

/** MPR 포지션 (3단면 인덱스) */
export interface MPRPosition {
  axial: number;
  coronal: number;
  sagittal: number;
}

/** 동기화 오류 */
export interface SyncError {
  type: 'timeout' | 'transform_failure' | 'conflict';
  message: string;
  source: string;
}

/** 이벤트 구독자 */
export type EventSubscriber = (data: SyncEventData) => void;
