import type { Vec2, Vec3 } from '../shared/types/core';
import { MPRPlane } from '../shared/types/rendering';
import type { PixelSpacing } from '../shared/types/measurement';
import type { ICoordinateMapper } from '../shared/interfaces/measurement';
import { CoordinateMappingError } from '../shared/errors/measurement';

export class CoordinateMapper implements ICoordinateMapper {
  private spacing: PixelSpacing = { row: 1, col: 1, isAvailable: false };

  setPixelSpacing(spacing: PixelSpacing): void {
    this.spacing = spacing;
  }

  getPixelSpacing(): PixelSpacing {
    return this.spacing;
  }

  screenToVolume(screen: Vec2, sliceIndex: number, plane: MPRPlane): Vec3 {
    const col = this.spacing.isAvailable ? this.spacing.col : 1;
    const row = this.spacing.isAvailable ? this.spacing.row : 1;

    switch (plane) {
      case MPRPlane.Axial:
        return { x: screen.x * col, y: screen.y * row, z: sliceIndex * (this.spacing.slice ?? 1) };
      case MPRPlane.Coronal:
        return { x: screen.x * col, y: sliceIndex * row, z: screen.y * (this.spacing.slice ?? 1) };
      case MPRPlane.Sagittal:
        return { x: sliceIndex * col, y: screen.x * row, z: screen.y * (this.spacing.slice ?? 1) };
      default:
        throw new CoordinateMappingError();
    }
  }

  volumeToScreen(volume: Vec3, plane: MPRPlane): Vec2 {
    const col = this.spacing.isAvailable ? this.spacing.col : 1;
    const row = this.spacing.isAvailable ? this.spacing.row : 1;
    const slice = this.spacing.slice ?? 1;

    switch (plane) {
      case MPRPlane.Axial:
        return { x: volume.x / col, y: volume.y / row };
      case MPRPlane.Coronal:
        return { x: volume.x / col, y: volume.z / slice };
      case MPRPlane.Sagittal:
        return { x: volume.y / row, y: volume.z / slice };
      default:
        throw new CoordinateMappingError();
    }
  }
}
