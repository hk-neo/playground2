export class CanvasResizeError extends Error {
  constructor(message = 'Canvas resize failed, keeping previous size') {
    super(message);
    this.name = 'CanvasResizeError';
  }
}

export class InvalidOverlayError extends Error {
  constructor(message = 'Invalid overlay data ignored') {
    super(message);
    this.name = 'InvalidOverlayError';
  }
}

export class TextStyleError extends Error {
  constructor(message = 'Text rendering failed, falling back to default font') {
    super(message);
    this.name = 'TextStyleError';
  }
}
