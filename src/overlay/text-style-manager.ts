export class TextStyleManager {
  fontSize = 12;
  fontFamily = 'monospace';
  fontColor = '#ffffff';
  backgroundColor = 'rgba(0, 0, 0, 0.7)';

  formatDistance(mm: number): string {
    return `${mm.toFixed(2)} mm`;
  }

  formatAngle(degrees: number): string {
    return `${degrees.toFixed(2)}°`;
  }

  getFont(): string {
    return `${this.fontSize}px ${this.fontFamily}`;
  }
}
