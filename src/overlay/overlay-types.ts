import type { Vec2 } from '../shared/types/core';
import { MPRPlane } from '../shared/types/rendering';

export interface LineStyle {
  color: string;
  width: number;
  dashPattern: number[];
}

export interface FillStyle {
  strokeColor: string;
  fillColor: string;
  opacity: number;
  strokeWidth: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlayItem {
  id: string;
  type: 'line' | 'angle' | 'roi';
  points: Vec2[];
  style: LineStyle | FillStyle;
  sliceIndex: number;
  plane: MPRPlane;
  label?: string;
  visible: boolean;
}

export const DEFAULT_LINE_STYLE: LineStyle = {
  color: '#00ff00',
  width: 2,
  dashPattern: [],
};

export const DEFAULT_FILL_STYLE: FillStyle = {
  strokeColor: '#00ff00',
  fillColor: 'rgba(0, 255, 0, 0.15)',
  opacity: 0.15,
  strokeWidth: 2,
};
